-- Kino reviews and half-star ratings.
-- Run this migration on staging first. Back up the database before applying it.
-- This migration changes the rating domain to include 0.5-star steps.

BEGIN;

ALTER TABLE public.title_ratings
  DROP CONSTRAINT IF EXISTS title_ratings_rating_check;
ALTER TABLE public.title_ratings
  DROP CONSTRAINT IF EXISTS title_ratings_rating_range_step_check;

-- The previous NUMERIC(2,1) domain accepted every tenth between 1 and 5.
-- Preserve legacy ratings by rounding non-half values to the nearest half-star
-- before PostgreSQL validates the stricter constraint.
UPDATE public.title_ratings
SET rating = round(rating * 2) / 2.0
WHERE rating * 2 <> round(rating * 2);

ALTER TABLE public.title_ratings
  ADD CONSTRAINT title_ratings_rating_range_step_check
  CHECK (
    rating BETWEEN 0.5 AND 5
    AND rating * 2 = round(rating * 2)
  );

ALTER TABLE public.episode_ratings
  DROP CONSTRAINT IF EXISTS episode_ratings_rating_check;
ALTER TABLE public.episode_ratings
  DROP CONSTRAINT IF EXISTS episode_ratings_rating_range_step_check;

UPDATE public.episode_ratings
SET rating = round(rating * 2) / 2.0
WHERE rating * 2 <> round(rating * 2);

