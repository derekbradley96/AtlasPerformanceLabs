/**
 * Coach-owned message templates. Short, professional. Trainer edits before sending.
 */
export type TemplateKey = 'checkin_nudge_cut' | 'checkin_nudge_bulk' | 'checkin_nudge_maintenance' | 'payment_reminder' | 'posing_request';

const TEMPLATES: Record<string, string> = {
  checkin_nudge_cut:
    "Hi! Just a nudge – when you get a chance, please log your check-in for this week. It helps me keep your nutrition and recovery on track for your cut.",
  checkin_nudge_bulk:
    "Hey! Would you mind submitting your check-in when you can? I want to make sure we're progressing well in this phase.",
  checkin_nudge_maintenance:
    "Hi! Quick reminder to log your check-in when you can. Helps me spot any tweaks we need.",
  payment_reminder:
    "Hi! This is a friendly reminder that your payment is overdue. Please settle at your earliest convenience. Thanks!",
  posing_request:
    "Hi! Could you upload your posing updates when you get a chance? I’d like to review before we get closer to show.",
};

export function getTemplate(key: TemplateKey, phase?: string): string {
  if (key === 'checkin_nudge_cut' || key === 'checkin_nudge_bulk' || key === 'checkin_nudge_maintenance') {
    const phaseKey = phase === 'Cut' || phase === 'cut' ? 'checkin_nudge_cut'
      : phase === 'Bulk' || phase === 'Lean Bulk' || phase === 'bulk' ? 'checkin_nudge_bulk'
      : 'checkin_nudge_maintenance';
    return TEMPLATES[phaseKey] ?? TEMPLATES.checkin_nudge_maintenance;
  }
  return TEMPLATES[key] ?? '';
}

export function getCheckinNudgeTemplate(phase: string): string {
  const p = (phase || '').toLowerCase();
  if (p.includes('cut')) return TEMPLATES.checkin_nudge_cut;
  if (p.includes('bulk')) return TEMPLATES.checkin_nudge_bulk;
  return TEMPLATES.checkin_nudge_maintenance;
}

export { TEMPLATES };
