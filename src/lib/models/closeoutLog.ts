import { z } from 'zod';

export const closeoutLogSchema = z.object({
  id: z.string(),
  trainer_id: z.string(),
  date: z.string(),
  focus_score: z.number().nullable().optional(),
  streak: z.number().nullable().optional(),
  totals_json: z.record(z.unknown()).nullable().optional(),
  created_at: z.string(),
});
export type CloseoutLog = z.infer<typeof closeoutLogSchema>;
