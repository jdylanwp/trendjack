/*
  # Enable Supabase Realtime on key tables

  1. Changes
    - Add `leads` table to the `supabase_realtime` publication
    - Add `trend_scores` table to the `supabase_realtime` publication

  2. Purpose
    - Allows the frontend to subscribe to INSERT/UPDATE events
      in real time, replacing the 30-60 second polling intervals
    - Leads appear on screen the instant the backend discovers them
    - Trend scores update live as the scoring pipeline completes

  3. Important Notes
    - Only INSERT and UPDATE events are typically needed
    - RLS policies still govern which rows each user can see
    - No schema changes; this only touches the publication membership
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trend_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trend_scores;
  END IF;
END $$;
