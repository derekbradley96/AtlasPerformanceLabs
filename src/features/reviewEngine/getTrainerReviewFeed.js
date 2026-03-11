/**
 * Global trainer review feed: check-ins, posing, missing mandatory poses (one per client),
 * peak week daily (one per client per date, only if not completed today).
 * Same source for Home overview counts.
 */
import { getClients, getClientCheckIns, getNeedsReviewCheckIns, getThreadsForTrainer } from '@/data/selectors';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';
import { listMedia, getMediaLogsForClients, listCompClientsForTrainer } from '@/lib/repos/compPrepRepo';
import { getAllPoses, getPoseById } from '@/lib/repos/poseLibraryRepo';
import { buildCompPrepInboxItems } from '@/lib/inbox/compPrepInbox';
import { getClientRiskScore } from '@/lib/riskService';
import { getClientHealthScore } from '@/lib/healthScoreService';

/** @typedef {'active' | 'waiting' | 'done'} SegmentStatus */
/** @typedef {'checkin' | 'posing' | 'photo' | 'missing_poses' | 'peak_week_due'} FeedItemType */
/** @typedef {'priority' | 'due_soon' | 'risk' | 'newest'} SortOption */

/**
 * @typedef {Object} TrainerFeedItem
 * @property {string} id
 * @property {string} clientId
 * @property {string} type
 * @property {string} createdAt
 * @property {string} status
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string[]} summaryLines
 * @property {number} priorityScore
 * @property {string} [showDate]
 * @property {number} [riskScore]
 * @property {string[]} [poseNames]
 * @property {number} [missingPoseCount]
 */

function hoursSince(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}
function ageBoost(hours, cap = 40) {
  return Math.min(cap, Math.floor(hours * 0.5));
}

const BASE_SCORE = { checkin_review: 75, posing_review: 78 };

/**
 * Build raw trainer feed items (active only for reviewables; comp prep items from inbox builder).
 * Consolidation: missing_poses one per client; peak_week_due one per client per date.
 */
