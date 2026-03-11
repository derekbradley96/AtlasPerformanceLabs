/**
 * Client model – aligns with Supabase clients / mock.
 */
export interface Client {
  id: string;
  user_id?: string | null;
  trainer_id: string;
  full_name: string;
  email?: string | null;
  subscription_status?: string | null;
  status: 'on_track' | 'needs_review' | 'attention';
  payment_overdue?: boolean;
  last_check_in_at?: string | null;
  phase?: string | null;
  phaseStartedAt?: string | null;
  baselineWeight?: number | null;
  baselineStrength?: Record<string, number> | null;
  created_date?: string | null;
  federation?: string | null;
  division?: string | null;
  prepPhase?: string | null;
  showDate?: string | null;
  /** From approved intake; equipment / gym access. */
  equipmentProfile?: string[] | string | null;
  /** From approved intake; injuries / limitations. */
  injuries?: string[] | null;
  /** From approved intake; preferences. */
  preferences?: string[] | null;
  /** From approved intake; baseline metrics (e.g. weight, 1RM). */
  baselineMetrics?: Record<string, number> | null;
}
