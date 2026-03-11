import { z } from 'zod';
import { serviceSnapshotSchema } from './serviceOffering';

export const leadStatusEnum = z.enum([
  'new',
  'contacted',
  'booked_call',
  'converted',
  'archived',
  'booked',
  'lost',
]);
export type LeadStatus = z.infer<typeof leadStatusEnum>;

export const leadSchema = z.object({
  id: z.string(),
  trainer_id: z.string().optional(), // legacy
  trainerUserId: z.string().optional(),
  trainerProfileId: z.string().optional(),
  status: leadStatusEnum,
  source: z.string().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  goals_json: z.record(z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  // Extended application fields
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  applicantName: z.string().optional(),
  goal: z.string().optional(),
  timeline: z.string().optional(),
  budgetRange: z.string().optional(),
  trainingAge: z.string().optional(),
  gymAccess: z.string().optional(),
  equipment: z.string().optional(),
  injuries: z.string().optional(),
  availability: z.string().optional(),
  preferredServiceId: z.string().optional(),
  serviceSnapshot: serviceSnapshotSchema.optional(),
  notes: z.string().optional(),
  clientId: z.string().optional(), // set when converted
});
export type Lead = z.infer<typeof leadSchema>;
