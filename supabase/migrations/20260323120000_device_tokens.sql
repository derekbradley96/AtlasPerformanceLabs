-- Device token storage for push notifications (profile-scoped).
-- Platform: ios | android.

CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_platform_check CHECK (platform IS NULL OR platform IN ('ios', 'android'))
);

CREATE INDEX device_tokens_profile_idx ON public.device_tokens(profile_id);

COMMENT ON TABLE public.device_tokens IS 'Device push tokens per profile for iOS/Android.';
COMMENT ON COLUMN public.device_tokens.platform IS 'ios | android.';

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_tokens_select_own ON public.device_tokens
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY device_tokens_insert_own ON public.device_tokens
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY device_tokens_update_own ON public.device_tokens
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY device_tokens_delete_own ON public.device_tokens
  FOR DELETE USING (profile_id = auth.uid());
