BEGIN;

DO $$
DECLARE
  function_result TEXT;
  index_exists BOOLEAN;
BEGIN
  SELECT pg_get_function_result(p.oid)
  INTO function_result
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_profile_reviews'
    AND pg_get_function_identity_arguments(p.oid)
      = 'profile_username text, page_limit integer, cursor_created_at timestamp with time zone, cursor_id uuid';

  IF function_result IS NULL THEN
    RAISE EXCEPTION 'get_profile_reviews signature is missing';
  END IF;

  IF function_result NOT LIKE '%title_tmdb_id integer%' THEN
    RAISE EXCEPTION 'get_profile_reviews must return grouped title metadata';
  END IF;

  IF function_result NOT LIKE '%like_count bigint%' THEN
    RAISE EXCEPTION 'get_profile_reviews must return authoritative like counts';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_reviews_user_created_id'
  )
  INTO index_exists;

  IF NOT index_exists THEN
    RAISE EXCEPTION 'profile review ordering index is missing';
  END IF;
END;
$$;

ROLLBACK;