ALTER TABLE public.episode_ratings
  ADD CONSTRAINT episode_ratings_rating_range_step_check
  CHECK (
    rating BETWEEN 0.5 AND 5
    AND rating * 2 = round(rating * 2)
  );

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
  rating NUMERIC(2, 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_user_title_key UNIQUE (user_id, title_id),
  CONSTRAINT reviews_rating_range_step_check CHECK (
    rating IS NULL
    OR (
      rating BETWEEN 0.5 AND 5
      AND rating * 2 = round(rating * 2)
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_reviews_title_created_id
  ON public.reviews (title_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id
  ON public.reviews (user_id);

CREATE TABLE IF NOT EXISTS public.review_likes (
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_user_id
  ON public.review_likes (user_id);

CREATE OR REPLACE FUNCTION public.reviews_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.reviews_set_updated_at();

CREATE OR REPLACE FUNCTION public.assert_review_media_type_matches_title(
  p_title_id UUID,
  p_media_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT t.type INTO v_type
  FROM public.titles AS t
  WHERE t.id = p_title_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Title not found';
  END IF;

  IF v_type <> p_media_type THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Review media type does not match title';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reviews_validate_media_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_review_media_type_matches_title(NEW.title_id, NEW.media_type);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_validate_media_type ON public.reviews;
CREATE TRIGGER trg_reviews_validate_media_type
BEFORE INSERT OR UPDATE OF title_id, media_type ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.reviews_validate_media_type();

CREATE OR REPLACE FUNCTION public.create_review(
  p_user_id UUID,
  p_title_id UUID,
  p_media_type TEXT,
  p_content TEXT,
  p_rating NUMERIC DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review public.reviews;
  v_rating NUMERIC(2, 1);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to create this review';
  END IF;

  IF char_length(btrim(p_content)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22001', MESSAGE = 'Review content must be between 1 and 2000 characters';
  END IF;

  PERFORM public.assert_review_media_type_matches_title(p_title_id, p_media_type);

  -- p_rating is retained for backwards-compatible RPC calls but never trusted.
  SELECT tr.rating INTO v_rating
  FROM public.title_ratings AS tr
  WHERE tr.user_id = p_user_id
    AND tr.title_id = p_title_id
  ORDER BY tr.watched_at DESC, tr.updated_at DESC, tr.id DESC
  LIMIT 1;

  INSERT INTO public.reviews (user_id, title_id, media_type, content, rating)
  VALUES (p_user_id, p_title_id, p_media_type, btrim(p_content), v_rating)
  RETURNING * INTO v_review;

  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_review(
  p_review_id UUID,
  p_user_id UUID,
  p_content TEXT,
  p_rating NUMERIC DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review public.reviews;
  v_rating NUMERIC(2, 1);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to update this review';
  END IF;

  IF char_length(btrim(p_content)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22001', MESSAGE = 'Review content must be between 1 and 2000 characters';
  END IF;

  SELECT r.* INTO v_review
  FROM public.reviews AS r
  WHERE r.id = p_review_id
    AND r.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Review not found or not owned by viewer';
  END IF;

  SELECT tr.rating INTO v_rating
  FROM public.title_ratings AS tr
  WHERE tr.user_id = p_user_id
    AND tr.title_id = v_review.title_id
  ORDER BY tr.watched_at DESC, tr.updated_at DESC, tr.id DESC
  LIMIT 1;

  UPDATE public.reviews AS r
  SET content = btrim(p_content),
      rating = v_rating
  WHERE r.id = p_review_id
  RETURNING r.* INTO v_review;

  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_review(
  p_review_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to delete this review';
  END IF;

  DELETE FROM public.reviews AS r
  WHERE r.id = p_review_id
    AND r.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Review not found or not owned by viewer';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.like_review(p_review_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_author UUID;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT r.user_id INTO v_author
  FROM public.reviews AS r
  WHERE r.id = p_review_id;

  IF v_author IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Review not found';
  END IF;

  IF v_author = v_viewer THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Cannot like own review';
  END IF;

  INSERT INTO public.review_likes (review_id, user_id)
  VALUES (p_review_id, v_viewer)
  ON CONFLICT (review_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlike_review(p_review_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  DELETE FROM public.review_likes AS rl
  WHERE rl.review_id = p_review_id
    AND rl.user_id = v_viewer;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_title_reviews(
  p_title_id UUID,
  p_viewer_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 6,
  p_cursor JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title_id UUID,
  media_type TEXT,
  content TEXT,
  rating NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  like_count BIGINT,
  liked_by_viewer BOOLEAN,
  author_username TEXT,
  author_display_name TEXT,
  author_avatar_url TEXT,
  is_viewer_review BOOLEAN,
  tier INTEGER,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_limit INTEGER := greatest(1, least(COALESCE(p_limit, 6), 50));
  c_tier INTEGER;
  c_like_count BIGINT;
  c_created_at TIMESTAMPTZ;
  c_id UUID;
BEGIN
  IF p_cursor IS NOT NULL THEN
    c_tier := (p_cursor ->> 'tier')::INTEGER;
    c_like_count := (p_cursor ->> 'like_count')::BIGINT;
    c_created_at := (p_cursor ->> 'created_at')::TIMESTAMPTZ;
    c_id := (p_cursor ->> 'id')::UUID;
  END IF;

  RETURN QUERY
  WITH review_rows AS (
    SELECT
      r.id,
      r.user_id,
      r.title_id,
      r.media_type,
      r.content,
      r.rating,
      r.created_at,
      r.updated_at,
      count(rl.user_id)::BIGINT AS like_count,
      COALESCE(bool_or(rl.user_id = v_viewer) FILTER (WHERE v_viewer IS NOT NULL), false)
        AS liked_by_viewer,
      up.username AS author_username,
      up.display_name AS author_display_name,
      up.avatar_url AS author_avatar_url,
      r.user_id = v_viewer AS is_viewer_review,
      CASE
        WHEN r.user_id = v_viewer THEN 0
        WHEN v_viewer IS NOT NULL AND EXISTS (
          SELECT 1
          FROM public.follows AS f
          WHERE f.follower_id = v_viewer
            AND f.following_id = r.user_id
        ) THEN 1
        ELSE 2
      END AS tier,
      count(*) OVER ()::BIGINT AS total_count
    FROM public.reviews AS r
    LEFT JOIN public.review_likes AS rl ON rl.review_id = r.id
    LEFT JOIN public.user_profiles AS up ON up.id = r.user_id
    WHERE r.title_id = p_title_id
    GROUP BY r.id, up.id
  )
  SELECT
    rr.id,
    rr.user_id,
    rr.title_id,
    rr.media_type,
    rr.content,
    rr.rating,
    rr.created_at,
    rr.updated_at,
    rr.like_count,
    rr.liked_by_viewer,
    rr.author_username,
    rr.author_display_name,
    rr.author_avatar_url,
    rr.is_viewer_review,
    rr.tier,
    rr.total_count
  FROM review_rows AS rr
  WHERE p_cursor IS NULL
    OR rr.tier > c_tier
    OR (rr.tier = c_tier AND rr.like_count < c_like_count)
    OR (
      rr.tier = c_tier
      AND rr.like_count = c_like_count
      AND rr.created_at < c_created_at
    )
    OR (
      rr.tier = c_tier
      AND rr.like_count = c_like_count
      AND rr.created_at = c_created_at
      AND rr.id > c_id
    )
  ORDER BY rr.tier, rr.like_count DESC, rr.created_at DESC, rr.id
  LIMIT v_limit + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_followed_title_ratings(
  p_title_id UUID,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  rating NUMERIC,
  watched_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (tr.user_id)
      tr.user_id,
      tr.rating,
      tr.watched_at,
      tr.updated_at
    FROM public.title_ratings AS tr
    JOIN public.follows AS f
      ON f.following_id = tr.user_id
     AND f.follower_id = auth.uid()
    WHERE tr.title_id = p_title_id
      AND tr.user_id <> auth.uid()
    ORDER BY tr.user_id, tr.watched_at DESC, tr.updated_at DESC, tr.id DESC
  )
  SELECT
    l.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    l.rating,
    l.watched_at,
    count(*) OVER ()::BIGINT
  FROM latest AS l
  JOIN public.user_profiles AS up ON up.id = l.user_id
  ORDER BY l.watched_at DESC, l.user_id
  LIMIT greatest(1, least(COALESCE(p_limit, 6), 50));
$$;

CREATE OR REPLACE FUNCTION public.get_followed_episode_ratings(
  p_title_id UUID,
  p_season_number INTEGER,
  p_per_episode_limit INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (er.user_id, er.episode_number)
      er.user_id,
      er.season_number,
      er.episode_number,
      er.rating,
      er.watched_at
    FROM public.episode_ratings AS er
    JOIN public.follows AS f
      ON f.following_id = er.user_id
     AND f.follower_id = auth.uid()
    WHERE er.title_id = p_title_id
      AND er.season_number = p_season_number
      AND er.user_id <> auth.uid()
    ORDER BY
      er.user_id,
      er.episode_number,
      er.watched_at DESC,
      er.updated_at DESC,
      er.id DESC
  ),
  ranked AS (
    SELECT
      l.*,
      up.username,
      up.display_name,
      up.avatar_url,
      row_number() OVER (
        PARTITION BY l.episode_number
        ORDER BY l.watched_at DESC, l.user_id
      ) AS row_number,
      count(*) OVER (PARTITION BY l.episode_number) AS total_count
    FROM latest AS l
    JOIN public.user_profiles AS up ON up.id = l.user_id
  ),
  episode_items AS (
    SELECT
      format('%s:%s', p_season_number, r.episode_number) AS episode_key,
      jsonb_agg(
        jsonb_build_object(
          'userId', r.user_id,
          'username', r.username,
          'displayName', r.display_name,
          'avatarUrl', r.avatar_url,
          'rating', r.rating,
          'watchedAt', r.watched_at
        )
        ORDER BY r.watched_at DESC, r.user_id
      ) FILTER (
        WHERE r.row_number <= greatest(1, least(COALESCE(p_per_episode_limit, 3), 20))
      ) AS items,
      max(r.total_count)::INTEGER AS total_count
    FROM ranked AS r
    GROUP BY r.episode_number
  )
  SELECT jsonb_build_object(
    'episodes',
    COALESCE(
      jsonb_object_agg(ei.episode_key, COALESCE(ei.items, '[]'::JSONB)),
      '{}'::JSONB
    ),
    'totals',
    COALESCE(
      jsonb_object_agg(ei.episode_key, to_jsonb(ei.total_count)),
      '{}'::JSONB
    )
  )
  FROM episode_items AS ei;
$$;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reviews" ON public.reviews;
CREATE POLICY "Users can view reviews"
  ON public.reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view review likes" ON public.review_likes;
CREATE POLICY "Users can view review likes"
  ON public.review_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own review likes" ON public.review_likes;
CREATE POLICY "Users can insert own review likes"
  ON public.review_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.reviews AS r
      WHERE r.id = review_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own review likes" ON public.review_likes;
CREATE POLICY "Users can delete own review likes"
  ON public.review_likes FOR DELETE
  USING (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.assert_review_media_type_matches_title(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_review(UUID, UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_review(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_review(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.like_review(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlike_review(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_review(UUID, UUID, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_review(UUID, UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_review(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlike_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_title_reviews(UUID, UUID, INTEGER, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_followed_title_ratings(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_followed_episode_ratings(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
