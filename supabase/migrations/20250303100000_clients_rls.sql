-- RLS on public.clients so only the owning coach can access their clients.
-- Assumes clients.trainer_id = auth.uid() (auth user id). If your schema uses
-- clients.trainer_id REFERENCES trainers(id), use:
--   USING (trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()))
-- Prevents Coach A from deleting or viewing Coach B's clients via direct URL or tampered id.

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select_own ON clients;
CREATE POLICY clients_select_own ON clients
  FOR SELECT USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS clients_insert_own ON clients;
CREATE POLICY clients_insert_own ON clients
  FOR INSERT WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS clients_update_own ON clients;
CREATE POLICY clients_update_own ON clients
  FOR UPDATE USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS clients_delete_own ON clients;
CREATE POLICY clients_delete_own ON clients
  FOR DELETE USING (trainer_id = auth.uid());
