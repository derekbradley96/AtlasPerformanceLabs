-- Store device push tokens for sending remote notifications (FCM/APNs).
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON public.device_push_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_push_tokens_user_token_platform
  ON public.device_push_tokens(user_id, device_token, platform);

COMMENT ON TABLE public.device_push_tokens IS 'Device push tokens per user for FCM (android) / APNs (ios). One row per user+token+platform.';

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_push_tokens_select_own ON public.device_push_tokens;
DROP POLICY IF EXISTS device_push_tokens_insert_own ON public.device_push_tokens;
DROP POLICY IF EXISTS device_push_tokens_update_own ON public.device_push_tokens;
DROP POLICY IF EXISTS device_push_tokens_delete_own ON public.device_push_tokens;

CREATE POLICY device_push_tokens_select_own ON public.device_push_tokens
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY device_push_tokens_insert_own ON public.device_push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY device_push_tokens_update_own ON public.device_push_tokens
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY device_push_tokens_delete_own ON public.device_push_tokens
  FOR DELETE USING (user_id = auth.uid());
