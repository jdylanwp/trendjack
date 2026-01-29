/*
  # Enable Keyword Management for Public Users

  1. Purpose
    - Allow anonymous (anon) users to manage monitored keywords via Settings page
    - Enable INSERT operations for adding new keywords
    - Enable DELETE operations for removing keywords

  2. Security Notes
    - Public users can add/remove keywords they want to monitor
    - This is acceptable as the data is not sensitive
    - Keywords are public monitoring targets, not user-specific data
    - Cascade delete ensures related data is cleaned up

  3. Changes
    - Add INSERT policy for monitored_keywords (anon + authenticated)
    - Add DELETE policy for monitored_keywords (anon + authenticated)
    - Existing SELECT policy already allows read access
*/

-- Allow public users to insert new keywords
CREATE POLICY "Public can insert monitored keywords"
  ON monitored_keywords FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow public users to delete keywords
CREATE POLICY "Public can delete monitored keywords"
  ON monitored_keywords FOR DELETE
  TO anon, authenticated
  USING (true);