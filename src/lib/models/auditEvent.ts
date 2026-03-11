import { z } from 'zod';

export const auditEventSchema = z.object({
  id: z.string(),
  actorUserId: z.string(),
  ownerTrainerUserId: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  action: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
