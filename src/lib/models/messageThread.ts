import { z } from 'zod';

export const messageThreadSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  trainer_id: z.string().optional(),
  unread_count: z.number(),
});
export type MessageThread = z.infer<typeof messageThreadSchema>;
