/*
  # Fix Multi-User Data Isolation and Security

  1. Critical Fixes
    - Fix data collision: Change unique constraints to scope by keyword_id
    - Fix privacy leak: Update RLS policies to check ownership
    - Add batching support: Add last_fetched_at for pagination

  2. Changes
    - Drop global url_hash unique constraints
    - Add composite unique constraints (keyword_id, url_hash)
    - Update RLS policies to check ownership via monitored_keywords
    - Add last_fetched_at timestamp to monitored_keywords
    - Add indexes for performance

  3. Security Improvements
    - Users can only see their own news items
    - Users can only see their own trend scores
    - Users can only see their own lead candidates
*/

-- Add last_fetched_at for batching support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitored_keywords' AND column_name = 'last_fetched_at'
  ) THEN
    ALTER TABLE monitored_keywords 
    ADD COLUMN last_fetched_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Fix news_items unique constraint (data collision bug)
ALTER TABLE news_items DROP CONSTRAINT IF EXISTS news_items_url_hash_key;
ALTER TABLE news_items DROP CONSTRAINT IF EXISTS news_items_keyword_url_unique;
ALTER TABLE news_items ADD CONSTRAINT news_items_keyword_url_unique UNIQUE (keyword_id, url_hash);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_news_items_keyword_id ON news_items(keyword_id);
CREATE INDEX IF NOT EXISTS idx_monitored_keywords_last_fetched ON monitored_keywords(last_fetched_at) WHERE enabled = true;

-- Fix RLS policies for news_items (privacy leak)
DROP POLICY IF EXISTS "Authenticated users can read news items" ON news_items;
DROP POLICY IF EXISTS "Users can read own news items" ON news_items;

CREATE POLICY "Users can read own news items" 
ON news_items FOR SELECT 
TO authenticated 
USING (
  keyword_id IN (
    SELECT id FROM monitored_keywords WHERE user_id = auth.uid()
  )
);

-- Fix RLS policies for trend_scores (privacy leak)
DROP POLICY IF EXISTS "Authenticated users can read trend scores" ON trend_scores;
DROP POLICY IF EXISTS "Users can read own trend scores" ON trend_scores;

CREATE POLICY "Users can read own trend scores" 
ON trend_scores FOR SELECT 
TO authenticated 
USING (
  keyword_id IN (
    SELECT id FROM monitored_keywords WHERE user_id = auth.uid()
  )
);

-- Fix RLS policies for lead_candidates (privacy leak)
DROP POLICY IF EXISTS "Authenticated users can read lead candidates" ON lead_candidates;
DROP POLICY IF EXISTS "Users can read own lead candidates" ON lead_candidates;

CREATE POLICY "Users can read own lead candidates" 
ON lead_candidates FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Fix RLS policies for reddit_posts (already ok, but let's ensure)
DROP POLICY IF EXISTS "Authenticated users can read reddit posts" ON reddit_posts;
DROP POLICY IF EXISTS "Users can read reddit posts" ON reddit_posts;

CREATE POLICY "Users can read reddit posts" 
ON reddit_posts FOR SELECT 
TO authenticated 
USING (
  id IN (
    SELECT reddit_post_id FROM lead_candidates WHERE user_id = auth.uid()
  )
);

-- Ensure monitored_keywords policies are correct
DROP POLICY IF EXISTS "Users can view own keywords" ON monitored_keywords;
DROP POLICY IF EXISTS "Users can read own keywords" ON monitored_keywords;

CREATE POLICY "Users can read own keywords" 
ON monitored_keywords FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());