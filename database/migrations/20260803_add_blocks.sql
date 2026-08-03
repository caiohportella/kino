-- Store viewer block relationships so activity and social surfaces can hide blocked accounts.

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self_block_check CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id
  ON public.blocks (blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id
  ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks"
  ON public.blocks
  FOR SELECT
  USING (blocker_id = auth.uid());

CREATE POLICY "Users can insert own blocks"
  ON public.blocks
  FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks"
  ON public.blocks
  FOR DELETE
  USING (blocker_id = auth.uid());
