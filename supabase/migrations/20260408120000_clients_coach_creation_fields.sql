-- Coach-side client creation: optional fields aligned with Clients.jsx + supabaseClientsRepo.createClient.
-- Safe IF NOT EXISTS for environments that already added columns manually.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS show_date date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gym_equipment_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients.email IS 'Optional contact email (import or coach-entered). Distinct from auth until client links account.';
COMMENT ON COLUMN public.clients.start_date IS 'Coach-entered coaching start date (ISO date).';
COMMENT ON COLUMN public.clients.show_date IS 'Active prep show date (denormalized for roster filters; also in contest_preps when prep is active).';
COMMENT ON COLUMN public.clients.gym_equipment_json IS 'Equipment tags from coach add-client flow; JSON array of strings.';
COMMENT ON COLUMN public.clients.goals IS 'Coach-set training goal keyword: bulk | cut | maintain (and free text if needed).';
