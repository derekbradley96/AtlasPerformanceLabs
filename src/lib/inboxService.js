/**
 * Trainer Inbox: aggregate check-ins needing review, overdue payments, unread messages, new leads/consults
 * into a unified priority-sorted list.
 */
import {
  getSubmittedCheckInsNeedingReview,
  getTrainerClientsList,
  getInboxThreadsForTrainer,
  getInboxMessagesByClientId,
  listClientCheckInsForInbox,
  getInboxThreadByClientId,
} from '@/lib/inboxLocalSources';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';
import { getPendingConsultations } from '@/lib/consultationStore';
import { getLeadsForTrainer, getAllLeads } from '@/lib/leadsStore';
import { getClientHealthScore } from '@/lib/healthScoreService';
import { getRetentionRiskForClient } from '@/lib/intelligence/retentionRiskBridge';
import { getAchievementsList } from '@/lib/milestonesStore';
import {
  getOverride,
  getItemKey,
  getEffectiveStatus,
  isSnoozed,
} from '@/lib/inboxOverridesStore';
import { buildCompPrepInboxItems } from '@/lib/inbox/compPrepInbox';
import { listCompClientsForTrainer, getMediaLogsForClients } from '@/lib/repos/compPrepRepo';
import { getAllPoses } from '@/lib/repos/poseLibraryRepo';
import { safeDate } from '@/lib/format';
import { formatWeightForViewer, normalizeWeightUnit } from '@/lib/bodyMeasurementUnits';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const BASE_SCORE = {
  payment_failed: 100,
  payment_overdue: 85,
  checkin_review: 75,
  at_risk: 72,
  lead: 60,
  unread_message: 40,
};

const AGE_CAP = 40;
const AGE_FACTOR = 0.5;
const WAITING_ON_TRAINER_BOOST = 20;
const SUPABASE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealSupabaseThread(thread) {
  return !!(thread?.id && SUPABASE_UUID_RE.test(String(thread.id)));
}

