/*
  # Fix Security and Performance Issues
  
  This migration addresses multiple security and performance issues identified by Supabase:
  
  ## 1. Missing Indexes on Foreign Keys
  - Add index on `entity_trackers.global_entity_id`
  - Add index on `user_subscriptions.tier_id`
  
  ## 2. RLS Policy Optimization
  - Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
  - This prevents re-evaluation of auth function for each row
  
  ## 3. Remove Duplicate RLS Policies
  - Remove redundant policies that create multiple permissive rules
  - Keep the more descriptive policy name
  
  ## 4. Function Security
  - Set search_path on all security definer functions
  - This prevents search_path injection attacks
  
  ## 5. Cleanup Unused Indexes
  - Document unused indexes for potential future removal
*/

-- =====================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_entity_trackers_global_entity_id 
  ON entity_trackers(global_entity_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier_id 
  ON user_subscriptions(tier_id);

-- =====================================================
-- 2. REMOVE DUPLICATE RLS POLICIES
-- =====================================================

-- lead_candidates: Remove "Users can view own lead candidates" (keeping "Users can read own lead candidates")
DROP POLICY IF EXISTS "Users can view own lead candidates" ON lead_candidates;

-- leads: Remove "Users can view own leads" (keeping "Users can read own leads")
DROP POLICY IF EXISTS "Users can view own leads" ON leads;

-- related_topics: Remove "Users can read own related topics" (keeping "Public can read related topics")
DROP POLICY IF EXISTS "Users can read own related topics" ON related_topics;

-- trend_analyses: Remove "Users can read own trend analyses" (keeping "Public can read trend analyses")
DROP POLICY IF EXISTS "Users can read own trend analyses" ON trend_analyses;

-- trend_buckets: Remove "Users can read own trend buckets" (keeping "Authenticated users can read trend buckets")
DROP POLICY IF EXISTS "Users can read own trend buckets" ON trend_buckets;

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES - REPLACE auth.uid() WITH (select auth.uid())
-- =====================================================

-- monitored_keywords policies
DROP POLICY IF EXISTS "Users can read own keywords" ON monitored_keywords;
CREATE POLICY "Users can read own keywords"
  ON monitored_keywords FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own keywords" ON monitored_keywords;
CREATE POLICY "Users can insert own keywords"
  ON monitored_keywords FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own keywords" ON monitored_keywords;
CREATE POLICY "Users can update own keywords"
  ON monitored_keywords FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own keywords" ON monitored_keywords;
CREATE POLICY "Users can delete own keywords"
  ON monitored_keywords FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- lead_candidates policies
DROP POLICY IF EXISTS "Users can read own lead candidates" ON lead_candidates;
CREATE POLICY "Users can read own lead candidates"
  ON lead_candidates FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- leads policies
DROP POLICY IF EXISTS "Users can read own leads" ON leads;
CREATE POLICY "Users can read own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own lead status" ON leads;
CREATE POLICY "Users can update own lead status"
  ON leads FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_settings policies
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- entity_trackers policies
DROP POLICY IF EXISTS "Users can view own tracked entities" ON entity_trackers;
CREATE POLICY "Users can view own tracked entities"
  ON entity_trackers FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can track entities" ON entity_trackers;
CREATE POLICY "Users can track entities"
  ON entity_trackers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can untrack entities" ON entity_trackers;
CREATE POLICY "Users can untrack entities"
  ON entity_trackers FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- usage_tracking policy
DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- reddit_posts policy
DROP POLICY IF EXISTS "Users can read reddit posts" ON reddit_posts;
CREATE POLICY "Users can read reddit posts"
  ON reddit_posts FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT reddit_post_id FROM lead_candidates
      WHERE user_id = (select auth.uid())
    )
  );

-- trend_scores policy
DROP POLICY IF EXISTS "Users can read own trend scores" ON trend_scores;
CREATE POLICY "Users can read own trend scores"
  ON trend_scores FOR SELECT
  TO authenticated
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords
      WHERE user_id = (select auth.uid()) OR user_id IS NULL
    )
  );

-- news_items policy
DROP POLICY IF EXISTS "Users can read own news items" ON news_items;
CREATE POLICY "Users can read own news items"
  ON news_items FOR SELECT
  TO authenticated
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords
      WHERE user_id = (select auth.uid()) OR user_id IS NULL
    )
  );

-- =====================================================
-- 4. SET SEARCH_PATH ON SECURITY DEFINER FUNCTIONS
-- =====================================================

ALTER FUNCTION upsert_related_topic SET search_path = public, pg_temp;
ALTER FUNCTION handle_new_user SET search_path = public, pg_temp;
ALTER FUNCTION check_keyword_limit SET search_path = public, pg_temp;
ALTER FUNCTION check_ai_analysis_limit SET search_path = public, pg_temp;
ALTER FUNCTION update_keyword_usage SET search_path = public, pg_temp;
ALTER FUNCTION get_user_tier_limits SET search_path = public, pg_temp;
ALTER FUNCTION check_manual_run_limit SET search_path = public, pg_temp;
ALTER FUNCTION update_global_entity_timestamp SET search_path = public, pg_temp;
ALTER FUNCTION attempt_usage_reservation SET search_path = public, pg_temp;
ALTER FUNCTION increment_usage SET search_path = public, pg_temp;
ALTER FUNCTION invoke_edge_function SET search_path = public, pg_temp;
