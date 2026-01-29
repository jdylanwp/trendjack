/*
  # Trend Analysis Cache

  1. Purpose
    - Store AI-generated trend analyses to avoid redundant API calls
    - Track which topics have been analyzed and when
    - Provide historical context for trend evolution

  2. New Table: trend_analyses
    - Stores the AI-generated summaries for keyword/topic combinations
    - Caches results for 24 hours to reduce API costs
    - Links to both the keyword and the specific topic being analyzed

  3. Security
    - Enable RLS on trend_analyses
    - Public read access for dashboard display
    - Service role write access for the analyze_trend function
*/

CREATE TABLE IF NOT EXISTS trend_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  topic text,
  summary text[] NOT NULL,
  confidence text NOT NULL DEFAULT 'medium',
  news_count integer NOT NULL DEFAULT 0,
  time_range text NOT NULL DEFAULT '48h',
  analyzed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trend_analyses_keyword ON trend_analyses(keyword_id);
CREATE INDEX IF NOT EXISTS idx_trend_analyses_topic ON trend_analyses(topic);
CREATE INDEX IF NOT EXISTS idx_trend_analyses_recency ON trend_analyses(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_analyses_lookup ON trend_analyses(keyword_id, topic, analyzed_at DESC);

ALTER TABLE trend_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read trend analyses"
  ON trend_analyses FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage trend analyses"
  ON trend_analyses FOR ALL
  TO service_role
  USING (true);