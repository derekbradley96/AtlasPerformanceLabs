-- Community moderation controls:
-- - coach-visible room rules text
-- - coach policy to mute/ban members
-- - prevent muted members from posting
-- - preserve coach bans during roster sync

ALTER TABLE public.group_rooms
  ADD COLUMN IF NOT EXISTS rules_text TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.group_rooms.rules_text IS
  'Coach-defined community rules shown to members.';

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

  INSERT INTO public.group_room_members (room_id, user_id, role, member_status, is_muted)
  SELECT v_room_id, c.user_id, 'client', 'active', false
  FROM public.clients c
  WHERE c.coach_id = p_coach_id
    AND c.user_id IS NOT NULL
    AND COALESCE(NULLIF(trim(c.billing_status::text), ''), 'active') <> 'pending_payment'
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET role = 'client',
        member_status = CASE
          WHEN group_room_members.member_status = 'removed' AND group_room_members.is_muted = true THEN group_room_members.member_status
          ELSE 'active'
        END;

  UPDATE public.group_room_members m
  SET member_status = 'removed'
  WHERE m.room_id = v_room_id
    AND m.role = 'client'
    AND m.is_muted = false
    AND NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.coach_id = p_coach_id
        AND c.user_id = m.user_id
        AND COALESCE(NULLIF(trim(c.billing_status::text), ''), 'active') <> 'pending_payment'
    );
END;
$$;

DROP POLICY IF EXISTS group_room_members_coach_moderate ON public.group_room_members;
CREATE POLICY group_room_members_coach_moderate ON public.group_room_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.group_rooms gr
      WHERE gr.id = group_room_members.room_id
        AND gr.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_rooms gr
      WHERE gr.id = group_room_members.room_id
        AND gr.coach_id = auth.uid()
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
        AND m.is_muted = false
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
