-- Coach-owned community room (one active room per coach). Members = coach + linked active clients.
-- See docs/COACH_COMMUNITY_ROOM_MVP.md for product rules.

CREATE TYPE public.group_room_mode AS ENUM ('community', 'coach_led');

CREATE TYPE public.group_room_member_role AS ENUM ('coach', 'client');

CREATE TYPE public.group_message_type AS ENUM (
  'text',
  'image',
  'video',
  'meal_share',
  'workout_share',
  'win_share',
  'announcement'
);

CREATE TABLE IF NOT EXISTS public.group_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Team',
  room_mode public.group_room_mode NOT NULL DEFAULT 'community',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  pinned_message_id UUID,
  room_muted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_rooms_one_per_coach UNIQUE (coach_id)
);

COMMENT ON TABLE public.group_rooms IS 'Single community room per coach; coach_id = auth user id of coach profile.';

CREATE TABLE IF NOT EXISTS public.group_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.group_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_room_member_role NOT NULL,
  member_status TEXT NOT NULL DEFAULT 'active' CHECK (member_status IN ('active', 'removed')),
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_room_members_room_user UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_room_members_user ON public.group_room_members(user_id) WHERE member_status = 'active';
CREATE INDEX IF NOT EXISTS idx_group_room_members_room ON public.group_room_members(room_id) WHERE member_status = 'active';

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.group_rooms(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role public.group_room_member_role NOT NULL,
  message_type public.group_message_type NOT NULL,
  body TEXT,
  media_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_group_messages_room_created ON public.group_messages(room_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.group_rooms
  ADD CONSTRAINT group_rooms_pinned_message_fk
  FOREIGN KEY (pinned_message_id) REFERENCES public.group_messages(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Sync membership from clients roster (linked + not pending_payment)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atlas_sync_community_members(p_coach_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id UUID;
BEGIN
  SELECT id INTO v_room_id FROM public.group_rooms WHERE coach_id = p_coach_id LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO public.group_rooms (coach_id, name, room_mode)
    VALUES (p_coach_id, 'Team', 'community')
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO public.group_room_members (room_id, user_id, role, member_status)
  VALUES (v_room_id, p_coach_id, 'coach', 'active')
  ON CONFLICT (room_id, user_id) DO UPDATE SET member_status = 'active', role = 'coach';

  INSERT INTO public.group_room_members (room_id, user_id, role, member_status)
  SELECT v_room_id, c.user_id, 'client', 'active'
  FROM public.clients c
  WHERE c.coach_id = p_coach_id
    AND c.user_id IS NOT NULL
    AND COALESCE(NULLIF(trim(c.billing_status::text), ''), 'active') <> 'pending_payment'
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET member_status = 'active', role = 'client';

  UPDATE public.group_room_members m
  SET member_status = 'removed'
  WHERE m.room_id = v_room_id
    AND m.role = 'client'
    AND NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.coach_id = p_coach_id
        AND c.user_id = m.user_id
        AND COALESCE(NULLIF(trim(c.billing_status::text), ''), 'active') <> 'pending_payment'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_sync_community_members_from_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.coach_id IS NOT NULL THEN
      PERFORM public.atlas_sync_community_members(OLD.coach_id);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.coach_id IS NOT NULL THEN
    PERFORM public.atlas_sync_community_members(NEW.coach_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.coach_id IS NOT NULL AND OLD.coach_id IS DISTINCT FROM NEW.coach_id THEN
    PERFORM public.atlas_sync_community_members(OLD.coach_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_sync_community ON public.clients;
CREATE TRIGGER trg_clients_sync_community
  AFTER INSERT OR UPDATE OF user_id, coach_id, billing_status OR DELETE
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.atlas_sync_community_members_from_clients();

-- ---------------------------------------------------------------------------
-- coach_led: structured client posts or replies (no unrestricted client top-level text/image/video)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atlas_group_messages_enforce_coach_led()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_mode public.group_room_mode;
  v_is_coach BOOLEAN;
BEGIN
  SELECT gr.room_mode INTO v_mode
  FROM public.group_rooms gr
  WHERE gr.id = NEW.room_id;

  v_is_coach := NEW.sender_role = 'coach';

  IF v_mode = 'coach_led' AND NOT v_is_coach THEN
    IF NEW.message_type IN ('text', 'image', 'video') AND NEW.reply_to_id IS NULL THEN
      RAISE EXCEPTION 'coach_led room: use reply for text/media, or post a meal/workout/win share'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_messages_coach_led ON public.group_messages;
CREATE TRIGGER trg_group_messages_coach_led
  BEFORE INSERT ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.atlas_group_messages_enforce_coach_led();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_rooms_select ON public.group_rooms;
CREATE POLICY group_rooms_select ON public.group_rooms
  FOR SELECT USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_room_members m
      WHERE m.room_id = group_rooms.id
        AND m.user_id = auth.uid()
        AND m.member_status = 'active'
    )
  );

DROP POLICY IF EXISTS group_rooms_update ON public.group_rooms;
CREATE POLICY group_rooms_update ON public.group_rooms
  FOR UPDATE USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS group_room_members_select ON public.group_room_members;
CREATE POLICY group_room_members_select ON public.group_room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_rooms gr
      WHERE gr.id = group_room_members.room_id
        AND (
          gr.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.group_room_members m2
            WHERE m2.room_id = gr.id AND m2.user_id = auth.uid() AND m2.member_status = 'active'
          )
        )
    )
  );

-- Members are maintained by trigger + SECURITY DEFINER sync, not direct client writes
DROP POLICY IF EXISTS group_room_members_modify ON public.group_room_members;
CREATE POLICY group_room_members_self_mute ON public.group_room_members
  FOR UPDATE USING (user_id = auth.uid() AND member_status = 'active')
  WITH CHECK (user_id = auth.uid() AND member_status = 'active');

DROP POLICY IF EXISTS group_messages_select ON public.group_messages;
CREATE POLICY group_messages_select ON public.group_messages
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.group_rooms gr
      WHERE gr.id = group_messages.room_id
        AND (
          gr.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.group_room_members m
            WHERE m.room_id = gr.id AND m.user_id = auth.uid() AND m.member_status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS group_messages_insert ON public.group_messages;
CREATE POLICY group_messages_insert ON public.group_messages
  FOR INSERT WITH CHECK (
    sender_user_id = auth.uid()
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.group_room_members m
      WHERE m.room_id = room_id
        AND m.user_id = auth.uid()
        AND m.member_status = 'active'
        AND (
          (m.role = 'coach' AND sender_role = 'coach')
          OR (m.role = 'client' AND sender_role = 'client')
        )
    )
    AND (
      (sender_role = 'coach' AND message_type IN ('text', 'image', 'video', 'announcement'))
      OR (
        sender_role = 'client'
        AND message_type IN ('text', 'image', 'video', 'meal_share', 'workout_share', 'win_share')
      )
    )
  );

DROP POLICY IF EXISTS group_messages_update ON public.group_messages;
CREATE POLICY group_messages_soft_delete ON public.group_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_rooms gr
      WHERE gr.id = group_messages.room_id AND gr.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_rooms gr
      WHERE gr.id = group_messages.room_id AND gr.coach_id = auth.uid()
    )
  );

-- Realtime (optional; app may poll)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

COMMENT ON FUNCTION public.atlas_sync_community_members IS 'Ensures one room per coach and syncs roster clients (excludes pending_payment unlinked).';

GRANT EXECUTE ON FUNCTION public.atlas_sync_community_members(uuid) TO authenticated;
