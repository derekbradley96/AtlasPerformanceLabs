import { z } from 'zod';

export const serviceOfferingSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priceMonthly: z.number(), // cents or display units per spec
  includesCheckins: z.boolean(),
  includesCalls: z.boolean(),
  includesPosing: z.boolean(),
  includesPeakWeek: z.boolean(),
  capacityLimit: z.number().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ServiceOffering = z.infer<typeof serviceOfferingSchema>;

/** Snapshot stored on Lead at application time. */
export const serviceSnapshotSchema = z.object({
  name: z.string(),
  priceMonthly: z.number(),
  includesCheckins: z.boolean(),
  includesCalls: z.boolean(),
  includesPosing: z.boolean(),
  includesPeakWeek: z.boolean(),
});
export type ServiceSnapshot = z.infer<typeof serviceSnapshotSchema>;
