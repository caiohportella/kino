-- Let PostgreSQL derive the contributor from the authenticated session,
-- avoiding a separate auth.getUser() request from clients.
ALTER TABLE watchlist_items
ALTER COLUMN added_by SET DEFAULT auth.uid();

-- Do not allow clients to spoof another user's id even if they explicitly
-- provide added_by instead of relying on the default.
DROP POLICY IF EXISTS "Users can insert items to accessible watchlists"
ON watchlist_items;

CREATE POLICY "Users can insert items to accessible watchlists"
ON watchlist_items
FOR INSERT
WITH CHECK (
  added_by = auth.uid()
  AND watchlist_id IN (
    SELECT id
    FROM watchlists
    WHERE user_id = auth.uid()
      OR id IN (
        SELECT watchlist_id
        FROM watchlist_collaborators
        WHERE user_id = auth.uid()
          AND can_edit = TRUE
      )
  )
);