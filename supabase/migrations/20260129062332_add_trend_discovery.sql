/*
  # Trend Prediction Engine Schema
  
  1. Purpose
    - Transform TrendJack into a prediction engine that discovers emerging topics
    - Track "explosive" topics before they become mainstream
    - Build proprietary dataset of word velocity alongside monitored keywords
  
  2. New Table: related_topics
    - Stores discovered words from news items (e.g., finding "Chargebacks" when monitoring "Shopify")
    - Tracks frequency_count to measure volume
    - Tracks last_seen_at to measure recency
    - Uses unique constraint to prevent duplicate keyword+topic pairs
  
  3. New Function: upsert_related_topic
    - Atomic function to increment counts efficiently without race conditions
    - Critical for high-volume ingestion
  
  4. Updates: trend_scores table
    - Adds z_score field to detect "hockey stick" growth patterns
    - Adds standard_deviation field for statistical baseline
    
  5. Security
    - Enable RLS on related_topics
    - Public read access for dashboard display
    - Service role write access for background functions
*/

-- 1. Create the repository for discovered words
CREATE TABLE IF NOT EXISTS related_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  topic text NOT NULL,
  frequency_count integer DEFAULT 1 NOT NULL,
  first_seen_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  -- Ensure we don't have duplicate rows for the same keyword+topic pair
  UNIQUE(keyword_id, topic)
);

-- Indexes for fast retrieval of "Hot" topics
CREATE INDEX IF NOT EXISTS idx_related_topics_count ON related_topics(frequency_count DESC);
CREATE INDEX IF NOT EXISTS idx_related_topics_recency ON related_topics(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_related_topics_keyword ON related_topics(keyword_id);

-- 2. Add the "Explosive" metrics to the score table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trend_scores' AND column_name = 'z_score'
  ) THEN
    ALTER TABLE trend_scores ADD COLUMN z_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trend_scores' AND column_name = 'standard_deviation'
  ) THEN
    ALTER TABLE trend_scores ADD COLUMN standard_deviation numeric;
  END IF;
END $$;

-- 3. The "Atomic Increment" Function (Critical for high-volume ingestion)
CREATE OR REPLACE FUNCTION upsert_related_topic(
  p_keyword_id uuid,
  p_topic text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO related_topics (keyword_id, topic, frequency_count, last_seen_at)
  VALUES (p_keyword_id, p_topic, 1, now())
  ON CONFLICT (keyword_id, topic)
  DO UPDATE SET
    frequency_count = related_topics.frequency_count + 1,
    last_seen_at = now();
END;
$$;

-- Security Policies (Service Role only for writing)
ALTER TABLE related_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read related topics"
  ON related_topics FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage related topics"
  ON related_topics FOR ALL
  TO service_role
  USING (true);