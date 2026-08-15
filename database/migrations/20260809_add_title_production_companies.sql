BEGIN;

ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS production_companies JSONB DEFAULT '[]'::jsonb;

COMMIT;
