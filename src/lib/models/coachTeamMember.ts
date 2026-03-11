import { z } from 'zod';

export const assistantRoleEnum = z.enum([
  'assistant_readonly',
  'assistant_edit_limited',
  'assistant_full',
]);
export type AssistantRole = z.infer<typeof assistantRoleEnum>;

export const coachTeamMemberPermissionsSchema = z.object({
  canViewClients: z.boolean(),
  canReviewCheckins: z.boolean(),
  canReviewPosing: z.boolean(),
  canMessageClients: z.boolean(),
  canEditPrograms: z.boolean(),
  canEditMacros: z.boolean(),
  canExport: z.boolean(),
});
export type CoachTeamMemberPermissions = z.infer<typeof coachTeamMemberPermissionsSchema>;

export const coachTeamMemberSchema = z.object({
  id: z.string(),
  ownerTrainerUserId: z.string(),
  memberUserId: z.string(),
  role: assistantRoleEnum,
  permissions: coachTeamMemberPermissionsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  email: z.string().optional(), // for pending invite
  status: z.enum(['active', 'pending']).optional(),
});
export type CoachTeamMember = z.infer<typeof coachTeamMemberSchema>;
