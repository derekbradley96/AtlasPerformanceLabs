-- Community moderation RPCs with explicit coach/admin ownership checks.
-- These provide reliable pin/unpin and soft-delete behavior under strict RLS.

CREATE OR REPLACE FUNCTION public.atlas_community_soft_delete_message(
  p_room_id UUID,
  p_message_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.group_rooms gr
    WHERE gr.id = p_room_id
      AND (
        gr.coach_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      )
  )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed to moderate this room'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.group_messages
  SET
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_message_id
    AND room_id = p_room_id
    AND deleted_at IS NULL;

  UPDATE public.group_rooms
  SET
    pinned_message_id = NULL,
    updated_at = now()
  WHERE id = p_room_id
    AND pinned_message_id = p_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_community_set_pinned_message(
  p_room_id UUID,
  p_message_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.group_rooms gr
    WHERE gr.id = p_room_id
      AND (
        gr.coach_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      )
  )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed to pin in this room'
      USING ERRCODE = '42501';
  END IF;

  IF p_message_id IS NULL THEN
    UPDATE public.group_rooms
    SET
      pinned_message_id = NULL,
      updated_at = now()
    WHERE id = p_room_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_messages gm
    WHERE gm.id = p_message_id
      AND gm.room_id = p_room_id
      AND gm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Pinned message must belong to this room and be active'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.group_rooms
  SET
    pinned_message_id = p_message_id,
    updated_at = now()
  WHERE id = p_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atlas_community_soft_delete_message(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_community_set_pinned_message(UUID, UUID) TO authenticated;
