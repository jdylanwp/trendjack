/*
  # Add last_processed_at to monitored_keywords

  1. Changes
    - Add `last_processed_at` column to `monitored_keywords` table
    - Default to a very old timestamp to ensure new keywords get processed first
    - This enables fair rotation for lead scoring across all enabled keywords
  
  2. Purpose
    - Track when each keyword was last processed for lead discovery
    - Ensure fair rotation and prevent starvation of any keywords
    - Support batch processing with oldest-first ordering
*/

-- Add last_processed_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitored_keywords' AND column_name = 'last_processed_at'
  ) THEN
    ALTER TABLE monitored_keywords 
    ADD COLUMN last_processed_at timestamptz DEFAULT '2000-01-01 00:00:00+00'::timestamptz;
  END IF;
END $$;