-- Add banner_url to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
