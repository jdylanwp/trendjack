/*
  # Add Subscription and Monetization System

  1. New Tables
    - subscription_tiers: Defines available subscription plans
    - user_subscriptions: Tracks user subscription status
    - usage_tracking: Tracks per-user usage for limits

  2. Functions
    - get_user_tier_limits: Returns limits for current user
    - check_keyword_limit: Validates keyword quota
    - check_ai_analysis_limit: Validates AI analysis quota
    - increment_usage: Increments usage counters
    
  3. Security
    - Enable RLS on all tables
    - Users can only read their own data
*/

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  price_monthly numeric DEFAULT 0,
  price_yearly numeric DEFAULT 0,
  max_keywords integer NOT NULL,
  max_ai_analyses_per_month integer NOT NULL,
  max_leads_per_month integer NOT NULL,
  data_refresh_minutes integer DEFAULT 60,
  features jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert default tiers
INSERT INTO subscription_tiers (id, name, description, price_monthly, price_yearly, max_keywords, max_ai_analyses_per_month, max_leads_per_month, data_refresh_minutes, features, sort_order)
VALUES
  ('free', 'Free', 'Perfect for trying out TrendJack', 0, 0, 3, 10, 50, 60, '["Basic Reddit monitoring", "Manual trend analysis", "Email support"]'::jsonb, 1),
  ('pro', 'Pro', 'For serious marketers and agencies', 29, 290, 25, 200, 500, 15, '["Advanced AI analysis", "Priority data refresh", "Webhook integration", "Priority support", "Custom alerts"]'::jsonb, 2),
  ('enterprise', 'Enterprise', 'Custom solution for large teams', 99, 990, 100, 1000, 5000, 5, '["Unlimited keywords", "Real-time monitoring", "Dedicated account manager", "Custom integrations", "SLA guarantee", "White-label options"]'::jsonb, 3)
ON CONFLICT (id) DO NOTHING;

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id text NOT NULL REFERENCES subscription_tiers(id) DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '1 month'),
  cancel_at_period_end boolean DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'expired', 'trialing'))
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  keywords_count integer DEFAULT 0,
  ai_analyses_count integer DEFAULT 0,
  leads_discovered_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period_start)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to get user tier limits
CREATE OR REPLACE FUNCTION get_user_tier_limits(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  tier_id text,
  tier_name text,
  max_keywords integer,
  max_ai_analyses_per_month integer,
  max_leads_per_month integer,
  current_keywords integer,
  current_ai_analyses integer,
  current_leads integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.name,
    st.max_keywords,
    st.max_ai_analyses_per_month,
    st.max_leads_per_month,
    COALESCE(ut.keywords_count, 0)::integer,
    COALESCE(ut.ai_analyses_count, 0)::integer,
    COALESCE(ut.leads_discovered_count, 0)::integer
  FROM user_subscriptions us
  JOIN subscription_tiers st ON us.tier_id = st.id
  LEFT JOIN usage_tracking ut ON ut.user_id = us.user_id 
    AND ut.period_start <= now() 
    AND ut.period_end >= now()
  WHERE us.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can add keyword
CREATE OR REPLACE FUNCTION check_keyword_limit()
RETURNS boolean AS $$
DECLARE
  v_limit integer;
  v_current integer;
BEGIN
  SELECT max_keywords, current_keywords
  INTO v_limit, v_current
  FROM get_user_tier_limits();
  
  RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can perform AI analysis
CREATE OR REPLACE FUNCTION check_ai_analysis_limit()
RETURNS boolean AS $$
DECLARE
  v_limit integer;
  v_current integer;
BEGIN
  SELECT max_ai_analyses_per_month, current_ai_analyses
  INTO v_limit, v_current
  FROM get_user_tier_limits();
  
  RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(p_usage_type text, p_user_id uuid DEFAULT auth.uid())
RETURNS void AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + interval '1 month';
  
  INSERT INTO usage_tracking (user_id, period_start, period_end, keywords_count, ai_analyses_count, leads_discovered_count)
  VALUES (p_user_id, v_period_start, v_period_end, 0, 0, 0)
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, tier_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO usage_tracking (
    user_id, 
    period_start, 
    period_end,
    keywords_count,
    ai_analyses_count,
    leads_discovered_count
  )
  VALUES (
    NEW.id,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month',
    0,
    0,
    0
  )
  ON CONFLICT (user_id, period_start) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();

-- Trigger to update keywords count when keywords change
CREATE OR REPLACE FUNCTION update_keyword_usage()
RETURNS trigger AS $$
BEGIN
  PERFORM increment_usage('keyword', COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_keyword_change ON monitored_keywords;
CREATE TRIGGER on_keyword_change
  AFTER INSERT OR DELETE ON monitored_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_keyword_usage();