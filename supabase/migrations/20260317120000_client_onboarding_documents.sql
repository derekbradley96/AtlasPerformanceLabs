-- Client onboarding: extra client fields, coach documents (contract/T&Cs/PAR-Q), and acceptances.
-- Coaches add documents; clients see and accept during onboarding.

-- 1) Extra columns on public.clients for onboarding details
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS goals TEXT,
  ADD COLUMN IF NOT EXISTS previous_experience TEXT,
  ADD COLUMN IF NOT EXISTS medical_history TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_notes TEXT;

COMMENT ON COLUMN public.clients.goals IS 'Client fitness/coaching goals from onboarding.';
COMMENT ON COLUMN public.clients.previous_experience IS 'Previous gym/exercise experience from onboarding.';
COMMENT ON COLUMN public.clients.medical_history IS 'Medical history if any, from onboarding.';
COMMENT ON COLUMN public.clients.onboarding_notes IS 'Additional notes from client during onboarding.';

-- 2) Coach documents: contract, terms, PAR-Q (what clients see and accept)
CREATE TABLE IF NOT EXISTS public.coach_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('contract', 'terms', 'par_q')),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_documents_coach_id ON public.coach_documents(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_documents_coach_type ON public.coach_documents(coach_id, type);

ALTER TABLE public.coach_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_documents_select_own ON public.coach_documents;
CREATE POLICY coach_documents_select_own ON public.coach_documents
  FOR SELECT USING (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_documents_insert_own ON public.coach_documents;
CREATE POLICY coach_documents_insert_own ON public.coach_documents
  FOR INSERT WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_documents_update_own ON public.coach_documents;
CREATE POLICY coach_documents_update_own ON public.coach_documents
  FOR UPDATE USING (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_documents_delete_own ON public.coach_documents;
CREATE POLICY coach_documents_delete_own ON public.coach_documents
  FOR DELETE USING (coach_id = auth.uid());

COMMENT ON TABLE public.coach_documents IS 'Documents coaches add for client onboarding: contract, terms, PAR-Q. Shown to clients during signup.';

-- 3) Client document acceptances (record when client accepted during onboarding)
CREATE TABLE IF NOT EXISTS public.client_document_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.coach_documents(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  par_q_answers JSONB,
  UNIQUE(client_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_client_document_acceptances_client ON public.client_document_acceptances(client_id);
CREATE INDEX IF NOT EXISTS idx_client_document_acceptances_document ON public.client_document_acceptances(document_id);

ALTER TABLE public.client_document_acceptances ENABLE ROW LEVEL SECURITY;

-- Coach can read acceptances for their clients
DROP POLICY IF EXISTS client_document_acceptances_select_coach ON public.client_document_acceptances;
CREATE POLICY client_document_acceptances_select_coach ON public.client_document_acceptances
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE COALESCE(coach_id, trainer_id) = auth.uid())
  );

-- Service role / Edge Function will insert (no policy for insert from client for onboarding - done via function)
-- Client can read own acceptances via clients.user_id
DROP POLICY IF EXISTS client_document_acceptances_select_client ON public.client_document_acceptances;
CREATE POLICY client_document_acceptances_select_client ON public.client_document_acceptances
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.client_document_acceptances IS 'Records when a client accepted a coach document during onboarding.';

-- 4) RPC: list coach onboarding documents (for client onboarding screen; no auth so client can call with coach_id)
CREATE OR REPLACE FUNCTION public.get_coach_onboarding_documents(p_coach_id UUID)
RETURNS TABLE (id UUID, type TEXT, title TEXT, content TEXT, sort_order INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.type, d.title, d.content, d.sort_order
  FROM public.coach_documents d
  WHERE d.coach_id = p_coach_id
  ORDER BY d.sort_order ASC, d.type, d.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_coach_onboarding_documents(UUID) IS 'Returns coach documents for client onboarding (contract, terms, PAR-Q). Callable without auth.';

GRANT EXECUTE ON FUNCTION public.get_coach_onboarding_documents(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_coach_onboarding_documents(UUID) TO authenticated;
