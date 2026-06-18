-- Make community activation deterministic from app:
-- - allow coach/admin to create room row
-- - allow coach/admin to insert room members
-- - include admin in select/update policies for moderation tooling

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
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS group_rooms_update ON public.group_rooms;
CREATE POLICY group_rooms_update ON public.group_rooms
  FOR UPDATE USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS group_rooms_insert ON public.group_rooms;
CREATE POLICY group_rooms_insert ON public.group_rooms
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

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
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS group_room_members_coach_insert ON public.group_room_members;
CREATE POLICY group_room_members_coach_insert ON public.group_room_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_rooms gr
      WHERE gr.id = group_room_members.room_id
        AND (
          gr.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS group_room_members_coach_moderate ON public.group_room_members;
CREATE POLICY group_room_members_coach_moderate ON public.group_room_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.group_rooms gr
      WHERE gr.id = group_room_members.room_id
        AND (
          gr.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_rooms gr
      WHERE gr.id = group_room_members.room_id
        AND (
          gr.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );
