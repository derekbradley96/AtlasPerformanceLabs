/**
 * Intake validation: enforce required fields at submit.
 */
import type { IntakeTemplate, IntakeSection, IntakeQuestion } from './intakeTypes';

export interface ValidationError {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  questionLabel: string;
  message: string;
}

export function validateSubmission(
  template: IntakeTemplate,
  answers: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const section of template.sections) {
    for (const q of section.questions) {
      if (!q.required) continue;
      const value = answers[q.id];
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);
      if (empty) {
        errors.push({
          sectionId: section.id,
          sectionTitle: section.title,
          questionId: q.id,
          questionLabel: q.label,
          message: `${q.label} is required`,
        });
      }
    }
  }
  return errors;
}
