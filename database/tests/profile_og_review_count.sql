BEGIN;

DO $$
DECLARE
  function_result TEXT;
BEGIN
  SELECT pg_get_function_result(p.oid)
  INTO function_result
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_public_profile_og_data'
    AND pg_get_function_identity_arguments(p.oid) = 'profile_username text';

  IF function_result NOT LIKE '%review_count bigint%' THEN
    RAISE EXCEPTION 'public profile OG RPC must return review_count';
  END IF;
END;
$$;

ROLLBACK;
