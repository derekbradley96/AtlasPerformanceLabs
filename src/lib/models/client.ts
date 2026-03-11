import { z } from 'zod';

export const clientPhaseEnum = z.enum(['bulk', 'cut', 'maintenance']);
export type ClientPhase = z.infer<typeof clientPhaseEnum>;

export const clientSchema = z.object({
  id: z.string(),
  trainer_id: z.string(),
  name: z.string(),
  phase: clientPhaseEnum,
  phase_started_at: z.string().nullable().optional(),
  baseline_weight: z.number().nullable().optional(),
  gym_name: z.string().nullable().optional(),
  gym_equipment_json: z.record(z.unknown()).nullable().optional(),
  created_at: z.string(),
  // Competition prep (optional)
  federation: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  prep_phase: z.string().nullable().optional(),
  show_date: z.string().nullable().optional(),
});
export type Client = z.infer<typeof clientSchema>;
