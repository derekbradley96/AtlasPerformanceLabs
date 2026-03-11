-- Retention review items: table for nightly job to create review items for high retention risk.
-- coach_id = auth uid (public.clients.trainer_id); client_id = public.clients.id.

CREATE TABLE IF NOT EXISTS public.atlas_retention_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'retention_risk',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_atlas_retention_review_items_coach_id ON public.atlas_retention_review_items(coach_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_atlas_retention_review_items_unresolved_dedupe
  ON public.atlas_retention_review_items (coach_id, client_id) WHERE type = 'retention_risk' AND resolved_at IS NULL;

COMMENT ON TABLE public.atlas_retention_review_items IS 'Review items created by retention-alerts job for high retention risk. One unresolved row per (coach_id, client_id) for type retention_risk.';