function buildRawTrainerFeedItems(trainerId) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const rawClients = getClients();
  const clients = Array.isArray(rawClients) ? rawClients.filter((c) => c?.trainer_id === trainerId) : [];
  const clientIds = new Set((clients || []).map((c) => c?.id).filter(Boolean));
  const healthByClient = new Map();
  (clients || []).forEach((c) => {
    if (!c?.id) return;
    const h = getClientHealthScore(c.id);
    healthByClient.set(c.id, typeof h?.score === 'number' ? h.score : 100);
  });

  const items = [];

  // Check-ins needing review
  const needsReview = (getNeedsReviewCheckIns() ?? []).filter((c) => clientIds.has(c?.client_id));
  for (const c of needsReview) {
    const client = clients?.find((cl) => cl?.id === c?.client_id);
    const submittedAt = c.submitted_at || c.created_date;
    const score = BASE_SCORE.checkin_review + ageBoost(hoursSince(submittedAt));
    const summaryLines = [];
    if (c.weight_kg != null) summaryLines.push(`${c.weight_kg} kg`);
    if (c.adherence_pct != null) summaryLines.push(`${c.adherence_pct}% adherence`);
    if (c.steps != null) summaryLines.push(`${c.steps.toLocaleString()} steps`);
    if (summaryLines.length === 0) summaryLines.push('Submitted');
    items.push({
      id: c.id,
      clientId: c.client_id,
      type: 'checkin',
      createdAt: submittedAt,
      status: 'needs_review',
      title: client?.full_name ?? 'Client',
      subtitle: submittedAt ? new Date(submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
      summaryLines,
      priorityScore: score,
      riskScore: getClientRiskScore(c.client_id)?.score ?? 0,
      healthScore: healthByClient.get(c.client_id) ?? 100,
    });
  }

  // Posing unreviewed (from comp prep)
  const compProfiles = listCompClientsForTrainer(trainerId) ?? [];
  const compClientIds = (compProfiles || []).map((p) => p?.clientId).filter(Boolean);
  const compMediaLogs = getMediaLogsForClients(compClientIds) ?? [];
  const compClients = (clients || []).filter((c) => c?.id && compClientIds.includes(c.id)).map((c) => ({ id: c.id, full_name: c?.full_name ?? 'Client' }));
  const hasCheckinToday = (clientId) =>
    (getClientCheckIns(clientId) ?? []).some((c) => ((c?.submitted_at || c?.created_date) || '').toString().slice(0, 10) === today);
  const compPrepItems = buildCompPrepInboxItems({
    trainerId,
    clients: compClients,
    compProfiles,
    poses: getAllPoses() ?? [],
    mediaLogs: compMediaLogs,
    now,
    hasCheckinToday,
  });

  for (const it of compPrepItems) {
    if (it.type === 'POSING_SUBMISSION_REVIEW') {
      const mediaId = it.id.replace(/^posing_review:/, '');
      const media = compMediaLogs.find((m) => m.id === mediaId);
      const poseName = media?.poseId ? (getPoseById(media.poseId)?.name ?? media.poseId) : 'Posing';
      items.push({
        id: mediaId,
        clientId: it.clientId,
        type: 'posing',
        createdAt: it.createdAt,
        status: 'needs_review',
        title: it.title,
        subtitle: poseName,
        summaryLines: ['Media submitted'],
        priorityScore: it.priorityScore ?? 78,
        riskScore: getClientRiskScore(it.clientId)?.score ?? 0,
        healthScore: healthByClient.get(it.clientId) ?? 100,
      });
    } else if (it.type === 'MISSING_MANDATORY_POSES') {
      const poseNames = it.raw?.missingPoses ?? [];
      items.push({
        id: it.id,
        clientId: it.clientId,
        type: 'missing_poses',
        createdAt: it.createdAt,
        status: 'needs_review',
        title: it.title,
        subtitle: 'Mandatory poses missing',
        summaryLines: poseNames.length ? [`${poseNames.length} pose(s): ${poseNames.slice(0, 3).join(', ')}${poseNames.length > 3 ? '…' : ''}`] : ['Poses missing'],
        priorityScore: it.priorityScore ?? 65,
        showDate: it.showDate,
        riskScore: getClientRiskScore(it.clientId)?.score ?? 0,
        healthScore: healthByClient.get(it.clientId) ?? 100,
        poseNames,
        missingPoseCount: poseNames.length,
      });
    } else if (it.type === 'PEAK_WEEK_DUE') {
      items.push({
        id: it.id,
        clientId: it.clientId,
        type: 'peak_week_due',
        createdAt: it.createdAt,
        status: 'needs_review',
        title: it.title,
        subtitle: 'Peak week update due',
        summaryLines: ['Daily update not logged today'],
        priorityScore: it.priorityScore ?? 82,
        showDate: it.showDate,
        riskScore: getClientRiskScore(it.clientId)?.score ?? 0,
        healthScore: healthByClient.get(it.clientId) ?? 100,
      });
    }
  }

  return items;
}

