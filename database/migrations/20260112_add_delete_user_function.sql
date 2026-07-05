-- Function to allow a user to delete their own account
-- This function must be called with an authenticated user
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the user from auth.users
  -- This will cascade to all other tables referencing auth.users(id)
  -- because of the ON DELETE CASCADE constraints.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
