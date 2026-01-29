/*
  # Fix New User Priority in Processing Queue

  1. Problem
    - New users get last_fetched_at = now() by default
    - Processing sorts by last_fetched_at ASC (oldest first)
    - New users are pushed to back of queue, wait longest

  2. Solution
    - Change default to old date (2000-01-01)
    - New users jump to front of queue
    - Get immediate data on first cron run

  3. Changes
    - Update default for monitored_keywords.last_fetched_at
    - Update any NULL values to ensure priority
*/

-- Change default to old date for new users to get priority
ALTER TABLE monitored_keywords 
ALTER COLUMN last_fetched_at 
SET DEFAULT '2000-01-01'::timestamptz;

-- Update any NULL values to ensure they get processed first
UPDATE monitored_keywords 
SET last_fetched_at = '2000-01-01'::timestamptz 
WHERE last_fetched_at IS NULL;