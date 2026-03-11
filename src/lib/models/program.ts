import { z } from 'zod';

export const programSchema = z.object({
  id: z.string(),
  trainer_id: z.string().optional(),
  name: z.string(),
  created_at: z.string().optional(),
});
export type Program = z.infer<typeof programSchema>;
