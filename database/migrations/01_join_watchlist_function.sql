-- Function to join a watchlist via share code
-- Returns the watchlist details if successful
CREATE OR REPLACE FUNCTION join_watchlist(p_share_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (postgres/service_role)
SET search_path = public
AS $$
DECLARE
  v_watchlist_id UUID;
  v_owner_id UUID;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find watchlist by code
  SELECT id, user_id INTO v_watchlist_id, v_owner_id
  FROM watchlists
  WHERE share_code = p_share_code
  LIMIT 1;

  IF v_watchlist_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share code';
  END IF;

  -- Check if user is the owner
  IF v_owner_id = v_user_id THEN
    RAISE EXCEPTION 'You are already the owner of this watchlist';
  END IF;

  -- Check if already a collaborator
  IF EXISTS (
    SELECT 1 FROM watchlist_collaborators
    WHERE watchlist_id = v_watchlist_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You have already joined this watchlist';
  END IF;

  -- Insert collaborator
  INSERT INTO watchlist_collaborators (watchlist_id, user_id, can_edit)
  VALUES (v_watchlist_id, v_user_id, true);

  -- Return the watchlist data
  SELECT to_jsonb(w) INTO v_result
  FROM watchlists w
  WHERE id = v_watchlist_id;

  RETURN v_result;
END;
$$;
