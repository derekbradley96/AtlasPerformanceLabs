/**
 * Milestone / achievement model.
 */
export interface Milestone {
  id: string;
  clientId?: string | null;
  type: string;
  title: string;
  subtitle?: string | null;
  date?: string | null;
  meta?: Record<string, unknown> | null;
  acknowledged_by_trainer_at?: string | null;
}
