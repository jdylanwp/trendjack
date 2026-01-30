/*
  # Fix Leads Privacy and Data Deduplication
  
  1. Problem
    - Leads and lead_candidates were showing system/demo data
    - This is incorrect - leads should ONLY show data for user's own monitored keywords
    - Users should not see leads generated from system/demo keywords
    
  2. Solution
    - Revert leads and lead_candidates policies to strict user-only access
    - Only show leads that belong to the authenticated user
    
  3. Security
    - Leads remain completely private per user
    - No shared/system lead data visibility
    - Users can only see leads from their own keywords
*/

-- Revert leads policy to strict user-only access
DROP POLICY IF EXISTS "Users can read own leads" ON leads;

CREATE POLICY "Users can read own leads" 
  ON leads 
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- Revert lead_candidates policy to strict user-only access
DROP POLICY IF EXISTS "Users can read own lead candidates" ON lead_candidates;

CREATE POLICY "Users can read own lead candidates" 
  ON lead_candidates 
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());
