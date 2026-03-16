-- One-off: attach the two given clients to the given coach.
-- Coach: 11765c7b-06a9-491b-a714-382d15eb16d8
-- Clients: 1f264d57-2f85-4bd3-bb99-17ff280fd4ba, dff87fd2-7837-4251-993b-56c72999e5f8

UPDATE public.clients
SET coach_id = '11765c7b-06a9-491b-a714-382d15eb16d8',
    trainer_id = '11765c7b-06a9-491b-a714-382d15eb16d8'
WHERE id IN (
  '1f264d57-2f85-4bd3-bb99-17ff280fd4ba',
  'dff87fd2-7837-4251-993b-56c72999e5f8'
);

-- Sync client_state so coach-scoped views show these clients
INSERT INTO public.client_state (client_id, coach_id, updated_at)
SELECT c.id, c.coach_id, now()
FROM public.clients c
WHERE c.id IN (
  '1f264d57-2f85-4bd3-bb99-17ff280fd4ba',
  'dff87fd2-7837-4251-993b-56c72999e5f8'
)
ON CONFLICT (client_id) DO UPDATE SET
  coach_id = EXCLUDED.coach_id,
  updated_at = now();
