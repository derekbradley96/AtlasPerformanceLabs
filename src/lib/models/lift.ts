import { z } from 'zod';

export const liftSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  created_at: z.string(),
  lift_key: z.string(),
  value: z.number(),
});
export type Lift = z.infer<typeof liftSchema>;
