-- Fix infinite recursion in watchlists RLS by using a SECURITY DEFINER function

-- 1. Create helper function to get collaborated watchlists safely (bypassing RLS)
CREATE OR REPLACE FUNCTION get_user_collaborated_watchlist_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT watchlist_id 
  FROM watchlist_collaborators 
  WHERE user_id = p_user_id;
$$;

-- 2. Update watchlists policy to use the function
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view own and shared watchlists" ON watchlists;

-- Recreate directly using the function
CREATE POLICY "Users can view own and shared watchlists" ON watchlists FOR SELECT 
  USING (
    user_id = auth.uid() 
    OR is_shared = TRUE 
    OR id IN (SELECT get_user_collaborated_watchlist_ids(auth.uid()))
  );
