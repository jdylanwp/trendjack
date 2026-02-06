/*
  # Time-Based Archival and Performance Indexes

  Since existing tables with data cannot be converted to partitioned tables
  without risk of data loss, this migration:

  1. New Tables
    - `news_items_archive` - Archive storage for old news items
    - `reddit_posts_archive` - Archive storage for old Reddit posts

  2. New Indexes
    - Composite index on reddit_posts(created_at, subreddit) for time-range queries
    - Composite index on news_items(published_at, keyword_id) for time-range queries
    - BRIN index on reddit_posts(created_at) for efficient range scans on large tables
    - BRIN index on news_items(published_at) for efficient range scans on large tables

  3. Functions
    - `archive_old_data` - Moves data older than N days to archive tables
    - Cron job to auto-archive data older than 90 days (runs daily)

  4. Security
    - RLS on archive tables
    - Only service_role can manage archive data
*/

CREATE TABLE IF NOT EXISTS news_items_archive (LIKE news_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS reddit_posts_archive (LIKE reddit_posts INCLUDING ALL);

ALTER TABLE news_items_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_posts_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages news archive"
  ON news_items_archive FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages reddit archive"
  ON reddit_posts_archive FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reddit_posts_created_at_sub
  ON reddit_posts(created_at DESC, subreddit);

CREATE INDEX IF NOT EXISTS idx_news_items_published_at_kw
  ON news_items(published_at DESC, keyword_id);

CREATE INDEX IF NOT EXISTS idx_reddit_posts_brin_created
  ON reddit_posts USING brin(created_at);

CREATE INDEX IF NOT EXISTS idx_news_items_brin_published
  ON news_items USING brin(published_at);

CREATE OR REPLACE FUNCTION archive_old_data(p_days_threshold integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date timestamptz;
  news_archived bigint;
  reddit_archived bigint;
BEGIN
  cutoff_date := now() - (p_days_threshold || ' days')::interval;

  WITH moved AS (
    INSERT INTO news_items_archive
    SELECT * FROM news_items WHERE published_at < cutoff_date
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO news_archived FROM moved;

  WITH moved AS (
    INSERT INTO reddit_posts_archive
    SELECT * FROM reddit_posts WHERE created_at < cutoff_date
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO reddit_archived FROM moved;

  RETURN jsonb_build_object(
    'news_archived', news_archived,
    'reddit_archived', reddit_archived,
    'cutoff_date', cutoff_date
  );
END;
$$;

SELECT cron.schedule(
  'archive-old-data-daily',
  '0 3 * * *',
  $$SELECT archive_old_data(90)$$
);
