-- Restore the recursion-safe editor lookup after introducing watchlist visibility.
CREATE OR REPLACE FUNCTION public.is_watchlist_editor(p_watchlist_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.watchlist_collaborators
    WHERE watchlist_id = p_watchlist_id
      AND user_id = (SELECT auth.uid())
      AND can_edit = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_watchlist_editor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_watchlist_editor(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_watchlist_editor(UUID) TO authenticated;

DROP POLICY IF EXISTS "Owners and invited editors can update watchlists"
ON public.watchlists;

CREATE POLICY "Owners and invited editors can update watchlists"
ON public.watchlists FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_watchlist_editor(id)
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_watchlist_editor(id)
);
