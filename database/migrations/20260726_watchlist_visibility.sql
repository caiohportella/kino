-- Replace binary sharing with private, shared (code-only), and public visibility.
ALTER TABLE public.watchlists
  ADD COLUMN IF NOT EXISTS visibility TEXT;

UPDATE public.watchlists
SET visibility = CASE WHEN is_shared THEN 'shared' ELSE 'private' END
WHERE visibility IS NULL;

ALTER TABLE public.watchlists
  ALTER COLUMN visibility SET DEFAULT 'private',
  ALTER COLUMN visibility SET NOT NULL;

ALTER TABLE public.watchlists
  DROP CONSTRAINT IF EXISTS watchlists_visibility_check;
ALTER TABLE public.watchlists
  ADD CONSTRAINT watchlists_visibility_check
  CHECK (visibility IN ('private', 'shared', 'public'));

CREATE INDEX IF NOT EXISTS idx_watchlists_public_profile
  ON public.watchlists (user_id, updated_at DESC)
  WHERE visibility = 'public';

-- Keep the legacy column synchronized during the compatibility window.
CREATE OR REPLACE FUNCTION public.sync_watchlist_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_shared := NEW.visibility = 'shared';
  IF NEW.visibility = 'shared' AND NEW.share_code IS NULL THEN
    NEW.share_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  ELSIF NEW.visibility <> 'shared' THEN
    NEW.share_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_watchlist_visibility_trigger ON public.watchlists;
CREATE TRIGGER sync_watchlist_visibility_trigger
BEFORE INSERT OR UPDATE OF visibility ON public.watchlists
FOR EACH ROW EXECUTE FUNCTION public.sync_watchlist_visibility();

DROP POLICY IF EXISTS "Users can view own and shared watchlists" ON public.watchlists;
DROP POLICY IF EXISTS "Users can insert own watchlists" ON public.watchlists;
DROP POLICY IF EXISTS "Users can update own watchlists" ON public.watchlists;
DROP POLICY IF EXISTS "Users can delete own watchlists" ON public.watchlists;

CREATE POLICY "Watchlists are visible to permitted viewers"
ON public.watchlists FOR SELECT
TO anon, authenticated
USING (
  visibility = 'public'
  OR user_id = (SELECT auth.uid())
  OR id IN (SELECT public.get_user_collaborated_watchlist_ids((SELECT auth.uid())))
);

CREATE POLICY "Users can insert own watchlists"
ON public.watchlists FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

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

CREATE POLICY "Owners can delete watchlists"
ON public.watchlists FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view items from accessible watchlists" ON public.watchlist_items;
DROP POLICY IF EXISTS "Users can insert items to accessible watchlists" ON public.watchlist_items;
DROP POLICY IF EXISTS "Users can delete own watchlist items" ON public.watchlist_items;

CREATE POLICY "Permitted viewers can view watchlist items"
ON public.watchlist_items FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.watchlists w
    WHERE w.id = watchlist_id
      AND (
        w.visibility = 'public'
        OR w.user_id = (SELECT auth.uid())
        OR w.id IN (
          SELECT public.get_user_collaborated_watchlist_ids((SELECT auth.uid()))
        )
      )
  )
);

CREATE POLICY "Owners and invited editors can insert watchlist items"
ON public.watchlist_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.watchlists w
    WHERE w.id = watchlist_id
      AND (
        w.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.watchlist_collaborators wc
          WHERE wc.watchlist_id = w.id
            AND wc.user_id = (SELECT auth.uid())
            AND wc.can_edit = TRUE
        )
      )
  )
  AND added_by = (SELECT auth.uid())
);

CREATE POLICY "Owners and invited editors can delete watchlist items"
ON public.watchlist_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.watchlists w
    WHERE w.id = watchlist_id
      AND (
        w.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.watchlist_collaborators wc
          WHERE wc.watchlist_id = w.id
            AND wc.user_id = (SELECT auth.uid())
            AND wc.can_edit = TRUE
        )
      )
  )
);

-- Code-based anonymous viewing is deliberately isolated from general SELECT RLS.
CREATE OR REPLACE FUNCTION public.get_shared_watchlist_by_code(p_share_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_watchlist public.watchlists;
BEGIN
  SELECT * INTO v_watchlist
  FROM public.watchlists
  WHERE share_code = upper(trim(p_share_code))
    AND visibility = 'shared'
  LIMIT 1;

  IF v_watchlist.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'watchlist', to_jsonb(v_watchlist) - 'share_code',
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', wi.id,
          'watchlist_id', wi.watchlist_id,
          'title_id', wi.title_id,
          'added_by', wi.added_by,
          'added_at', wi.added_at,
          'title', to_jsonb(t)
        )
        ORDER BY wi.added_at DESC
      )
      FROM public.watchlist_items wi
      JOIN public.titles t ON t.id = wi.title_id
      WHERE wi.watchlist_id = v_watchlist.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_watchlist_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_watchlist_by_code(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_watchlist(p_share_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_watchlist_id UUID;
  v_owner_id UUID;
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, user_id INTO v_watchlist_id, v_owner_id
  FROM public.watchlists
  WHERE share_code = upper(trim(p_share_code))
    AND visibility = 'shared'
  LIMIT 1;

  IF v_watchlist_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired share code'; END IF;
  IF v_owner_id = v_user_id THEN RAISE EXCEPTION 'You are already the owner of this watchlist'; END IF;

  INSERT INTO public.watchlist_collaborators (watchlist_id, user_id, can_edit)
  VALUES (v_watchlist_id, v_user_id, TRUE)
  ON CONFLICT (watchlist_id, user_id) DO NOTHING;

  SELECT to_jsonb(w) INTO v_result FROM public.watchlists w WHERE id = v_watchlist_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.join_watchlist(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_watchlist(TEXT) TO authenticated;

GRANT SELECT ON public.watchlists, public.watchlist_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists, public.watchlist_items TO authenticated;
