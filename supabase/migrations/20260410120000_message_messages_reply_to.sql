-- Thread replies: reference prior message in same thread (coach + client).
ALTER TABLE public.message_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.message_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_messages_reply_to_id ON public.message_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

COMMENT ON COLUMN public.message_messages.reply_to_id IS 'Optional reference to another message in the same thread (reply threading).';
