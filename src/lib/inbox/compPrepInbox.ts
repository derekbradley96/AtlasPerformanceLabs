/**
 * Comp Prep → Trainer Inbox: build POSING_SUBMISSION_REVIEW, MISSING_MANDATORY_POSES, PEAK_WEEK_DUE items.
 */
import type { ClientCompProfile, CompMediaLog, PrepPhase } from '@/lib/models/compPrep';
import type { Pose } from '@/lib/models/poseLibrary';
import {
  missingPoseWindowByPhase,
  showProximityThresholdDays,
} from '@/lib/inbox/compPrepConfig';

/** Minimal client shape for display (id, full_name). */
export interface InboxClient {
  id: string;
  full_name: string;
}

export interface BuildCompPrepInboxInput {
  trainerId: string;
  clients: InboxClient[];
  compProfiles: ClientCompProfile[];
  poses: Pose[];
  mediaLogs: CompMediaLog[];
  now: Date;
  /** True if client has a check-in submitted today (for PEAK_WEEK_DUE daily record). */
  hasCheckinToday: (clientId: string) => boolean;
}

/** One comp-prep inbox item (same shape as inboxService items for merge). */
export interface CompPrepInboxItem {
  id: string;
  type: 'POSING_SUBMISSION_REVIEW' | 'MISSING_MANDATORY_POSES' | 'PEAK_WEEK_DUE';
  clientId: string;
  leadId: null;
  title: string;
  subtitle: string;
  why: string;
  badge: { label: string; tone: string };
  badgeLabel: string;
  badgeTone: string;
  priorityBadge: string;
  ageLabel: string;
  priorityScore: number;
  primaryAction: { label: string; type: string; [k: string]: unknown };
  primaryCtaLabel: string;
  actionRoute: string;
  secondaryActions: Array<{ id: string; label: string }>;
  createdAt: string;
  raw: unknown;
  showDate?: string;
}

