/*
  # Error Dead Letter Queue (DLQ)

  1. New Tables
    - `failed_jobs`
      - `id` (uuid, primary key)
      - `job_type` (text) - 'lead_score', 'trend_fetch', 'reddit_fetch', 'entity_extract', etc.
      - `payload` (jsonb) - Original job data for replay
      - `error_message` (text) - Error description
      - `error_stack` (text) - Stack trace if available
      - `retry_count` (integer) - Number of retries attempted
      - `max_retries` (integer) - Maximum retries allowed
      - `next_retry_at` (timestamptz) - When to retry next (exponential backoff)
      - `status` (text) - 'pending_retry', 'retrying', 'exhausted', 'resolved'
      - `created_at` (timestamptz)
      - `resolved_at` (timestamptz)
      - `user_id` (uuid)

  2. Functions
    - `enqueue_failed_job` - Inserts a failed job with exponential backoff scheduling
    - `claim_retry_batch` - Claims jobs ready for retry
    - `resolve_failed_job` - Marks a failed job as resolved

  3. Cron
    - Scheduled job to process retries every 5 minutes

  4. Security
    - RLS enabled
    - Users can view their own failed jobs
    - Service role manages all operations
*/

CREATE TABLE IF NOT EXISTS failed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NOT NULL DEFAULT '',
  error_stack text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_retry' CHECK (status IN ('pending_retry', 'retrying', 'exhausted', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_failed_jobs_retry
  ON failed_jobs(status, next_retry_at ASC)
  WHERE status = 'pending_retry';

CREATE INDEX IF NOT EXISTS idx_failed_jobs_user
  ON failed_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_failed_jobs_type
  ON failed_jobs(job_type, status);

ALTER TABLE failed_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own failed jobs"
  ON failed_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages failed jobs"
  ON failed_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION enqueue_failed_job(
  p_job_type text,
  p_payload jsonb,
  p_error_message text,
  p_error_stack text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_max_retries integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_base_delay interval := '1 minute'::interval;
BEGIN
  INSERT INTO failed_jobs (
    job_type, payload, error_message, error_stack, user_id,
    max_retries, next_retry_at
  ) VALUES (
    p_job_type, p_payload, p_error_message, p_error_stack, p_user_id,
    p_max_retries, now() + v_base_delay
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION claim_retry_batch(
  p_job_type text DEFAULT NULL,
  p_batch_size integer DEFAULT 10
)
RETURNS SETOF failed_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE failed_jobs
  SET
    status = 'retrying',
    retry_count = retry_count + 1
  WHERE id IN (
    SELECT fj.id
    FROM failed_jobs fj
    WHERE fj.status = 'pending_retry'
      AND fj.next_retry_at <= now()
      AND (p_job_type IS NULL OR fj.job_type = p_job_type)
    ORDER BY fj.next_retry_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_failed_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE failed_jobs
  SET
    status = 'resolved',
    resolved_at = now()
  WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION reschedule_or_exhaust_job(p_job_id uuid, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_count integer;
  v_max_retries integer;
BEGIN
  SELECT retry_count, max_retries
  INTO v_retry_count, v_max_retries
  FROM failed_jobs WHERE id = p_job_id;

  IF v_retry_count >= v_max_retries THEN
    UPDATE failed_jobs
    SET status = 'exhausted',
        error_message = COALESCE(p_error, error_message)
    WHERE id = p_job_id;
  ELSE
    UPDATE failed_jobs
    SET
      status = 'pending_retry',
      next_retry_at = now() + ((2 ^ v_retry_count) || ' minutes')::interval,
      error_message = COALESCE(p_error, error_message)
    WHERE id = p_job_id;
  END IF;
END;
$$;
