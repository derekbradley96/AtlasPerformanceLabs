-- Soft-delete duplicate active message_threads for the same coach_id + client_id.
-- Keeps the row with the latest updated_at (ties: earliest created_at).

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY coach_id, client_id
      ORDER BY updated_at DESC NULLS LAST, created_at ASC
    ) AS rn
  FROM public.message_threads
  WHERE deleted_at IS NULL
)
UPDATE public.message_threads mt
SET deleted_at = now()
FROM ranked r
WHERE mt.id = r.id
  AND r.rn > 1;
