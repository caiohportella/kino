-- Preserve when follow relationships were created so mutualSince can be calculated.
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.follows
  ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_follows_relationship_lookup
  ON public.follows (follower_id, following_id);

-- Existing null timestamps intentionally remain null. The application omits mutualSince for them.
