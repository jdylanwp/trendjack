/*
  # Add Batching Support to Trend Scores

  1. Changes
    - Add last_processed_at column to trend_scores table
    - Set default to old date (2000-01-01) for immediate processing
    - Add index for performance

  2. Purpose
    - Enable batched processing in lead_score function
    - Prevent function timeouts with many trending keywords
    - Ensure fair rotation through all trending keywords
*/

-- Add last_processed_at for batching support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trend_scores' AND column_name = 'last_processed_at'
  ) THEN
    ALTER TABLE trend_scores 
    ADD COLUMN last_processed_at timestamptz DEFAULT '2000-01-01'::timestamptz;
  END IF;
END $$;

-- Create index for efficient batching queries
CREATE INDEX IF NOT EXISTS idx_trend_scores_processing 
ON trend_scores(last_processed_at) 
WHERE is_trending = true;