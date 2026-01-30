/*
  # Add Fury Score System to Leads
  
  1. Problem
    - Current lead scoring only measures volume (mentions + comments)
    - Need to measure sentiment and frustration levels
    - Users need to prioritize leads by pain intensity, not just activity
  
  2. New Columns
    - `fury_score` (integer 0-100): Measures frustration/pain levels in the post
    - `pain_summary` (text): Brief explanation of what's causing frustration
    - `primary_trigger` (text): Main frustration trigger (e.g., "Expensive pricing tier changes")
    - `sample_quote` (text): Direct quote from post showing frustration
  
  3. Changes
    - Add new columns to leads table with sensible defaults
    - These will be populated by the AI in lead_score function
  
  4. Notes
    - Fury score complements intent score (intent = buying, fury = frustration)
    - High fury + high intent = hot leads (angry users ready to switch)
    - Pain summary helps users understand context quickly
*/

-- Add fury score columns to leads table
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS fury_score INTEGER DEFAULT 0 CHECK (fury_score >= 0 AND fury_score <= 100),
  ADD COLUMN IF NOT EXISTS pain_summary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_trigger TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sample_quote TEXT DEFAULT '';

-- Add comment explaining the fury score system
COMMENT ON COLUMN leads.fury_score IS 'Measures frustration/pain level in the post (0-100). High scores indicate angry users ready to switch solutions.';
COMMENT ON COLUMN leads.pain_summary IS 'Brief AI-generated summary of what is causing user frustration';
COMMENT ON COLUMN leads.primary_trigger IS 'Main frustration trigger identified by AI (e.g., "Expensive pricing", "Poor support")';
COMMENT ON COLUMN leads.sample_quote IS 'Direct quote from the post that best demonstrates the frustration level';
