/*
  # Enable Realtime on new tables

  Enable Supabase Realtime for key tables used by the new notification system.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE failed_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE raw_ingest_queue;
