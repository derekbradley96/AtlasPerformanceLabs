import { z } from 'zod';

export const programAssignmentSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  program_id: z.string(),
  version: z.number(),
  effective_date: z.string(),
  change_log: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ProgramAssignment = z.infer<typeof programAssignmentSchema>;
