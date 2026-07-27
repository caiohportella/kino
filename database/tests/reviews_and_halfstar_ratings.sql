-- Integration assertions for the reviews and half-star migration.
-- Run after the migration:
-- psql "$KINO_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/reviews_and_halfstar_ratings.sql

BEGIN;

DO $$
DECLARE
  v_viewer UUID := '10000000-0000-0000-0000-000000000001';
  v_followed UUID := '10000000-0000-0000-0000-000000000002';
  v_community UUID := '10000000-0000-0000-0000-000000000003';
  v_movie UUID := '20000000-0000-0000-0000-000000000001';
  v_tv UUID := '20000000-0000-0000-0000-000000000002';
  v_review UUID;
  v_rating NUMERIC;
  v_count INTEGER;
BEGIN
  INSERT INTO auth.users (id, aud, role)
  VALUES
    (v_viewer, 'authenticated', 'authenticated'),
    (v_followed, 'authenticated', 'authenticated'),
    (v_community, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (id, username)
  VALUES
    (v_viewer, 'review_viewer'),
    (v_followed, 'review_followed'),
    (v_community, 'review_community')
  ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

  INSERT INTO public.titles (id, tmdb_id, type, title)
  VALUES
    (v_movie, -910001, 'movie', 'Review Test Movie'),
    (v_tv, -910002, 'tv', 'Review Test Series')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.title_ratings (user_id, title_id, rating, watch_type, watched_at)
  VALUES (v_viewer, v_movie, 4.5, 'first-time', now());

  BEGIN
    INSERT INTO public.title_ratings (user_id, title_id, rating, watch_type, watched_at)
    VALUES (v_followed, v_movie, 0.3, 'first-time', now());
    RAISE EXCEPTION '0.3 unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.title_ratings (user_id, title_id, rating, watch_type, watched_at)
    VALUES (v_followed, v_movie, 0, 'first-time', now());
    RAISE EXCEPTION '0 unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.episode_ratings (
      user_id, title_id, season_number, episode_number, rating, watch_type, watched_at
    )
    VALUES (v_followed, v_tv, 1, 1, 5.5, 'first-time', now());
    RAISE EXCEPTION '5.5 unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_viewer::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT r.id, r.rating INTO v_review, v_rating
  FROM public.create_review(v_viewer, v_movie, 'movie', 'A half-star review', NULL) AS r;

  IF v_rating <> 4.5 THEN
    RAISE EXCEPTION 'Expected canonical snapshot 4.5, got %', v_rating;
  END IF;

  BEGIN
    PERFORM public.create_review(v_viewer, v_movie, 'movie', 'Duplicate', NULL);
    RAISE EXCEPTION 'Duplicate review unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.create_review(v_viewer, v_tv, 'movie', 'Wrong media', NULL);
    RAISE EXCEPTION 'Media mismatch unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.like_review(v_review);
    RAISE EXCEPTION 'Self-like unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  INSERT INTO public.review_likes (review_id, user_id)
  VALUES (v_review, v_followed);
  PERFORM public.delete_review(v_review, v_viewer);
  SELECT count(*) INTO v_count
  FROM public.review_likes
  WHERE review_id = v_review;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Review likes did not cascade';
  END IF;
END;
$$;

ROLLBACK;