function hoursSince(iso: string): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function formatAgeLabel(iso: string): string {
  if (!iso) return '';
  const h = hoursSince(iso);
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function getMandatoryPosesForDivision(
  poses: Pose[],
  sex: 'MALE' | 'FEMALE',
  division: string
): Pose[] {
  return (poses ?? []).filter(
    (p) =>
      p?.sex === sex &&
      p?.isMandatory &&
      (Array.isArray(p?.divisions) ? (p.divisions as string[]).includes(division) : false)
  );
}

function daysUntilShow(showDate: string | undefined, now: Date): number | null {
  if (!showDate) return null;
  const show = new Date(showDate);
  show.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return Math.ceil((show.getTime() - n.getTime()) / (1000 * 60 * 60 * 24));
}

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const SECONDARY_ACTIONS = [
  { id: 'snooze_2h', label: 'Snooze 2h' },
  { id: 'snooze_tomorrow', label: 'Tomorrow' },
  { id: 'mark_done', label: 'Mark Done' },
  { id: 'pin', label: 'Pin' },
];

/** A) POSING_SUBMISSION_REVIEW: one consolidated item per client with unreviewed posing media (max 1 card per client). */
function buildPosingReviewItems(
  input: BuildCompPrepInboxInput
): CompPrepInboxItem[] {
  const { clients = [], mediaLogs = [], poses = [], now } = input;
  const clientMap = new Map((clients || []).filter((c) => c?.id != null).map((c) => [c.id!, c]));
  const poseMap = new Map((poses || []).filter((p) => p?.id != null).map((p) => [p.id!, p]));
  const items: CompPrepInboxItem[] = [];

  const unreviewed = (mediaLogs || []).filter(
    (m) => m.category === 'posing' && m.reviewedAt == null
  );
  const byClient = new Map<string, typeof unreviewed>();
  for (const m of unreviewed) {
    if (m?.clientId == null) continue;
    if (!byClient.has(m.clientId)) byClient.set(m.clientId, []);
    byClient.get(m.clientId)!.push(m);
  }

  for (const [clientId, list] of byClient) {
    const client = clientMap.get(clientId);
    const oldest = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const count = list.length;
    const poseName = oldest.poseId ? poseMap.get(oldest.poseId)?.name ?? 'untagged' : 'untagged';
    const hours = hoursSince(oldest.createdAt);
    const ageBoost = Math.min(25, Math.floor(hours * 0.5));
    const score = 78 + ageBoost;

    items.push({
      id: `posing_review:${clientId}`,
      type: 'POSING_SUBMISSION_REVIEW',
      clientId,
      leadId: null,
      title: client?.full_name ?? 'Client',
      subtitle: count === 1 ? 'Posing submission awaiting review' : `${count} posing submissions awaiting review`,
      why: count === 1 ? `Unreviewed posing upload (${poseName})` : `${count} posing submissions awaiting review`,
      badge: { label: 'Comp Prep', tone: 'warning' },
      badgeLabel: 'Comp Prep',
      badgeTone: 'warning',
      priorityBadge: score >= 80 ? 'High' : score >= 60 ? 'Med' : 'Low',
      ageLabel: formatAgeLabel(oldest.createdAt),
      priorityScore: score,
      primaryAction: {
        label: 'Review',
        type: 'open_comp_prep_media',
        clientId,
        mediaId: oldest.id,
      },
      primaryCtaLabel: 'Review',
      actionRoute: `/comp-prep/review/${encodeURIComponent(oldest.id)}?clientId=${encodeURIComponent(clientId)}&focus=${encodeURIComponent(oldest.id)}`,
      secondaryActions: SECONDARY_ACTIONS,
      createdAt: oldest.createdAt,
      raw: { count, media: list },
    });
  }
  return items;
}

/** B) MISSING_MANDATORY_POSES: one consolidated item per client with missing required poses. */
function buildMissingMandatoryPosesItems(
  input: BuildCompPrepInboxInput
): CompPrepInboxItem[] {
  const { clients = [], compProfiles = [], poses = [], mediaLogs = [], now } = input;
  const clientMap = new Map((clients || []).filter((c) => c?.id != null).map((c) => [c.id!, c]));
  const items: CompPrepInboxItem[] = [];

  for (const profile of compProfiles) {
    if (!profile?.clientId) continue;
    const mandatory = getMandatoryPosesForDivision(
      poses ?? [],
      profile?.sex ?? 'FEMALE',
      profile?.division ?? ''
    );
    if (mandatory.length === 0) continue;

    const windowDays = missingPoseWindowByPhase[profile.prepPhase];
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - windowDays);
    const cutoffIso = cutoff.toISOString();

    const clientPosingLogs = (mediaLogs || []).filter(
      (m) => m.clientId === profile.clientId && m.category === 'posing'
    );
    const poseIdsWithRecentSubmission = new Set<string>();
    for (const log of clientPosingLogs) {
      if (log.createdAt >= cutoffIso && log.poseId) {
        poseIdsWithRecentSubmission.add(log.poseId);
      }
    }

    const missingPoses = mandatory.filter(
      (p) => !poseIdsWithRecentSubmission.has(p.id)
    );
    if (missingPoses.length === 0) continue;

    const client = clientMap.get(profile.clientId);
    const names = missingPoses.map((p) => p.name);
    const displayNames = names.slice(0, 3);
    const rest = names.length - 3;
    let why =
      rest > 0
        ? `Missing: ${displayNames.join(', ')} (+${rest} more)`
        : `Missing: ${displayNames.join(', ')}`;
    const daysToShow = daysUntilShow(profile.showDate, now);
    const daysOutLabel = daysToShow != null && daysToShow >= 0 ? `Show in ${daysToShow} day${daysToShow === 1 ? '' : 's'}` : '';
    if (daysOutLabel) why = `${daysOutLabel}. ${why}`;
    const subtitle = daysOutLabel ? `Mandatory poses missing · ${daysOutLabel}` : 'Mandatory poses missing';

    let score = 65;
    if (profile.prepPhase === 'PEAK_WEEK') score += 20;
    else if (profile.prepPhase === 'PREP') score += 10;
    if (daysToShow != null) {
      if (daysToShow <= showProximityThresholdDays.within7) score += 25;
      else if (daysToShow <= showProximityThresholdDays.within14) score += 15;
    }

    items.push({
      id: `missing_poses:${profile.clientId}`,
      type: 'MISSING_MANDATORY_POSES',
      clientId: profile.clientId,
      leadId: null,
      title: client?.full_name ?? 'Client',
      subtitle,
      why,
      badge: { label: 'Comp Prep', tone: 'warning' },
      badgeLabel: 'Comp Prep',
      badgeTone: 'warning',
      priorityBadge: score >= 80 ? 'High' : score >= 60 ? 'Med' : 'Low',
      ageLabel: '',
      priorityScore: score,
      primaryAction: {
        label: 'Poses',
        type: 'open_comp_prep_client',
        clientId: profile.clientId,
      },
      primaryCtaLabel: 'Poses',
      actionRoute: `/comp-prep/client/${profile.clientId}`,
      secondaryActions: SECONDARY_ACTIONS,
      createdAt: profile.updatedAt,
      raw: { profile, missingPoses: names },
      showDate: profile.showDate,
    });
  }
  return items;
}

