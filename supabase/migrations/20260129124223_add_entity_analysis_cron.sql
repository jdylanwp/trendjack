/*
  # Add Entity Analysis Cron Job

  1. Purpose
    - Analyze global entities for trend detection
    - Calculate z-scores for spike detection (exploding trends)
    - Calculate growth slopes for slow burn detection
    - Run every 2 hours to keep data fresh

  2. Cron Schedule
    - entity_analyze: Every 2 hours (analyzes 20 entities per run)
    - Processes entities in rotation based on last_analyzed_at
*/

-- Schedule entity analysis cron job (every 2 hours)
SELECT cron.schedule(
  'entity-analysis-cron',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/entity_analyze'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
    ),
    body := jsonb_build_object('batch_size', 20)
  );
  $$
);