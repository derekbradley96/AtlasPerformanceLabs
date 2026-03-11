-- Program Builder MVP: allow coaches to update program_blocks (title, total_weeks).
-- program_exercises already has UPDATE/DELETE; program_days are only inserted in MVP.

DROP POLICY IF EXISTS program_blocks_update ON program_blocks;
CREATE POLICY program_blocks_update ON program_blocks FOR UPDATE
  USING (client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()));
