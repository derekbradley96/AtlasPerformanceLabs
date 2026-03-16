-- Coach referral codes, referral events, and public result stories for Atlas growth and success stories.

-- =============================================================================
-- 1) COACH_REFERRAL_CODES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_referral_codes_code_key
  ON public.coach_referral_codes(code);

CREATE INDEX IF NOT EXISTS coach_referral_codes_coach_idx
  ON public.coach_referral_codes(coach_id);

CREATE INDEX IF NOT EXISTS coach_referral_codes_active_idx
  ON public.coach_referral_codes(coach_id) WHERE is_active = true;

COMMENT ON TABLE public.coach_referral_codes IS 'Referral codes owned by coaches for tracking link opens, profile views, enquiries, signups.';

ALTER TABLE public.coach_referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_referral_codes_select_own ON public.coach_referral_codes;
DROP POLICY IF EXISTS coach_referral_codes_insert_own ON public.coach_referral_codes;
DROP POLICY IF EXISTS coach_referral_codes_update_own ON public.coach_referral_codes;

CREATE POLICY coach_referral_codes_select_own ON public.coach_referral_codes
  FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY coach_referral_codes_insert_own ON public.coach_referral_codes
  FOR INSERT WITH CHECK (coach_id = auth.uid());
CREATE POLICY coach_referral_codes_update_own ON public.coach_referral_codes
  FOR UPDATE USING (coach_id = auth.uid());

-- =============================================================================
-- 2) COACH_REFERRAL_EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_referral_events
  DROP CONSTRAINT IF EXISTS coach_referral_events_event_type_check;

ALTER TABLE public.coach_referral_events
  ADD CONSTRAINT coach_referral_events_event_type_check
  CHECK (event_type IN ('link_opened', 'profile_viewed', 'enquiry_started', 'signup_completed'));

CREATE INDEX IF NOT EXISTS coach_referral_events_coach_created_idx
  ON public.coach_referral_events(coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_referral_events_code_idx
  ON public.coach_referral_events(code);

CREATE INDEX IF NOT EXISTS coach_referral_events_type_idx
  ON public.coach_referral_events(event_type);

COMMENT ON TABLE public.coach_referral_events IS 'Events triggered when a referral code is used: link opened, profile viewed, enquiry, signup.';

ALTER TABLE public.coach_referral_events ENABLE ROW LEVEL SECURITY;

-- Coach can read their own events; insert allowed for service/anonymous (tracking) or coach
DROP POLICY IF EXISTS coach_referral_events_select_own ON public.coach_referral_events;
DROP POLICY IF EXISTS coach_referral_events_insert ON public.coach_referral_events;

CREATE POLICY coach_referral_events_select_own ON public.coach_referral_events
  FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY coach_referral_events_insert ON public.coach_referral_events
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 3) CLIENT_RESULT_STORIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_result_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  story_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  before_image_path TEXT,
  after_image_path TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_result_stories
  DROP CONSTRAINT IF EXISTS client_result_stories_story_type_check;

ALTER TABLE public.client_result_stories
  ADD CONSTRAINT client_result_stories_story_type_check
  CHECK (story_type IN ('transformation', 'prep'));

CREATE INDEX IF NOT EXISTS client_result_stories_coach_idx
  ON public.client_result_stories(coach_id);

CREATE INDEX IF NOT EXISTS client_result_stories_public_idx
  ON public.client_result_stories(coach_id, created_at DESC) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS client_result_stories_client_idx
  ON public.client_result_stories(client_id) WHERE client_id IS NOT NULL;

COMMENT ON TABLE public.client_result_stories IS 'Coach-curated result stories (transformation/prep) for public results pages.';

ALTER TABLE public.client_result_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_result_stories_select_own ON public.client_result_stories;
DROP POLICY IF EXISTS client_result_stories_select_public ON public.client_result_stories;
DROP POLICY IF EXISTS client_result_stories_insert_own ON public.client_result_stories;
DROP POLICY IF EXISTS client_result_stories_update_own ON public.client_result_stories;
DROP POLICY IF EXISTS client_result_stories_delete_own ON public.client_result_stories;

CREATE POLICY client_result_stories_select_own ON public.client_result_stories
  FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY client_result_stories_select_public ON public.client_result_stories
  FOR SELECT USING (is_public = true);
CREATE POLICY client_result_stories_insert_own ON public.client_result_stories
  FOR INSERT WITH CHECK (coach_id = auth.uid());
CREATE POLICY client_result_stories_update_own ON public.client_result_stories
  FOR UPDATE USING (coach_id = auth.uid());
CREATE POLICY client_result_stories_delete_own ON public.client_result_stories
  FOR DELETE USING (coach_id = auth.uid());

-- =============================================================================
-- 4) RESULT_STORY_METRICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.result_story_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.client_result_stories(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS result_story_metrics_story_idx
  ON public.result_story_metrics(story_id);

COMMENT ON TABLE public.result_story_metrics IS 'Key-value metrics per result story (e.g. weight lost, weeks, category).';

ALTER TABLE public.result_story_metrics ENABLE ROW LEVEL SECURITY;

-- Access via story ownership
DROP POLICY IF EXISTS result_story_metrics_select ON public.result_story_metrics;
DROP POLICY IF EXISTS result_story_metrics_insert ON public.result_story_metrics;
DROP POLICY IF EXISTS result_story_metrics_update ON public.result_story_metrics;
DROP POLICY IF EXISTS result_story_metrics_delete ON public.result_story_metrics;

CREATE POLICY result_story_metrics_select ON public.result_story_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.client_result_stories s WHERE s.id = story_id AND (s.coach_id = auth.uid() OR s.is_public = true))
  );
CREATE POLICY result_story_metrics_insert ON public.result_story_metrics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.client_result_stories s WHERE s.id = story_id AND s.coach_id = auth.uid())
  );
CREATE POLICY result_story_metrics_update ON public.result_story_metrics
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.client_result_stories s WHERE s.id = story_id AND s.coach_id = auth.uid())
  );
CREATE POLICY result_story_metrics_delete ON public.result_story_metrics
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.client_result_stories s WHERE s.id = story_id AND s.coach_id = auth.uid())
  );

-- =============================================================================
-- Schema summary
-- =============================================================================
-- public.coach_referral_codes:
--   id, coach_id (FK profiles), code (unique), is_active, created_at
--   Indexes: code unique, coach_id, (coach_id WHERE is_active)
--
-- public.coach_referral_events:
--   id, coach_id (FK profiles), code, event_type (link_opened|profile_viewed|enquiry_started|signup_completed), metadata, created_at
--   Indexes: (coach_id, created_at DESC), code, event_type
--
-- public.client_result_stories:
--   id, coach_id (FK profiles), client_id (FK clients nullable), story_type (transformation|prep), title, summary,
--   before_image_path, after_image_path, is_public, created_at
--   Indexes: coach_id, (coach_id, created_at WHERE is_public), client_id
--
-- public.result_story_metrics:
--   id, story_id (FK client_result_stories), metric_key, metric_label, metric_value, sort_order
--   Index: story_id
