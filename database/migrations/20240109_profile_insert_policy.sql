-- Allow users to insert their own profile
-- This is needed for the first time a user saves their profile (upsert)
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);
