/**
 * Client Intake: locked data models. Admin intelligence only; no training plan generation.
 */

export type IntakeQuestionType =
  | 'shortText'
  | 'longText'
  | 'number'
  | 'yesNo'
  | 'singleSelect'
  | 'multiSelect'
  | 'date';

export interface IntakeQuestion {
  id: string;
  type: IntakeQuestionType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  order: number;
}

export interface IntakeSection {
  id: string;
  title: string;
  order: number;
  questions: IntakeQuestion[];
}

export interface IntakeTemplate {
  id: string;
  trainerId: string;
  name: string;
  serviceType: string;
  sections: IntakeSection[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type IntakeSubmissionStatus = 'draft' | 'submitted' | 'needs_changes' | 'approved';

export interface IntakeSubmission {
  id: string;
  trainerId: string;
  clientId: string | null;
  leadId?: string | null;
  templateId: string;
  status: IntakeSubmissionStatus;
  answers: Record<string, unknown>;
  flags: IntakeFlags;
  submittedAt: string | null;
  approvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeFlags {
  phase?: string;
  readinessRedFlags?: string[];
  injuries?: string[];
  equipmentLimits?: string[];
  preferences?: string[];
  baselineMetrics?: Record<string, number>;
}
