/*
  # Fix User Settings Trigger for Signup

  1. Problem
    - The trigger function handle_new_user() fails during signup
    - No unique constraint on user_id allows duplicates
    - No error handling causes 500 errors on signup

  2. Solution
    - Add unique constraint on user_id
    - Update trigger function with ON CONFLICT handling
    - Add proper error handling to prevent signup failures

  3. Changes
    - Add unique constraint to user_settings.user_id
    - Update handle_new_user() function to use ON CONFLICT
    - Ensure idempotency for the trigger
*/

-- Add unique constraint on user_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_user_id_key'
  ) THEN
    ALTER TABLE user_settings 
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Update the trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert user settings with ON CONFLICT to handle duplicates
  INSERT INTO user_settings (user_id, offer_context, updated_at)
  VALUES (NEW.id, '', now())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user_settings for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger to ensure it's using the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();