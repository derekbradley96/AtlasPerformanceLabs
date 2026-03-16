-- Public enquiries from coach profile (anonymous leads). Separate from coach_inquiries (authenticated users).
CREATE TABLE IF NOT EXISTS public.coach_public_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT,
  enquiry_name TEXT,
  enquiry_email TEXT,
  enquiry_goal TEXT,
  enquiry_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new'
);

ALTER TABLE public.coach_public_enquiries
  DROP CONSTRAINT IF EXISTS coach_public_enquiries_enquiry_type_check;
ALTER TABLE public.coach_public_enquiries
  ADD CONSTRAINT coach_public_enquiries_enquiry_type_check
  CHECK (enquiry_type IS NULL OR enquiry_type IN ('transformation', 'competition', 'general'));

ALTER TABLE public.coach_public_enquiries
  DROP CONSTRAINT IF EXISTS coach_public_enquiries_status_check;
ALTER TABLE public.coach_public_enquiries
  ADD CONSTRAINT coach_public_enquiries_status_check
  CHECK (status IN ('new', 'contacted', 'converted', 'closed'));

CREATE INDEX IF NOT EXISTS coach_public_enquiries_coach_id_idx ON public.coach_public_enquiries(coach_id);
CREATE INDEX IF NOT EXISTS coach_public_enquiries_created_at_idx ON public.coach_public_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS coach_public_enquiries_status_idx ON public.coach_public_enquiries(status) WHERE status = 'new';

COMMENT ON TABLE public.coach_public_enquiries IS 'Enquiries from public coach profile (anonymous). Becomes a lead; coach sees in enquiries inbox.';

ALTER TABLE public.coach_public_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_public_enquiries_select_own ON public.coach_public_enquiries;
CREATE POLICY coach_public_enquiries_select_own ON public.coach_public_enquiries
  FOR SELECT USING (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_public_enquiries_update_own ON public.coach_public_enquiries;
CREATE POLICY coach_public_enquiries_update_own ON public.coach_public_enquiries
  FOR UPDATE USING (coach_id = auth.uid());

-- Insert from public (no auth) is done via Edge Function with service role
-- No INSERT policy for authenticated; coaches do not insert their own public enquiries
