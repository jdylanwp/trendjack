/*
  # Implement User Authentication and Row Level Security

  1. Purpose
    - Lock down database to authenticated users only
    - Implement user-specific data isolation
    - Each user manages their own keywords, settings, and leads
    - Prevent unauthorized access to sensitive data

  2. Changes
    - Add user_id columns to user-specific tables
    - Drop all public (anon) access policies
    - Create strict authenticated-only policies
    - Link data to auth.uid() for proper isolation

  3. User-Specific Tables
    - monitored_keywords: Each user manages their own keywords
    - user_settings: Each user has their own settings
    - leads: Users see only leads from their keywords
    - lead_candidates: Users see only candidates from their keywords

  4. Global Tables (Read by all authenticated users)
    - news_items: Global news data (written by service role)
    - trend_buckets: Global trend aggregation (written by service role)
    - trend_scores: Global trend calculations (written by service role)
    - reddit_posts: Global Reddit data (written by service role)

  5. Security Model
    - All SELECT operations require authentication
    - Users can only modify their own data
    - Edge functions use service_role to write global data
    - Edge functions check user_id when creating user-specific records
*/

-- Add user_id column to monitored_keywords
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitored_keywords' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE monitored_keywords ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_monitored_keywords_user_id ON monitored_keywords(user_id);
  END IF;
END $$;

-- Add user_id column to user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
  END IF;
END $$;

-- Add user_id column to leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_leads_user_id ON leads(user_id);
  END IF;
END $$;

-- Add user_id column to lead_candidates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_candidates' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE lead_candidates ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_lead_candidates_user_id ON lead_candidates(user_id);
  END IF;
END $$;

-- Drop all existing public (anon) policies
DROP POLICY IF EXISTS "Public can read monitored keywords" ON monitored_keywords;
DROP POLICY IF EXISTS "Public can insert monitored keywords" ON monitored_keywords;
DROP POLICY IF EXISTS "Public can delete monitored keywords" ON monitored_keywords;
DROP POLICY IF EXISTS "Public can read news items" ON news_items;
DROP POLICY IF EXISTS "Public can read trend buckets" ON trend_buckets;
DROP POLICY IF EXISTS "Public can read trend scores" ON trend_scores;
DROP POLICY IF EXISTS "Public can read reddit posts" ON reddit_posts;
DROP POLICY IF EXISTS "Public can read lead candidates" ON lead_candidates;
DROP POLICY IF EXISTS "Public can read leads" ON leads;
DROP POLICY IF EXISTS "Public can read user settings" ON user_settings;
DROP POLICY IF EXISTS "Public can update user settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update lead status" ON leads;

-- MONITORED KEYWORDS: User-specific policies
CREATE POLICY "Users can view own keywords"
  ON monitored_keywords FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own keywords"
  ON monitored_keywords FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own keywords"
  ON monitored_keywords FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own keywords"
  ON monitored_keywords FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NEWS ITEMS: Global read access for authenticated users
CREATE POLICY "Authenticated users can read news items"
  ON news_items FOR SELECT
  TO authenticated
  USING (true);

-- TREND BUCKETS: Global read access for authenticated users
CREATE POLICY "Authenticated users can read trend buckets"
  ON trend_buckets FOR SELECT
  TO authenticated
  USING (true);

-- TREND SCORES: Global read access for authenticated users
CREATE POLICY "Authenticated users can read trend scores"
  ON trend_scores FOR SELECT
  TO authenticated
  USING (true);

-- REDDIT POSTS: Global read access for authenticated users
CREATE POLICY "Authenticated users can read reddit posts"
  ON reddit_posts FOR SELECT
  TO authenticated
  USING (true);

-- LEAD CANDIDATES: User-specific access
CREATE POLICY "Users can view own lead candidates"
  ON lead_candidates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- LEADS: User-specific access
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own lead status"
  ON leads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- USER SETTINGS: User-specific access
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- SERVICE ROLE: Maintain existing service role policies for edge functions
-- (These policies already exist from previous migrations and remain unchanged)

-- Update the default user_settings row to remove hardcoded ID
DELETE FROM user_settings WHERE id = '00000000-0000-0000-0000-000000000001';

-- Create a function to initialize user settings on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_settings (user_id, offer_context, updated_at)
  VALUES (NEW.id, '', now());
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create settings for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();