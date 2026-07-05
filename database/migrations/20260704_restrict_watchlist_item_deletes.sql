-- Only the user who added a title to a watchlist may remove that title.
DROP POLICY IF EXISTS "Users can delete items from accessible watchlists" ON watchlist_items;
DROP POLICY IF EXISTS "Users can delete own watchlist items" ON watchlist_items;

CREATE POLICY "Users can delete own watchlist items" ON watchlist_items
FOR DELETE
USING (added_by = auth.uid());
