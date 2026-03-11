import { z } from 'zod';

export const trainerSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  stripe_account_id: z.string().nullable().optional(),
  stripe_connected: z.boolean().optional(),
  created_at: z.string(),
});
export type Trainer = z.infer<typeof trainerSchema>;
