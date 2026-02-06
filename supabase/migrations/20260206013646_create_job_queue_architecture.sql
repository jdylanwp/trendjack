/*
  # Job Queue Architecture

  1. New Tables
    - `raw_ingest_queue`
      - `id` (uuid, primary key)
      - `source` (text) - 'reddit' or 'news'
      - `payload` (jsonb) - Raw JSON from external APIs
      - `status` (text) - 'pending', 'processing', 'completed', 'failed'
      - `attempts` (integer) - Number of processing attempts
      - `max_attempts` (integer) - Maximum retry attempts
      - `created_at` (timestamptz)
      - `processed_at` (timestamptz)
      - `error_message` (text)
      - `user_id` (uuid) - Owner of the ingestion job
      - `keyword_id` (uuid) - Associated keyword

  2. Indexes
    - Index on (status, created_at) for queue polling
    - Index on (source, status) for source-specific processing

  3. Functions
    - `claim_queue_batch` - Atomically claims N items from queue for processing
    - `complete_queue_item` - Marks item as completed
    - `fail_queue_item` - Marks item as failed with error

  4. Security
    - RLS enabled
    - Service role manages all queue operations
*/

CREATE TABLE IF NOT EXISTS raw_ingest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('reddit', 'news', 'entity')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword_id uuid REFERENCES monitored_keywords(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingest_queue_status_created
  ON raw_ingest_queue(status, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ingest_queue_source_status
  ON raw_ingest_queue(source, status);

ALTER TABLE raw_ingest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ingest queue"
  ON raw_ingest_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own queue items"
  ON raw_ingest_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION claim_queue_batch(
  p_source text,
  p_batch_size integer DEFAULT 10
)
RETURNS SETOF raw_ingest_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE raw_ingest_queue
  SET
    status = 'processing',
    attempts = attempts + 1
  WHERE id IN (
    SELECT q.id
    FROM raw_ingest_queue q
    WHERE q.source = p_source
      AND q.status = 'pending'
      AND q.attempts < q.max_attempts
    ORDER BY q.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION complete_queue_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE raw_ingest_queue
  SET
    status = 'completed',
    processed_at = now()
  WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION fail_queue_item(p_item_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE raw_ingest_queue
  SET
    status = CASE
      WHEN attempts >= max_attempts THEN 'failed'
      ELSE 'pending'
    END,
    error_message = p_error
  WHERE id = p_item_id;
END;
$$;
