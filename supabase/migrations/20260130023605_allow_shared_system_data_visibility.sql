/*
  # Allow Visibility of System/Shared Demo Data
  
  1. Problem
    - RLS policies were too restrictive
    - Users could only see their own data, but not shared system/demo data
    - Dashboard appeared empty for new users with no keywords yet
    
  2. Solution
    - Update policies to allow access to:
      a) User's own data (user_id = auth.uid())
      b) System/demo data (user_id IS NULL)
    - This provides a better onboarding experience with example data
    
  3. Security
    - User data remains private (users can only see their own)
    - Shared/system data is visible to all authenticated users
    - No cross-user data leakage
*/

-- Update monitored_keywords policy
DROP POLICY IF EXISTS "Users can read own keywords" ON monitored_keywords;

CREATE POLICY "Users can read own keywords" 
  ON monitored_keywords 
  FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid()  -- User's own keywords
    OR user_id IS NULL    -- System/demo keywords
  );

-- Update trend_scores policy
DROP POLICY IF EXISTS "Users can read own trend scores" ON trend_scores;

CREATE POLICY "Users can read own trend scores" 
  ON trend_scores 
  FOR SELECT 
  TO authenticated 
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords 
      WHERE user_id = auth.uid()  -- User's own data
         OR user_id IS NULL       -- System/demo data
    )
  );

-- Update related_topics policy
DROP POLICY IF EXISTS "Users can read own related topics" ON related_topics;

CREATE POLICY "Users can read own related topics" 
  ON related_topics 
  FOR SELECT 
  TO authenticated 
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords 
      WHERE user_id = auth.uid()
         OR user_id IS NULL
    )
  );

-- Update trend_analyses policy
DROP POLICY IF EXISTS "Users can read own trend analyses" ON trend_analyses;

CREATE POLICY "Users can read own trend analyses" 
  ON trend_analyses 
  FOR SELECT 
  TO authenticated 
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords 
      WHERE user_id = auth.uid()
         OR user_id IS NULL
    )
  );

-- Update trend_buckets policy
DROP POLICY IF EXISTS "Users can read own trend buckets" ON trend_buckets;

CREATE POLICY "Users can read own trend buckets" 
  ON trend_buckets 
  FOR SELECT 
  TO authenticated 
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords 
      WHERE user_id = auth.uid()
         OR user_id IS NULL
    )
  );

-- Update news_items policy
DROP POLICY IF EXISTS "Users can read own news items" ON news_items;

CREATE POLICY "Users can read own news items" 
  ON news_items 
  FOR SELECT 
  TO authenticated 
  USING (
    keyword_id IN (
      SELECT id FROM monitored_keywords 
      WHERE user_id = auth.uid()
         OR user_id IS NULL
    )
  );

-- Update leads policy
DROP POLICY IF EXISTS "Users can read own leads" ON leads;

CREATE POLICY "Users can read own leads" 
  ON leads 
  FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
  );

-- Update lead_candidates policy
DROP POLICY IF EXISTS "Users can read own lead candidates" ON lead_candidates;

CREATE POLICY "Users can read own lead candidates" 
  ON lead_candidates 
  FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
  );
