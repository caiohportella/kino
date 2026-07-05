-- Function to leave a watchlist (remove self from collaborators)
CREATE OR REPLACE FUNCTION leave_watchlist(p_watchlist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete from collaborators
  DELETE FROM watchlist_collaborators
  WHERE watchlist_id = p_watchlist_id AND user_id = v_user_id;

  -- Verify deletion (optional, but good for feedback)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a member of this watchlist';
  END IF;
END;
$$;