/** Recently reviewed items (last 14 days) for Done segment. */
function buildDoneTrainerFeedItems(trainerId) {
  const clients = getClients().filter((c) => c.trainer_id === trainerId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffIso = cutoff.toISOString();
  const items = [];
  for (const client of clients) {
    const checkIns = getClientCheckIns(client.id).filter((c) => c.status === 'submitted' && getCheckinReviewed(c.id));
    for (const c of checkIns) {
      const createdAt = c.submitted_at || c.created_date;
      if (createdAt && createdAt < cutoffIso) continue;
      items.push({
        id: c.id,
        clientId: client.id,
        type: 'checkin',
        createdAt,
        status: 'reviewed',
        title: client.full_name || 'Client',
        subtitle: createdAt ? new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
        summaryLines: [c.weight_kg != null ? `${c.weight_kg} kg` : '', c.adherence_pct != null ? `${c.adherence_pct}%` : ''].filter(Boolean),
        priorityScore: 0,
      });
    }
    const mediaList = listMedia(client.id, { category: 'posing' }).filter((m) => m.reviewedAt && m.reviewedAt >= cutoffIso);
    for (const m of mediaList) {
      const pose = m.poseId ? getPoseById(m.poseId) : null;
      items.push({
        id: m.id,
        clientId: m.clientId,
        type: 'posing',
        createdAt: m.reviewedAt || m.createdAt,
        status: 'reviewed',
        title: client.full_name || 'Client',
        subtitle: pose?.name ?? m.poseId ?? 'Posing',
        summaryLines: ['Reviewed'],
        priorityScore: 0,
      });
    }
  }
  return items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/**
 * getTrainerReviewFeed(trainerId, { status, filterType, sort, query }) → TrainerFeedItem[]
 * Consolidation: missing_poses one per client; peak_week_due one per client per date (not completed today).
 */
export function getTrainerReviewFeed(trainerId, options = {}) {
  const { status = 'active', filterType = null, sort = 'priority', query = '' } = options;
  let list =
    status === 'done'
      ? buildDoneTrainerFeedItems(trainerId)
      : buildRawTrainerFeedItems(trainerId).filter((item) => {
          if (status === 'active' && item.status !== 'needs_review') return false;
          if (status === 'waiting') return false; // MVP: no waiting segment items
          return true;
        });

  if (filterType) {
    if (filterType === 'checkin') list = list.filter((i) => i.type === 'checkin');
    else if (filterType === 'posing') list = list.filter((i) => i.type === 'posing' || i.type === 'missing_poses' || i.type === 'peak_week_due');
    else if (filterType === 'photo') list = list.filter((i) => i.type === 'photo');
  }

  const q = (query || '').trim().toLowerCase();
  if (q) {
    list = list.filter((i) => {
      if ((i.title || '').toLowerCase().includes(q)) return true;
      if ((i.subtitle || '').toLowerCase().includes(q)) return true;
      if ((i.summaryLines || []).some((s) => (s || '').toLowerCase().includes(q))) return true;
      return false;
    });
  }

  // Sort
  if (sort === 'priority') {
    list.sort((a, b) => {
      const scoreA = a.priorityScore ?? 0;
      const scoreB = b.priorityScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const healthA = a.healthScore ?? 100;
      const healthB = b.healthScore ?? 100;
      if (healthA !== healthB) return healthA - healthB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  } else if (sort === 'due_soon') {
    list.sort((a, b) => {
      const showA = a.showDate ? new Date(a.showDate).getTime() : Infinity;
      const showB = b.showDate ? new Date(b.showDate).getTime() : Infinity;
      if (showA !== showB) return showA - showB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  } else if (sort === 'risk') {
    list.sort((a, b) => {
      const riskA = a.riskScore ?? 0;
      const riskB = b.riskScore ?? 0;
      if (riskB !== riskA) return riskB - riskA;
      return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
    });
  } else {
    // newest
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  return list;
}

/**
 * Home overview counts from same global feed (Active items).
 * checkinsDue, unreadMessages, paymentsOverdue, compPrepPending + breakdown.
 */
export function getTrainerReviewCounts(trainerId) {
  const clients = getClients().filter((c) => c.trainer_id === trainerId);
  const activeFeed = getTrainerReviewFeed(trainerId, { status: 'active', filterType: null });
  const checkinsDue = activeFeed.filter((i) => i.type === 'checkin').length;
  const posingReviewsPending = activeFeed.filter((i) => i.type === 'posing').length;
  const missingMandatoryPosesClients = activeFeed.filter((i) => i.type === 'missing_poses').length;
  const peakWeekDueToday = activeFeed.filter((i) => i.type === 'peak_week_due').length;
  const compPrepPending = posingReviewsPending + missingMandatoryPosesClients + peakWeekDueToday;

  const unreadMessages = getThreadsForTrainer(trainerId).filter((t) => t.unread_count > 0).length;
  const paymentsOverdue = clients.filter((c) => c.payment_overdue && !getClientMarkedPaid(c.id)).length;

  return {
    checkinsDue,
    unreadMessages,
    paymentsOverdue,
    compPrepPending,
    posingReviewsPending,
    missingMandatoryPosesClients,
    peakWeekDueToday,
    totalActive: activeFeed.length,
  };
}
