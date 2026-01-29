/*
  # Setup Automated Cron Jobs for Edge Functions

  1. Purpose
    - Enable automated, scheduled execution of edge functions
    - Prevent manual triggers and ensure data grows consistently
    - Run trend_fetch, reddit_fetch, trend_score, and lead_score on regular intervals

  2. Extensions Required
    - pg_cron: Provides cron-like job scheduling
    - pg_net: Enables HTTP requests from PostgreSQL

  3. Cron Schedules
    - trend_fetch: Every hour at minute 0
    - reddit_fetch: Every hour at minute 15
    - trend_score: Every 2 hours at minute 30
    - lead_score: Every 2 hours at minute 45

  4. Tracking Table
    - cron_execution_logs: Track when jobs run and their status
    - Helps monitor system health and debug issues

  5. Important Notes
    - All times are in UTC
    - Jobs run automatically without user intervention
    - Service role authentication is handled internally
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a table to track cron execution logs
CREATE TABLE IF NOT EXISTS cron_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  status text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_job ON cron_execution_logs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_execution_logs(status, started_at DESC);

ALTER TABLE cron_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cron logs"
  ON cron_execution_logs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create a function to invoke edge functions via pg_net
CREATE OR REPLACE FUNCTION invoke_edge_function(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  project_url text;
  service_key text;
BEGIN
  -- Get configuration from vault or use current settings
  project_url := current_setting('app.settings.api_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- Fallback to constructing URL from current database
  IF project_url IS NULL THEN
    project_url := 'https://wivelnlgwmxegdqjhswr.supabase.co';
  END IF;

  -- Log execution start
  INSERT INTO cron_execution_logs (job_name, status)
  VALUES (function_name, 'started');

  -- Make HTTP POST request to edge function
  SELECT INTO request_id
    net.http_post(
      url := project_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := '{}'::jsonb
    );

  -- Log successful invocation
  UPDATE cron_execution_logs
  SET status = 'invoked', completed_at = now()
  WHERE job_name = function_name
    AND started_at >= now() - interval '1 minute'
    AND completed_at IS NULL;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  UPDATE cron_execution_logs
  SET status = 'error', error_message = SQLERRM, completed_at = now()
  WHERE job_name = function_name
    AND started_at >= now() - interval '1 minute'
    AND completed_at IS NULL;
END;
$$;

-- Schedule: trend_fetch every hour at minute 0
SELECT cron.schedule(
  'trend-fetch-hourly',
  '0 * * * *',
  $$SELECT invoke_edge_function('trend_fetch')$$
);

-- Schedule: reddit_fetch every hour at minute 15
SELECT cron.schedule(
  'reddit-fetch-hourly',
  '15 * * * *',
  $$SELECT invoke_edge_function('reddit_fetch')$$
);

-- Schedule: trend_score every 2 hours at minute 30
SELECT cron.schedule(
  'trend-score-every-2h',
  '30 */2 * * *',
  $$SELECT invoke_edge_function('trend_score')$$
);

-- Schedule: lead_score every 2 hours at minute 45
SELECT cron.schedule(
  'lead-score-every-2h',
  '45 */2 * * *',
  $$SELECT invoke_edge_function('lead_score')$$
);

-- Create a view to see current cron jobs
CREATE OR REPLACE VIEW cron_jobs_status AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- Grant access to view cron jobs
GRANT SELECT ON cron_jobs_status TO anon, authenticated;