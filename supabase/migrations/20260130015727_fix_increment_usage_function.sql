/*
  # Fix increment_usage function to use new subscription system
  
  1. Problem
    - The increment_usage function was referencing old "subscriptions" table
    - Causing "relation 'subscriptions' does not exist" error when adding keywords
    
  2. Solution
    - Update function to use new user_subscriptions and subscription_tiers tables
    - Remove hardcoded tier limits and use tier definitions from subscription_tiers table
    - Use get_user_tier_limits() RPC for consistent limit checking
    
  3. Changes
    - Replace "subscriptions" table references with proper joins to user_subscriptions/subscription_tiers
    - Streamline logic to use the tier system already in place
*/

CREATE OR REPLACE FUNCTION increment_usage(p_usage_type text, p_user_id uuid DEFAULT auth.uid())
RETURNS void AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_current_usage integer;
  v_max_usage integer;
BEGIN
  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + interval '1 month';
  
  -- Ensure usage_tracking record exists
  INSERT INTO usage_tracking (user_id, period_start, period_end, keywords_count, ai_analyses_count, leads_discovered_count, manual_runs_count)
  VALUES (p_user_id, v_period_start, v_period_end, 0, 0, 0, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;
  
  -- Special handling for 'keyword' type (count-based, not incremental)
  IF p_usage_type = 'keyword' THEN
    -- Get max keywords from tier
    SELECT st.max_keywords
    INTO v_max_usage
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    WHERE us.user_id = p_user_id;
    
    -- Default to free tier if no subscription found
    IF v_max_usage IS NULL THEN
      v_max_usage := 3;
    END IF;
    
    -- Count current keywords
    SELECT COUNT(*)
    INTO v_current_usage
    FROM monitored_keywords
    WHERE user_id = p_user_id;
    
    -- Check limit before updating
    IF v_current_usage > v_max_usage THEN
      RAISE EXCEPTION 'Keyword limit exceeded: % / % allowed', v_current_usage, v_max_usage;
    END IF;
    
    -- Update the count
    UPDATE usage_tracking
    SET keywords_count = v_current_usage,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND period_start = v_period_start;
    RETURN;
  END IF;
  
  -- For other usage types, get limits from tier
  IF p_usage_type = 'ai_analysis' THEN
    SELECT 
      st.max_ai_analyses_per_month,
      ut.ai_analyses_count
    INTO v_max_usage, v_current_usage
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    LEFT JOIN usage_tracking ut ON ut.user_id = us.user_id AND ut.period_start = v_period_start
    WHERE us.user_id = p_user_id;
    
    -- Default to free tier limits
    v_max_usage := COALESCE(v_max_usage, 10);
    v_current_usage := COALESCE(v_current_usage, 0);
    
  ELSIF p_usage_type = 'lead' THEN
    SELECT 
      st.max_leads_per_month,
      ut.leads_discovered_count
    INTO v_max_usage, v_current_usage
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    LEFT JOIN usage_tracking ut ON ut.user_id = us.user_id AND ut.period_start = v_period_start
    WHERE us.user_id = p_user_id;
    
    -- Default to free tier limits
    v_max_usage := COALESCE(v_max_usage, 50);
    v_current_usage := COALESCE(v_current_usage, 0);
    
  ELSIF p_usage_type = 'manual_run' THEN
    SELECT 
      st.max_manual_runs_per_month,
      ut.manual_runs_count
    INTO v_max_usage, v_current_usage
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    LEFT JOIN usage_tracking ut ON ut.user_id = us.user_id AND ut.period_start = v_period_start
    WHERE us.user_id = p_user_id;
    
    -- Default to free tier limits  
    v_max_usage := COALESCE(v_max_usage, 0);
    v_current_usage := COALESCE(v_current_usage, 0);
    
  ELSE
    RAISE EXCEPTION 'Unknown usage type: %', p_usage_type;
  END IF;
  
  -- Check if incrementing would exceed limit
  IF v_current_usage >= v_max_usage THEN
    RAISE EXCEPTION '% limit exceeded: % / % allowed', 
      p_usage_type, v_current_usage, v_max_usage;
  END IF;
  
  -- Safe to increment
  IF p_usage_type = 'ai_analysis' THEN
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
