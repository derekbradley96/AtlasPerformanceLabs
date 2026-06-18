-- Public endpoint anti-abuse table + storage hardening for message_media.

-- ---------------------------------------------------------------------------
-- 1) Public edge-function rate limiting state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  ip TEXT NOT NULL,
  key_part TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_scope_window
  ON public.edge_rate_limits(scope, window_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_updated_at
  ON public.edge_rate_limits(updated_at DESC);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service-role only table; deny direct app access.
REVOKE ALL ON TABLE public.edge_rate_limits FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Tighten message_media mutation policies
--    - Keep SELECT/INSERT for thread participants
--    - Restrict UPDATE/DELETE to coach only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS message_media_update ON storage.objects;
CREATE POLICY message_media_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'message_media'
    AND EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = (storage.foldername(name))[1]::uuid
        AND mt.deleted_at IS NULL
        AND mt.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_media_delete ON storage.objects;
CREATE POLICY message_media_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'message_media'
    AND EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = (storage.foldername(name))[1]::uuid
        AND mt.deleted_at IS NULL
        AND mt.coach_id = auth.uid()
    )
  );