/** C) PEAK_WEEK_DUE: client in PEAK_WEEK or show within 7 days; daily update not logged today. */
function buildPeakWeekDueItems(input: BuildCompPrepInboxInput): CompPrepInboxItem[] {
  const { clients = [], compProfiles = [], mediaLogs = [], now, hasCheckinToday } = input;
  const clientMap = new Map((clients || []).filter((c) => c?.id != null).map((c) => [c.id!, c]));
  const today = toYYYYMMDD(now);
  const items: CompPrepInboxItem[] = [];

  for (const profile of compProfiles) {
    if (!profile?.clientId) continue;
    const inPeakWeek =
      profile.prepPhase === 'PEAK_WEEK' || profile.prepPhase === 'SHOW_DAY';
    const daysToShow = daysUntilShow(profile.showDate, now);
    const showWithin7 = daysToShow != null && daysToShow <= 7;
    if (!inPeakWeek && !showWithin7) continue;

    const hasCheckinTodayForClient = hasCheckinToday(profile.clientId);
    const hasCompMediaCheckinToday = (mediaLogs ?? []).some(
      (m) =>
        m?.clientId === profile.clientId &&
        m?.category === 'checkin' &&
        (m?.createdAt ?? '').slice(0, 10) === today
    );
    const hasDailyRecordToday = hasCheckinTodayForClient || hasCompMediaCheckinToday;

    if (hasDailyRecordToday) continue;

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const hoursSinceDayStart =
      (now.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
    const ageBoost = Math.min(15, Math.floor(hoursSinceDayStart * 0.5));
    const within3 =
      daysToShow != null && daysToShow <= showProximityThresholdDays.within3;
    const baseScore = within3 ? 90 : 82;
    const score = baseScore + ageBoost;

    const client = clientMap.get(profile.clientId);
    const daysOutLabel = daysToShow != null && daysToShow >= 0 ? `Show in ${daysToShow} day${daysToShow === 1 ? '' : 's'}` : '';
    const subtitle = daysOutLabel ? `Peak week update due · ${daysOutLabel}` : 'Peak week update due';
    const whyText = daysOutLabel ? `${daysOutLabel}. Daily update not logged today` : 'Daily update not logged today';
    items.push({
      id: `peak_week_due:${profile.clientId}:${today}`,
      type: 'PEAK_WEEK_DUE',
      clientId: profile.clientId,
      leadId: null,
      title: client?.full_name ?? 'Client',
      subtitle,
      why: whyText,
      badge: { label: 'Comp Prep', tone: 'warning' },
      badgeLabel: 'Comp Prep',
      badgeTone: 'warning',
      priorityBadge: score >= 90 ? 'High' : 'Med',
      ageLabel: '',
      priorityScore: score,
      primaryAction: {
        label: 'Open',
        type: 'open_comp_prep_client',
        clientId: profile.clientId,
      },
      primaryCtaLabel: 'Open',
      actionRoute: `/comp-prep/client/${profile.clientId}`,
      secondaryActions: SECONDARY_ACTIONS,
      createdAt: now.toISOString(),
      raw: { profile },
      showDate: profile.showDate,
    });
  }
  return items;
}

/**
 * Build all Comp Prep–driven inbox items. Keys are stable for overrides.
 * POSING_SUBMISSION_REVIEW items disappear from Active when reviewedAt is set (we only include unreviewed).
 */
export function buildCompPrepInboxItems(
  input: BuildCompPrepInboxInput
): CompPrepInboxItem[] {
  const posing = buildPosingReviewItems(input);
  const missing = buildMissingMandatoryPosesItems(input);
  const peak = buildPeakWeekDueItems(input);
  return [...posing, ...missing, ...peak];
}

/** Overview counts for Home Comp Prep card. Same input as buildCompPrepInboxItems. */
export function getCompPrepOverviewCounts(input: BuildCompPrepInboxInput): {
  posingReviewsPending: number;
  missingMandatoryPosesClients: number;
  peakWeekDueToday: number;
} {
  const posing = buildPosingReviewItems(input);
  const missing = buildMissingMandatoryPosesItems(input);
  const peak = buildPeakWeekDueItems(input);
  return {
    posingReviewsPending: posing.length,
    missingMandatoryPosesClients: missing.length,
    peakWeekDueToday: peak.length,
  };
}
