/**
 * Extract intake flags from answers + template. Admin intelligence only; no training plan generation.
 */
import type { IntakeTemplate, IntakeFlags, IntakeQuestion } from './intakeTypes';

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(', ');
  return String(v);
}

function sectionLooksLikeScreening(sectionTitle: string): boolean {
  const t = sectionTitle.toLowerCase();
  return /screen|readiness|par-q|medical|health\s*check/.test(t);
}

function questionLooksLikeInjuries(label: string): boolean {
  const l = label.toLowerCase();
  return /injur|pain|condition|limitation|ache|problem/.test(l);
}

function questionLooksLikeEquipment(label: string): boolean {
  const l = label.toLowerCase();
  return /equipment|gym|machine|dumbbell|weight|access/.test(l);
}

function questionLooksLikePreference(label: string): boolean {
  const l = label.toLowerCase();
  return /prefer|goal|like|want|enjoy/.test(l);
}

function questionLooksLikeBaseline(label: string): boolean {
  const l = label.toLowerCase();
  return /weight|height|age|bench|squat|deadlift|max|rep|1rm|baseline/.test(l);
}

export function extractFlags(answers: Record<string, unknown>, template: IntakeTemplate): IntakeFlags {
  const readinessRedFlags: string[] = [];
  const injuries: string[] = [];
  const equipmentLimits: string[] = [];
  const preferences: string[] = [];
  const baselineMetrics: Record<string, number> = {};

  for (const section of template.sections || []) {
    const isScreening = sectionLooksLikeScreening(section.title || '');

    for (const q of section.questions || []) {
      const raw = answers[q.id];
      const value = asString(raw);
      const label = (q.label || '').toLowerCase();

      if (isScreening && (q.type === 'yesNo' || (q.options && q.options.some((o) => /yes|no/i.test(o))))) {
        const yes = /^yes|true|1$/i.test(value) || (Array.isArray(raw) && raw.some((x) => /^yes|true|1$/i.test(asString(x))));
        if (yes) readinessRedFlags.push(`${section.title}: ${q.label}`);
      }

      if (questionLooksLikeInjuries(q.label || '')) {
        if (value) injuries.push(value);
      }
      if (questionLooksLikeEquipment(q.label || '')) {
        if (value) equipmentLimits.push(value);
      }
      if (questionLooksLikePreference(q.label || '')) {
        if (value) preferences.push(value);
      }
      if (questionLooksLikeBaseline(q.label || '') && (q.type === 'number' || typeof raw === 'number')) {
        const num = typeof raw === 'number' ? raw : parseFloat(value);
        if (!Number.isNaN(num)) baselineMetrics[q.id] = num;
      }
    }
  }

  return {
    readinessRedFlags: readinessRedFlags.length ? readinessRedFlags : undefined,
    injuries: injuries.length ? injuries : undefined,
    equipmentLimits: equipmentLimits.length ? equipmentLimits : undefined,
    preferences: preferences.length ? preferences : undefined,
    baselineMetrics: Object.keys(baselineMetrics).length ? baselineMetrics : undefined,
  };
}
