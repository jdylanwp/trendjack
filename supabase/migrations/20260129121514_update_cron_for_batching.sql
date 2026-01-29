/*
  # Update Cron Jobs for Batched Processing

  1. Changes
    - Update cron schedules to support batching architecture
    - Increase frequency for trend_fetch and reddit_fetch (batch 50 at a time)
    - Keep trend_score and lead_score at reasonable intervals
    - Remove old schedules and create new ones

  2. New Schedules
    - trend_fetch: Every 10 minutes (to cycle through all keywords faster)
    - reddit_fetch: Every 10 minutes (offset by 5 minutes)
    - trend_score: Every 30 minutes (processes all trending keywords)
    - lead_score: Every 30 minutes (offset by 15 minutes)

  3. Rationale
    - With batching, functions process 50 keywords at a time
    - Running every 10 mins ensures all users get fresh data within ~1 hour
    - More frequent updates improve user experience for Pro/Enterprise users
    - Prevents function timeouts with large user bases
*/

-- Unschedule old cron jobs
SELECT cron.unschedule('trend-fetch-hourly');
SELECT cron.unschedule('reddit-fetch-hourly');
SELECT cron.unschedule('trend-score-every-2h');
SELECT cron.unschedule('lead-score-every-2h');

-- Schedule: trend_fetch every 10 minutes
SELECT cron.schedule(
  'trend-fetch-batched',
  '*/10 * * * *',
  $$SELECT invoke_edge_function('trend_fetch')$$
);

-- Schedule: reddit_fetch every 10 minutes (offset by 5 mins)
SELECT cron.schedule(
  'reddit-fetch-batched',
  '5,15,25,35,45,55 * * * *',
  $$SELECT invoke_edge_function('reddit_fetch')$$
);

-- Schedule: trend_score every 30 minutes
SELECT cron.schedule(
  'trend-score-frequent',
  '*/30 * * * *',
  $$SELECT invoke_edge_function('trend_score')$$
);

-- Schedule: lead_score every 30 minutes (offset by 15 mins)
SELECT cron.schedule(
  'lead-score-frequent',
  '15,45 * * * *',
  $$SELECT invoke_edge_function('lead_score')$$
);