function hoursSince(iso) {
  const t = safeDate(iso)?.getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function ageBoost(hours) {
  return Math.min(AGE_CAP, Math.floor(hours * AGE_FACTOR));
}

function formatAgeLabel(iso) {
  if (!iso) return '';
  const h = hoursSince(iso);
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/** Last message in thread from client? (thread has client_id; messages sorted by created_date) */
function isLastMessageFromClient(clientId) {
  const msgs = getInboxMessagesByClientId(clientId);
  if (!msgs.length) return false;
  const last = msgs[msgs.length - 1];
  return last?.sender === 'client';
}

/**
 * Get counts per category for Daily Closeout. Same sources as inbox.
 */
export function getCloseoutCounts(trainerId) {
  const clients = getTrainerClientsList(trainerId) ?? [];
  const needsReviewRaw = getSubmittedCheckInsNeedingReview() ?? [];
  const needsReview = Array.isArray(needsReviewRaw) ? needsReviewRaw : [];
  const checkinReview = needsReview.filter((c) => clients.some((cl) => cl?.id === c?.client_id)).length;
  const overduePayments = clients.filter((c) => c?.payment_overdue && !getClientMarkedPaid(c?.id)).length;
  const trainerThreadsRaw = getInboxThreadsForTrainer(trainerId) ?? [];
  const trainerThreads = Array.isArray(trainerThreadsRaw) ? trainerThreadsRaw : [];
  const unreadMessages = trainerThreads.filter((t) => (t?.unread_count ?? 0) > 0).length;
  const pendingConsultsRaw = typeof getPendingConsultations === 'function' ? getPendingConsultations() : [];
  const pendingConsults = Array.isArray(pendingConsultsRaw) ? pendingConsultsRaw : [];
  const joinLeadsRaw = getLeadsForTrainer(trainerId) ?? [];
  const joinLeads = Array.isArray(joinLeadsRaw) ? joinLeadsRaw : [];
  const newLeads = pendingConsults.length + joinLeads.filter((l) => l?.status === 'new' || !l?.status).length;

  return {
    checkinReview,
    unreadMessages,
    overduePayments,
    newLeads,
    total: checkinReview + unreadMessages + overduePayments + newLeads,
    completed: [checkinReview, unreadMessages, overduePayments, newLeads].filter((n) => n === 0).length,
  };
}

export async function getCloseoutCountsFromSupabase(coachId) {
  const defaultCounts = {
    checkinReview: 0,
    unreadMessages: 0,
    overduePayments: 0,
    newLeads: 0,
    total: 0,
    completed: 4,
  };
  if (!coachId || !hasSupabase) return defaultCounts;
  const supabase = getSupabase();
  if (!supabase) return defaultCounts;

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id')
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`)
    .limit(200);

  if (clientsError || !Array.isArray(clients)) return defaultCounts;
  const clientIds = clients.map((row) => row?.id).filter(Boolean);
  if (clientIds.length === 0) return defaultCounts;

  const checkinsPromise = supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .in('client_id', clientIds)
    .eq('status', 'submitted')
    .is('reviewed_at', null);

  const overduePaymentsPromise = supabase
    .from('client_billing')
    .select('id', { count: 'exact', head: true })
    .in('client_id', clientIds)
    .eq('billing_status', 'overdue');

  const unreadThreadsPromise = supabase
    .from('message_threads')
    .select('id, coach_last_read_at, updated_at')
    .in('client_id', clientIds)
    .is('deleted_at', null);

  const [checkinsResult, overdueResult, unreadResult, leadsResult] = await Promise.allSettled([
    checkinsPromise,
    overduePaymentsPromise,
    unreadThreadsPromise,
    Promise.resolve({ count: 0, error: null }),
  ]);

  const countFromSettled = (result) => {
    if (!result || result.status !== 'fulfilled') return 0;
    const value = result.value;
    if (!value || value.error) return 0;
    return typeof value.count === 'number' ? value.count : 0;
  };

  const checkinReview = countFromSettled(checkinsResult);
  const overduePayments = countFromSettled(overdueResult);
  const newLeads = countFromSettled(leadsResult);

  let unreadMessages = 0;
  if (unreadResult?.status === 'fulfilled' && !unreadResult.value?.error) {
    const rows = Array.isArray(unreadResult.value?.data) ? unreadResult.value.data : [];
    unreadMessages = rows.filter((thread) => {
      if (!thread?.updated_at) return false;
      const updated = new Date(thread.updated_at).getTime();
      if (!Number.isFinite(updated) || updated <= 0) return false;
      const lastRead = thread.coach_last_read_at ? new Date(thread.coach_last_read_at).getTime() : 0;
      return updated > lastRead;
    }).length;
  }

  const total = checkinReview + unreadMessages + overduePayments + newLeads;
  return {
    checkinReview,
    unreadMessages,
    overduePayments,
    newLeads,
    total,
    completed: [checkinReview, unreadMessages, overduePayments, newLeads].filter((n) => n === 0).length,
  };
}

/** Build raw inbox items from all sources (no overrides applied). */
export function buildRawInboxItems(trainerId, weightUnit = 'kg') {
  const wu = normalizeWeightUnit(weightUnit);
  const items = [];
  const clients = getTrainerClientsList(trainerId) ?? [];
  const needsReviewRaw = getSubmittedCheckInsNeedingReview() ?? [];
  const needsReview = Array.isArray(needsReviewRaw) ? needsReviewRaw : [];
  const filteredNeedsReview = needsReview.filter((c) => clients.some((cl) => cl?.id === c?.client_id));
  filteredNeedsReview.forEach((checkin) => {
    const client = (clients ?? []).find((cl) => cl?.id === checkin?.client_id);
    const submittedAt = checkin.submitted_at || checkin.created_date;
    const base = BASE_SCORE.checkin_review;
    const score = base + ageBoost(hoursSince(submittedAt));
    items.push({
      id: checkin.id,
      type: 'CHECKIN_REVIEW',
      clientId: checkin.client_id,
      leadId: null,
      title: client?.full_name ?? 'Check-in',
      subtitle: `${checkin.weight_kg != null ? `${checkin.weight_kg} kg · ` : ''}Needs review`,
      badge: { label: 'Review', tone: 'warning' },
      badgeLabel: 'Review',
      badgeTone: 'warning',
      priorityBadge: score >= 80 ? 'High' : score >= 60 ? 'Med' : 'Low',
      ageLabel: formatAgeLabel(submittedAt),
      priorityScore: score,
      primaryAction: { label: 'Review', type: 'review_checkin', checkinId: checkin.id },
      secondaryActions: [
        { id: 'snooze_2h', label: 'Snooze 2h' },
        { id: 'snooze_tomorrow', label: 'Tomorrow' },
        { id: 'mark_done', label: 'Mark Done' },
        { id: 'pin', label: 'Pin' },
      ],
      primaryCtaLabel: 'Review',
      createdAt: submittedAt,
      raw: checkin,
    });
  });

  (clients ?? []).forEach((client) => {
    if (!client?.id) return;
    if (client.payment_overdue && !getClientMarkedPaid(client.id)) {
      const base = BASE_SCORE.payment_overdue;
      const score = base + ageBoost(hoursSince(client.last_check_in_at || client.created_date));
    items.push({
      id: `payment-${client.id}`,
      type: 'PAYMENT_OVERDUE',
      clientId: client.id,
      leadId: null,
      title: client.full_name,
      subtitle: 'Payment overdue',
      badge: { label: 'Payment', tone: 'danger' },
      badgeLabel: 'Payment',
      badgeTone: 'danger',
      priorityBadge: 'High',
      ageLabel: formatAgeLabel(client.last_check_in_at || client.created_date),
      priorityScore: score,
      primaryAction: { label: 'Send reminder', type: 'open_messages', clientId: client.id },
      secondaryActions: [
        { id: 'snooze_2h', label: 'Snooze 2h' },
        { id: 'snooze_tomorrow', label: 'Tomorrow' },
        { id: 'mark_done', label: 'Mark Done' },
        { id: 'pin', label: 'Pin' },
      ],
      primaryCtaLabel: 'Send reminder',
      createdAt: client.last_check_in_at || client.created_date,
      raw: client,
    });
    }
  });

  (clients ?? []).forEach((client) => {
    if (!client?.id) return;
    const retention = getRetentionRiskForClient(client.id, {
      getClientById: (id) => (clients ?? []).find((x) => x?.id === id),
      getClientCheckIns: listClientCheckInsForInbox,
      getThreadByClientId: getInboxThreadByClientId,
      getMessagesByClientId: getInboxMessagesByClientId,
      getClientMarkedPaid,
      getAchievementsList: (id, opts) => getAchievementsList(id, opts),
    });
    if (retention.risk === 'high' && retention.score0to100 >= 50) {
      items.push({
        id: `retention-${client.id}`,
        type: 'RETENTION_RISK',
        clientId: client.id,
        leadId: null,
        title: client.full_name,
        subtitle: retention.reasons?.slice(0, 2).join(' · ') || 'Retention risk',
        badge: { label: 'Retention', tone: 'warning' },
        badgeLabel: 'Retention risk',
        badgeTone: 'warning',
        priorityBadge: 'High',
        ageLabel: '',
        priorityScore: BASE_SCORE.at_risk + 5,
        primaryAction: { label: 'Open client', type: 'open_client', clientId: client.id },
        secondaryActions: [
          { id: 'snooze_2h', label: 'Snooze 2h' },
          { id: 'snooze_tomorrow', label: 'Tomorrow' },
          { id: 'mark_done', label: 'Mark Done' },
          { id: 'pin', label: 'Pin' },
        ],
        primaryCtaLabel: 'Open client',
        createdAt: client.last_check_in_at || client.created_date,
        raw: { ...client, retentionReasons: retention.reasons },
      });
    }
  });

  const atRiskClients = (clients ?? []).filter((c) => {
    if (!c?.id) return false;
    const health = getClientHealthScore(c.id, { client: c });
    return health?.status === 'at_risk';
  });
  (atRiskClients ?? []).forEach((client) => {
    if (!client?.id) return;
    const health = getClientHealthScore(client.id, { client });
    const why = (health?.reasons ?? []).slice(0, 2).join(' · ') || 'Health score low';
    const score = BASE_SCORE.at_risk + ageBoost(hoursSince(client?.last_check_in_at || client?.created_date));
    items.push({
      id: `at-risk-${client.id}`,
      type: 'AT_RISK',
      clientId: client.id,
      leadId: null,
      title: client?.full_name ?? 'Client',
      subtitle: why,
      badge: { label: 'At risk', tone: 'danger' },
      badgeLabel: 'At risk',
      badgeTone: 'danger',
      priorityBadge: 'High',
      ageLabel: formatAgeLabel(client.last_check_in_at || client.created_date),
      priorityScore: score,
      primaryAction: { label: 'Open client', type: 'open_client', clientId: client.id },
      secondaryActions: [
        { id: 'snooze_2h', label: 'Snooze 2h' },
        { id: 'snooze_tomorrow', label: 'Tomorrow' },
        { id: 'mark_done', label: 'Mark Done' },
        { id: 'pin', label: 'Pin' },
      ],
      primaryCtaLabel: 'Open client',
      createdAt: client?.last_check_in_at || client?.created_date,
      raw: { ...client, healthReasons: health?.reasons },
    });
  });

  const trainerThreadsRaw = getInboxThreadsForTrainer(trainerId) ?? [];
  const trainerThreads = Array.isArray(trainerThreadsRaw) ? trainerThreadsRaw : [];
  trainerThreads.forEach((thread) => {
    // Only add real Supabase threads to inbox.
    // Sandbox/mock threads have non-UUID ids and no real messages.
    if (!isRealSupabaseThread(thread)) return;
    if ((thread?.unread_count ?? 0) <= 0) return;
    const client = (clients ?? []).find((c) => c?.id === thread?.client_id);
    if (!client) return;
    const lastAt = thread.last_message_at || thread.last_message_preview;
    const base = BASE_SCORE.unread_message;
    let score = base + ageBoost(hoursSince(lastAt));
    if (isLastMessageFromClient(thread.client_id)) score += WAITING_ON_TRAINER_BOOST; // uses getInboxMessagesByClientId
    items.push({
      id: thread.id || thread.client_id,
      type: 'UNREAD_MESSAGE',
      clientId: thread.client_id,
      leadId: null,
      title: client?.full_name ?? 'Message',
      subtitle: (thread.last_message_preview || '').slice(0, 50),
      ...(thread.unread_count > 0 ? {
        badge: { label: `${thread.unread_count} unread`, tone: 'info' },
        badgeLabel: `${thread.unread_count} unread`,
        badgeTone: 'info',
      } : {}),
      priorityBadge: score >= 60 ? 'Med' : 'Low',
      ageLabel: formatAgeLabel(lastAt),
      priorityScore: score,
      primaryAction: { label: 'Open', type: 'open_messages', clientId: thread.client_id },
      secondaryActions: [
        { id: 'snooze_2h', label: 'Snooze 2h' },
        { id: 'snooze_tomorrow', label: 'Tomorrow' },
        { id: 'mark_done', label: 'Mark Done' },
        { id: 'pin', label: 'Pin' },
      ],
      primaryCtaLabel: 'Open',
      createdAt: lastAt,
      raw: thread,
    });
  });

  const pendingConsultsRaw = typeof getPendingConsultations === 'function' ? getPendingConsultations() : null;
  const pendingConsults = Array.isArray(pendingConsultsRaw) ? pendingConsultsRaw : [];
  pendingConsults.forEach((req) => {
    const base = BASE_SCORE.lead;
    const score = base + ageBoost(hoursSince(req.created_date));
    items.push({
      id: req.id,
      type: 'NEW_LEAD',
      clientId: null,
      leadId: req.id,
      title: req.userName || 'Consult request',
      subtitle: req.goal ? `Goal: ${req.goal}` : 'Pending consultation',
      badge: { label: 'Consult', tone: 'accent' },
      badgeLabel: 'Consult',
      badgeTone: 'accent',
      priorityBadge: score >= 60 ? 'Med' : 'Low',
      ageLabel: formatAgeLabel(req.created_date),
      priorityScore: score,
      primaryAction: { label: 'View', type: 'view_lead', leadId: req.id },
      secondaryActions: [
        { id: 'snooze_2h', label: 'Snooze 2h' },
        { id: 'snooze_tomorrow', label: 'Tomorrow' },
        { id: 'mark_done', label: 'Mark Done' },
        { id: 'pin', label: 'Pin' },
      ],
      primaryCtaLabel: 'View',
      createdAt: req.created_date,
      raw: req,
      subtype: 'consultation',
    });
  });

  const leadsRaw = getLeadsForTrainer(trainerId) ?? [];
  const leads = (Array.isArray(leadsRaw) ? leadsRaw : []).filter((l) => l?.status === 'new' || l?.status === 'pending');
  const allLeadsRaw = getAllLeads() ?? [];
  const allLeads = (Array.isArray(allLeadsRaw) ? allLeadsRaw : []).filter((l) => (l?.trainerId === trainerId || l?.trainerSlug) && (l?.status === 'new' || !l?.status));
  const leadIds = new Set(leads.filter((l) => l?.id).map((l) => l.id));
  allLeads.forEach((l) => {
    if (leadIds.has(l.id)) return;
    leadIds.add(l.id);
    const base = BASE_SCORE.lead;
    const score = base + ageBoost(hoursSince(l.created_date));
    items.push({
      id: l.id,
      type: 'NEW_LEAD',
      clientId: null,
      leadId: l.id,
      title: l.name || 'New lead',
      subtitle: l.goal ? `Goal: ${l.goal}` : l.email || 'From join link',
      badge: { label: 'Lead', tone: 'accent' },
      badgeLabel: 'Lead',
      badgeTone: 'accent',
      ageLabel: formatAgeLabel(l.created_date),
      priorityScore: score,
      primaryAction: { label: 'View', type: 'view_lead', leadId: l.id },
      secondaryActions: [
        { id: 'snooze_2h', label: 'Snooze 2h' },
        { id: 'snooze_tomorrow', label: 'Tomorrow' },
        { id: 'mark_done', label: 'Mark Done' },
        { id: 'pin', label: 'Pin' },
      ],
      primaryCtaLabel: 'View',
      priorityBadge: 'Low',
      createdAt: l.created_date,
      raw: l,
      subtype: 'lead',
    });
  });

  // Comp Prep: posing review, missing mandatory poses, peak week due
  const compProfilesRaw = listCompClientsForTrainer(trainerId);
  const compProfiles = Array.isArray(compProfilesRaw) ? compProfilesRaw : [];
  const compClientIds = compProfiles.map((p) => p?.clientId).filter(Boolean);
  const compMediaLogs = getMediaLogsForClients(compClientIds);
  const compClients = clients.filter((c) => c?.id && compClientIds.includes(c.id)).map((c) => ({ id: c.id, full_name: c.full_name }));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hasCheckinToday = (clientId) =>
    listClientCheckInsForInbox(clientId).some((c) => ((c.submitted_at || c.created_date) || '').toString().slice(0, 10) === today);
  const compPrepItems = buildCompPrepInboxItems({
    trainerId,
    clients: compClients,
    compProfiles,
    poses: getAllPoses(),
    mediaLogs: compMediaLogs,
    now,
    hasCheckinToday,
  });
  compPrepItems.forEach((it) => items.push(it));

  return items;
}

/** Priority (1 highest): payment, checkin, posing_review (workflow), peak_week, missing_poses, retention, at_risk, unread, lead. */
export const PRIORITY_MAP = {
  overduePayment: 1,
  missedCheckin: 2,
  posingReview: 3,
  peakWeekDue: 4,
  missingPoses: 5,
  retentionRisk: 6,
  highRisk: 7,
  unreadMessage: 8,
  newLead: 9,
};

function typeToPriorityKey(type) {
  if (type === 'PAYMENT_OVERDUE') return 'overduePayment';
  if (type === 'CHECKIN_REVIEW') return 'missedCheckin';
  if (type === 'PEAK_WEEK_DUE') return 'peakWeekDue';
  if (type === 'POSING_SUBMISSION_REVIEW') return 'posingReview';
  if (type === 'MISSING_MANDATORY_POSES') return 'missingPoses';
  if (type === 'RETENTION_RISK') return 'retentionRisk';
  if (type === 'AT_RISK') return 'highRisk';
  if (type === 'UNREAD_MESSAGE') return 'unreadMessage';
  if (type === 'NEW_LEAD') return 'newLead';
  return 'newLead';
}

function getShowDate(item) {
  return item.showDate || item.raw?.showDate || null;
}

/**
 * Sort inbox items: priority rank first, then severity score desc, age desc (older first), show proximity (closer showDate first).
 */
export function sortInboxItems(items) {
  const list = Array.isArray(items) ? items : [];
  return [...list].sort((a, b) => {
    const rankA = PRIORITY_MAP[typeToPriorityKey(a?.type)] ?? 99;
    const rankB = PRIORITY_MAP[typeToPriorityKey(b?.type)] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const scoreA = a?.priorityScore ?? 0;
    const scoreB = b?.priorityScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const dateA = safeDate(a?.createdAt)?.getTime();
    const dateB = safeDate(b?.createdAt)?.getTime();
    const tA = Number.isFinite(dateA) ? dateA : 0;
    const tB = Number.isFinite(dateB) ? dateB : 0;
    if (tA !== tB) return tA - tB; // older first
    const showA = getShowDate(a);
    const showB = getShowDate(b);
    if (!showA && !showB) return 0;
    if (!showA) return 1;
    if (!showB) return -1;
    const tShowA = safeDate(showA)?.getTime();
    const tShowB = safeDate(showB)?.getTime();
    if (!Number.isFinite(tShowA) || !Number.isFinite(tShowB)) return 0;
    return tShowA - tShowB; // closer show first
  });
}

/** Apply overrides and segment into Active / Waiting / Done. Pinned first in Active, then sortInboxItems. */
export function buildSegmentedInbox(trainerId, weightUnit = 'kg') {
  const raw = buildRawInboxItems(trainerId, weightUnit);
  const withStatus = raw.map((item) => {
    const key = getItemKey(item.type, item.id);
    const override = getOverride(key);
    const status = getEffectiveStatus(key);
    const pinned = !!override.pinned;
    const lastActionAt = override.lastActionAt || item.createdAt;
    return { ...item, itemKey: key, status, pinned, lastActionAt };
  });

  const activeFiltered = withStatus.filter((i) => i.status === 'active');
  const pinned = activeFiltered.filter((i) => i.pinned);
  const notPinned = activeFiltered.filter((i) => !i.pinned);
  const active = [...sortInboxItems(pinned), ...sortInboxItems(notPinned)];

  const waiting = sortInboxItems(withStatus.filter((i) => i.status === 'waiting'));
  const done = withStatus.filter((i) => i.status === 'done').sort((a, b) => {
    const tA = safeDate(b?.lastActionAt)?.getTime();
    const tB = safeDate(a?.lastActionAt)?.getTime();
    const va = Number.isFinite(tA) ? tA : 0;
    const vb = Number.isFinite(tB) ? tB : 0;
    return va - vb;
  });

  return { active, waiting, done, all: withStatus };
}
