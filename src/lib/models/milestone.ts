import { z } from 'zod';

export const milestoneSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  type: z.string(),
  key: z.string(),
  achieved_at: z.string(),
  value_json: z.record(z.unknown()).nullable().optional(),
});
export type Milestone = z.infer<typeof milestoneSchema>;
