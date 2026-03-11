/**
 * Retention trigger model – one item per client, max 3 reasons.
 */

export type RetentionRiskLevel = 'LOW' | 'MED' | 'HIGH';

export interface RetentionRiskSignal {
  key: string;
  label: string;
  severity: number;
  detail: string;
  createdAt: string;
}

export interface RetentionRiskItem {
  clientId: string;
  trainerId: string;
  level: RetentionRiskLevel;
  score: number;
  reasons: RetentionRiskSignal[];
  dedupeKey: string;
  updatedAt: string;
}
