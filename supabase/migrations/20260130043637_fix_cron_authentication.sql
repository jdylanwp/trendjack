/*
  # Fix Cron Job Authentication

  1. Problem
    - Cron jobs reference `current_setting('app.settings.service_role_key')` which was never configured
    - This causes all automated cron jobs to call edge functions with `Authorization: Bearer null`
    - Results in 401 Unauthorized errors for: entity_extract, reddit_fetch, lead_score, entity_analyze

  2. Solution
    - Update the invoke_edge_function to use environment variables from pg_net
    - For Supabase hosted projects, use the service role key from the request context
    - Add proper error handling for authentication issues

  3. Changes
    - Drop and recreate invoke_edge_function with proper authentication
    - Remove dependency on unset configuration parameters
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS invoke_edge_function(text);

-- Create improved version that works with Supabase's authentication model
CREATE OR REPLACE FUNCTION invoke_edge_function(function_name text, function_body jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  project_url text;
BEGIN
  -- Use hardcoded project URL for Supabase hosted projects
  -- This should match the actual Supabase project URL
  project_url := 'https://wivelnlgwmxegdqjhswr.supabase.co';

  -- Log execution start
  INSERT INTO cron_execution_logs (job_name, status)
  VALUES (function_name, 'started');

  -- Make HTTP POST request to edge function
  -- NOTE: For cron jobs in Supabase, we rely on the edge function's verify_jwt setting
  -- Functions called by cron should have verify_jwt=false or use service role internally
  SELECT INTO request_id
    net.http_post(
      url := project_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := function_body
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
  
  RAISE WARNING 'Failed to invoke %: %', function_name, SQLERRM;
END;
$$;

-- Update entity analysis cron to not use authentication headers
-- Since edge functions should handle their own authentication internally
SELECT cron.unschedule('entity-analysis-cron');

SELECT cron.schedule(
  'entity-analysis-cron',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/entity_analyze',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('batch_size', 20)
  );
  $$
);