import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ClipboardList, CreditCard, Trophy, History, AlertTriangle } from 'lucide-react';
import { safeDate } from '@/lib/format';
import { colors } from '@/ui/tokens';

export const DEFAULT_HEALTH_RESULT = {
  score: 0,
  level: 'unknown',
  riskLevel: 'red',
  bandLabel: 'At risk',
  reasons: [],
  actions: [],
  flags: [],
  riskFlags: [],
  meta: { phase: null, daysOut: null, sensitivity: 1, breakdown: { compliance: 0, trend: 0, recovery: 0, comms: 0 } },
  risk: 'high',
  summary: '',
  phase: null,
};

export const STATUS_COLORS = { on_track: colors.success, needs_review: colors.warning, attention: colors.danger };
export const STATUS_LABELS = { on_track: 'On track', needs_review: 'Needs review', attention: 'Attention' };

export const TIMELINE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Review', label: 'Reviews' },
  { key: 'Payment', label: 'Payments' },
  { key: 'Comp Prep', label: 'Comp Prep' },
  { key: 'Milestone', label: 'Milestones' },
  { key: 'Retention', label: 'Retention' },
  { key: 'System', label: 'System' },
];

export async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {
    console.error('[ClientDetail] lightHaptic:', e);
  }
}

export function formatShortDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function timelineDateLabel(iso, todayStart) {
  const d = safeDate(iso);
  const today = safeDate(todayStart);
  if (!d || !today) return '—';
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export function timelineIconForBadge(badge) {
  if (badge === 'Review') return ClipboardList;
  if (badge === 'Payment') return CreditCard;
  if (badge === 'Comp Prep') return Trophy;
  if (badge === 'Milestone') return Trophy;
  if (badge === 'Retention') return AlertTriangle;
  return History;
}

/** Safe wrapper for selectors/helpers that may throw. */
export function safe(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    console.error('[ClientDetail]', e);
    return fallback;
  }
}

export const COACH_REMOVAL_REASON_OPTIONS = [
  'The client has completed their programme',
  "We've mutually agreed to end coaching",
  "The client isn't engaging with the programme",
  'Payment issues',
  "Coaching style isn't a good fit",
  'The client has asked to leave',
  'Other',
];
