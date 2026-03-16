-- Bug reports from beta users. Authenticated users can insert; admins can read.

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role text,
  page text,
  description text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_status_check;

ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_status_check
  CHECK (status IN ('open', 'reviewing', 'fixed', 'closed'));

CREATE INDEX IF NOT EXISTS bug_reports_reported_by_idx ON public.bug_reports(reported_by);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON public.bug_reports(created_at DESC);

COMMENT ON TABLE public.bug_reports IS 'In-app bug reports from beta users. Status: open, reviewing, fixed, closed.';

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert a report with reported_by = their own id.
DROP POLICY IF EXISTS bug_reports_insert_own ON public.bug_reports;
CREATE POLICY bug_reports_insert_own ON public.bug_reports
  FOR INSERT
  WITH CHECK (reported_by = auth.uid());

-- Users can read their own reports.
DROP POLICY IF EXISTS bug_reports_select_own ON public.bug_reports;
CREATE POLICY bug_reports_select_own ON public.bug_reports
  FOR SELECT
  USING (reported_by = auth.uid());

-- Admins can read all.
DROP POLICY IF EXISTS bug_reports_select_admin ON public.bug_reports;
CREATE POLICY bug_reports_select_admin ON public.bug_reports
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );
