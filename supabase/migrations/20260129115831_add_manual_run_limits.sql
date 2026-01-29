/*
  # Add Manual Run Limits to Subscription System

  1. Changes
    - Add max_manual_runs_per_month column to subscription_tiers
    - Add manual_runs_count column to usage_tracking
    - Update subscription tiers with manual run limits
    - Update get_user_tier_limits function to include manual runs
    - Update increment_usage function to handle manual_run type

  2. Manual Run Limits by Tier
    - Free: 0 manual runs (must wait for cron)
    - Pro: 50 manual runs per month
    - Enterprise: 200 manual runs per month
*/

-- Add max_manual_runs_per_month to subscription_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'max_manual_runs_per_month'
  ) THEN
    ALTER TABLE subscription_tiers 
    ADD COLUMN max_manual_runs_per_month integer DEFAULT 0;
  END IF;
END $$;

-- Update existing tiers with manual run limits
UPDATE subscription_tiers
SET max_manual_runs_per_month = 0
WHERE id = 'free';

UPDATE subscription_tiers
SET max_manual_runs_per_month = 50
WHERE id = 'pro';

UPDATE subscription_tiers
SET max_manual_runs_per_month = 200
WHERE id = 'enterprise';

-- Add manual_runs_count to usage_tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking' AND column_name = 'manual_runs_count'
  ) THEN
    ALTER TABLE usage_tracking 
    ADD COLUMN manual_runs_count integer DEFAULT 0;
  END IF;
END $$;

-- Drop and recreate get_user_tier_limits function with manual runs
DROP FUNCTION IF EXISTS get_user_tier_limits(uuid);

CREATE FUNCTION get_user_tier_limits(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  tier_id text,
  tier_name text,
  max_keywords integer,
  max_ai_analyses_per_month integer,
  max_leads_per_month integer,
  max_manual_runs_per_month integer,
  current_keywords integer,
  current_ai_analyses integer,
  current_leads integer,
  current_manual_runs integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.name,
    st.max_keywords,
    st.max_ai_analyses_per_month,
    st.max_leads_per_month,
    st.max_manual_runs_per_month,
    COALESCE(ut.keywords_count, 0)::integer,
    COALESCE(ut.ai_analyses_count, 0)::integer,
    COALESCE(ut.leads_discovered_count, 0)::integer,
    COALESCE(ut.manual_runs_count, 0)::integer
  FROM user_subscriptions us
  JOIN subscription_tiers st ON us.tier_id = st.id
  LEFT JOIN usage_tracking ut ON ut.user_id = us.user_id 
    AND ut.period_start <= now() 
    AND ut.period_end >= now()
  WHERE us.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can perform manual run
CREATE OR REPLACE FUNCTION check_manual_run_limit()
RETURNS boolean AS $$
DECLARE
  v_limit integer;
  v_current integer;
BEGIN
  SELECT max_manual_runs_per_month, current_manual_runs
  INTO v_limit, v_current
  FROM get_user_tier_limits();
  
  RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update increment_usage function to handle manual runs
CREATE OR REPLACE FUNCTION increment_usage(p_usage_type text, p_user_id uuid DEFAULT auth.uid())
RETURNS void AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + interval '1 month';
  
  INSERT INTO usage_tracking (user_id, period_start, period_end, keywords_count, ai_analyses_count, leads_discovered_count, manual_runs_count)
  VALUES (p_user_id, v_period_start, v_period_end, 0, 0, 0, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;
  
  IF p_usage_type = 'keyword' THEN
    UPDATE usage_tracking
    SET keywords_count = (
      SELECT COUNT(*) FROM monitored_keywords WHERE user_id = p_user_id
    ),
    updated_at = now()
    WHERE user_id = p_user_id 
      AND period_start = v_period_start;
      
  ELSIF p_usage_type = 'ai_analysis' THEN
    UPDATE usage_tracking
    SET ai_analyses_count = ai_analyses_count + 1,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND period_start = v_period_start;
      
  ELSIF p_usage_type = 'lead' THEN
    UPDATE usage_tracking
    SET leads_discovered_count = leads_discovered_count + 1,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND period_start = v_period_start;
      
  ELSIF p_usage_type = 'manual_run' THEN
    UPDATE usage_tracking
    SET manual_runs_count = manual_runs_count + 1,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND period_start = v_period_start;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;