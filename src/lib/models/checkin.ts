import { z } from 'zod';

export const checkinSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  created_at: z.string(),
  weight_avg: z.number().nullable().optional(),
  adherence_pct: z.number().nullable().optional(),
  steps_avg: z.number().nullable().optional(),
  sleep_avg: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CheckIn = z.infer<typeof checkinSchema>;
