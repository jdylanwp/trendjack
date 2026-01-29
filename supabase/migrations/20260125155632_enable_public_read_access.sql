/*
  # Enable Public Read Access for Dashboard

  1. Purpose
    - Allow anonymous (unauthenticated) users to read data from the dashboard
    - Frontend uses VITE_SUPABASE_ANON_KEY which has 'anon' role
    - This enables the React dashboard to display trends and leads

  2. Security Notes
    - Only SELECT (read) operations are granted to public
    - INSERT/UPDATE/DELETE remain restricted to service_role
    - Data is not sensitive - it's aggregated trends and Reddit posts
    - Users can still manage lead status when authenticated

  3. Tables Updated
    - monitored_keywords: Allow public to read keyword list
    - trend_scores: Allow public to read trend calculations
    - leads: Allow public to read lead data
    - reddit_posts: Allow public to read post details (for lead context)
*/

-- Drop existing authenticated-only SELECT policies
DROP POLICY IF EXISTS "Users can read monitored keywords" ON monitored_keywords;
DROP POLICY IF EXISTS "Users can read news items" ON news_items;
DROP POLICY IF EXISTS "Users can read trend buckets" ON trend_buckets;
DROP POLICY IF EXISTS "Users can read trend scores" ON trend_scores;
DROP POLICY IF EXISTS "Users can read reddit posts" ON reddit_posts;
DROP POLICY IF EXISTS "Users can read lead candidates" ON lead_candidates;
DROP POLICY IF EXISTS "Users can read leads" ON leads;

-- Create new policies allowing public (anon) read access
CREATE POLICY "Public can read monitored keywords"
  ON monitored_keywords FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read news items"
  ON news_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read trend buckets"
  ON trend_buckets FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read trend scores"
  ON trend_scores FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read reddit posts"
  ON reddit_posts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read lead candidates"
  ON lead_candidates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read leads"
  ON leads FOR SELECT
  TO anon, authenticated
  USING (true);

-- Keep authenticated user ability to update lead status
-- (Already exists from previous migration)