/*
  # Create User Settings Table

  1. Purpose
    - Store global application settings including offer context
    - Single-row table for now (multi-user support can be added later)
    - Used by lead_score Edge Function to personalize AI responses

  2. New Table
    - `user_settings`
      - `id` (uuid, primary key)
      - `offer_context` (text, describes user's business/service)
      - `updated_at` (timestamptz, last modification time)

  3. Security
    - Enable RLS on user_settings table
    - Allow public read access (anon + authenticated)
    - Allow public insert/update access (anon + authenticated)
    - Service role can read for Edge Functions

  4. Initial Data
    - Insert default row with empty offer_context
*/

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_context text DEFAULT '' NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default settings row
INSERT INTO user_settings (id, offer_context, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '', now())
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public can read user settings"
  ON user_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public update access
CREATE POLICY "Public can update user settings"
  ON user_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service role to read for Edge Functions
CREATE POLICY "Service role can read user settings"
  ON user_settings FOR SELECT
  TO service_role
  USING (true);