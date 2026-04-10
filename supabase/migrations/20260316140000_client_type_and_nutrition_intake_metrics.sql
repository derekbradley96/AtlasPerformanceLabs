-- Client journey (transformation vs competition) + persist nutrition calculator inputs on the plan row.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'transformation';

COMMENT ON COLUMN public.clients.client_type IS 'transformation | competition | integrated — drives client UX and prep surfaces.';

CREATE INDEX IF NOT EXISTS idx_clients_client_type ON public.clients(client_type);

ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS intake_metrics jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.nutrition_plans.intake_metrics IS 'Calculator snapshot: sex, age, height_cm, weight_kg, activity_level, goal, macro percents.';
