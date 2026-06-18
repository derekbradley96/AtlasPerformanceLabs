-- Fix infinite recursion in group_room_members RLS policies.
-- Root cause: policy queried group_room_members within itself.

CREATE OR REPLACE FUNCTION public.can_access_group_room(
  p_room_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_rooms gr
    WHERE gr.id = p_room_id
      AND (
        gr.coach_id = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = p_user_id
            AND p.role = 'admin'
        )
        OR EXISTS (
          SELECT 1
          FROM public.group_room_members gm
          WHERE gm.room_id = p_room_id
            AND gm.user_id = p_user_id
            AND gm.member_status = 'active'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_group_room(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_group_room(UUID, UUID) TO service_role;

DROP POLICY IF EXISTS group_rooms_select ON public.group_rooms;
CREATE POLICY group_rooms_select ON public.group_rooms
  FOR SELECT USING (public.can_access_group_room(id, auth.uid()));

DROP POLICY IF EXISTS group_room_members_select ON public.group_room_members;
CREATE POLICY group_room_members_select ON public.group_room_members
  FOR SELECT USING (public.can_access_group_room(room_id, auth.uid()));

DROP POLICY IF EXISTS group_messages_select ON public.group_messages;
CREATE POLICY group_messages_select ON public.group_messages
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.can_access_group_room(room_id, auth.uid())
  );
