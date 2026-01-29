/*
  # TrendJack Database Schema

  1. New Tables
    - `monitored_keywords`
      - `id` (uuid, primary key)
      - `keyword` (text, the search term)
      - `related_subreddit` (text, subreddit to monitor)
      - `enabled` (boolean, default true)
      - `created_at` (timestamptz)
    
    - `news_items` (Raw news ingestion with deduplication)
      - `id` (uuid, primary key)
      - `keyword_id` (uuid, foreign key to monitored_keywords)
      - `canonical_url` (text, normalized URL)
      - `url_hash` (text, hash for deduplication)
      - `title` (text)
      - `published_at` (timestamptz)
      - `fetched_at` (timestamptz)
      - `raw` (jsonb, complete RSS item)
      - UNIQUE constraint on `url_hash`
    
    - `trend_buckets` (Hourly aggregation)
      - `id` (uuid, primary key)
      - `keyword_id` (uuid, foreign key to monitored_keywords)
      - `bucket_start` (timestamptz, hour boundary)
      - `news_count` (integer, count of news items)
      - UNIQUE constraint on `keyword_id, bucket_start`
    
    - `trend_scores` (Calculated trend metrics for UI)
      - `id` (uuid, primary key)
      - `keyword_id` (uuid, foreign key to monitored_keywords)
      - `window_hours` (integer, default 24)
      - `heat_score` (numeric, trend strength)
      - `baseline` (jsonb, baseline metrics)
      - `is_trending` (boolean, trending flag)
      - `calculated_at` (timestamptz)
    
    - `reddit_posts` (Raw Reddit ingestion with deduplication)
      - `id` (uuid, primary key)
      - `subreddit` (text)
      - `canonical_url` (text, normalized URL)
      - `url_hash` (text, hash for deduplication)
      - `title` (text)
      - `body` (text, truncated to 1000 chars)
      - `author` (text)
      - `flair` (text)
      - `created_at` (timestamptz, Reddit post time)
      - `fetched_at` (timestamptz, ingestion time)
      - `raw` (jsonb, complete post data)
      - UNIQUE constraint on `url_hash`
    
    - `lead_candidates` (Prefilter stage)
      - `id` (uuid, primary key)
      - `keyword_id` (uuid, foreign key to monitored_keywords)
      - `reddit_post_id` (uuid, foreign key to reddit_posts)
      - `reason` (text, why it matched prefilter)
      - `created_at` (timestamptz)
      - UNIQUE constraint on `keyword_id, reddit_post_id`
    
    - `leads` (Final dashboard view with AI scoring)
      - `id` (uuid, primary key)
      - `keyword_id` (uuid, foreign key to monitored_keywords)
      - `reddit_post_id` (uuid, foreign key to reddit_posts)
      - `intent_score` (integer, 0-100)
      - `pain_point` (text, AI-extracted pain point)
      - `suggested_reply` (text, AI-generated reply)
      - `ai_analysis` (jsonb, complete AI response)
      - `status` (text, default 'new')
      - `created_at` (timestamptz)
      - UNIQUE constraint on `reddit_post_id`

  2. Indexes
    - Foreign key indexes for query performance
    - Time-based indexes for fetched_at and created_at columns
    - Hash indexes for deduplication lookups

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read all data
    - Add policies for service role to write data (Edge Functions)
*/

-- Create monitored_keywords table
CREATE TABLE IF NOT EXISTS monitored_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  related_subreddit text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create news_items table with deduplication
CREATE TABLE IF NOT EXISTS news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  canonical_url text NOT NULL,
  url_hash text NOT NULL,
  title text NOT NULL,
  published_at timestamptz NOT NULL,
  fetched_at timestamptz DEFAULT now() NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(url_hash)
);

-- Create trend_buckets table for hourly aggregation
CREATE TABLE IF NOT EXISTS trend_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  news_count integer DEFAULT 0 NOT NULL,
  UNIQUE(keyword_id, bucket_start)
);

-- Create trend_scores table
CREATE TABLE IF NOT EXISTS trend_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  window_hours integer DEFAULT 24 NOT NULL,
  heat_score numeric NOT NULL,
  baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_trending boolean DEFAULT false NOT NULL,
  calculated_at timestamptz DEFAULT now() NOT NULL
);

-- Create reddit_posts table with deduplication
CREATE TABLE IF NOT EXISTS reddit_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit text NOT NULL,
  canonical_url text NOT NULL,
  url_hash text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  author text NOT NULL,
  flair text,
  created_at timestamptz NOT NULL,
  fetched_at timestamptz DEFAULT now() NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(url_hash)
);

-- Create lead_candidates table
CREATE TABLE IF NOT EXISTS lead_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  reddit_post_id uuid NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(keyword_id, reddit_post_id)
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES monitored_keywords(id) ON DELETE CASCADE,
  reddit_post_id uuid NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
  intent_score integer NOT NULL,
  pain_point text NOT NULL,
  suggested_reply text NOT NULL,
  ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'new' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(reddit_post_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_items_keyword_id ON news_items(keyword_id);
CREATE INDEX IF NOT EXISTS idx_news_items_fetched_at ON news_items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_news_items_url_hash ON news_items(url_hash);

CREATE INDEX IF NOT EXISTS idx_trend_buckets_keyword_id ON trend_buckets(keyword_id);
CREATE INDEX IF NOT EXISTS idx_trend_buckets_bucket_start ON trend_buckets(bucket_start);

CREATE INDEX IF NOT EXISTS idx_trend_scores_keyword_id ON trend_scores(keyword_id);
CREATE INDEX IF NOT EXISTS idx_trend_scores_is_trending ON trend_scores(is_trending);
CREATE INDEX IF NOT EXISTS idx_trend_scores_calculated_at ON trend_scores(calculated_at);

CREATE INDEX IF NOT EXISTS idx_reddit_posts_subreddit ON reddit_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_created_at ON reddit_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_fetched_at ON reddit_posts(fetched_at);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_url_hash ON reddit_posts(url_hash);

CREATE INDEX IF NOT EXISTS idx_lead_candidates_keyword_id ON lead_candidates(keyword_id);
CREATE INDEX IF NOT EXISTS idx_lead_candidates_reddit_post_id ON lead_candidates(reddit_post_id);

CREATE INDEX IF NOT EXISTS idx_leads_keyword_id ON leads(keyword_id);
CREATE INDEX IF NOT EXISTS idx_leads_reddit_post_id ON leads(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_leads_intent_score ON leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE monitored_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read all data
CREATE POLICY "Users can read monitored keywords"
  ON monitored_keywords FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read news items"
  ON news_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read trend buckets"
  ON trend_buckets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read trend scores"
  ON trend_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read reddit posts"
  ON reddit_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read lead candidates"
  ON lead_candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: Allow service role (Edge Functions) to insert/update
CREATE POLICY "Service role can insert monitored keywords"
  ON monitored_keywords FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert news items"
  ON news_items FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert trend buckets"
  ON trend_buckets FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update trend buckets"
  ON trend_buckets FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can insert trend scores"
  ON trend_scores FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert reddit posts"
  ON reddit_posts FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert lead candidates"
  ON lead_candidates FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert leads"
  ON leads FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS Policies: Allow authenticated users to update lead status
CREATE POLICY "Users can update lead status"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);