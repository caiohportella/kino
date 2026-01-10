-- Fix infinite recursion in watchlists UPDATE policy
-- This mirrors the fix for the SELECT policy but handles the UPDATE case where we check for edit permissions

-- 1. Create helper function to check edit permissions safely (bypassing RLS)
CREATE OR REPLACE FUNCTION is_watchlist_editor(p_watchlist_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM watchlist_collaborators 
    WHERE watchlist_id = p_watchlist_id 
    AND user_id = p_user_id 
    AND can_edit = TRUE
  );
$$;

-- 2. Update watchlists policy to use the function
DROP POLICY IF EXISTS "Users can update own watchlists" ON watchlists;

CREATE POLICY "Users can update own watchlists" ON watchlists FOR UPDATE 
  USING (
    user_id = auth.uid() 
    OR 
    is_watchlist_editor(id, auth.uid())
  );
