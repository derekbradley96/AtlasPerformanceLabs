/**
 * Merge all actionable sources into one queue. Single priorityScore sort.
 * Apply queueStateRepo after building so DONE/WAITING/snooze override.
 */
import type { QueueItem, QueueStatus, QueueType } from './types';
import { dedupeKeyCheckin, dedupeKeyLead, dedupeKeyMissingPoses, dedupeKeyPaymentOverdue, dedupeKeyPeakWeek, dedupeKeyPosing, dedupeKeyRetention, dedupeKeyUnread, dedupeKeyIntake } from './dedupe';
import { computeReviewPriorityScore, normalizeClientPhaseForPriority } from '@/lib/intelligence/reviewPriority';
import type { HealthRiskLevel } from '@/lib/intelligence/reviewPriority';
import { getPhaseAwareHealthResult } from '@/lib/intelligence/healthScoreEngineBridge';
import { getEffectiveStatus } from './queueStateRepo';
import { getClients, getNeedsReviewCheckIns, getThreadsForTrainer, getThreadByClientId, getPaymentsForClient } from '@/data/selectors';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';
import { getClientHealthScoreSnapshot } from '@/lib/healthScoreService';
import { getLeadsForTrainer } from '@/lib/leadsStore';
import { buildCompPrepInboxItems } from '@/lib/inbox/compPrepInbox';
import { listCompClientsForTrainer, getMediaLogsForClients, getClientCompProfile, listMedia } from '@/lib/repos/compPrepRepo';
import { getClientCheckIns } from '@/data/selectors';
import { getAllPoses, getPoseById } from '@/lib/repos/poseLibraryRepo';
import { evaluateRetentionRisk } from '@/lib/retention/retentionRules';
import type { EvaluateRetentionRiskInput } from '@/lib/retention/retentionRules';
import {
  upsertRetentionItem,
  listActiveRetentionItems,
  getPreviousHealthForRetention,
  setPreviousHealthForRetention,
} from '@/lib/retention/retentionRepo';
import { evaluateFatigue } from '@/lib/energy/fatigueRules';
import { listSubmissionsNeedingReview } from '@/lib/intake/intakeSubmissionRepo';
import { getClientPhase } from '@/lib/clientPhaseStore';

function weekStartMonday(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

export interface BuildTrainerQueueInput {
  trainerId: string;
  now?: Date;
}

function buildItems(trainerId: string, now: Date): QueueItem[] {
  const rawClients = getClients();
  const clients = Array.isArray(rawClients) ? rawClients.filter((c) => c?.trainer_id === trainerId) : [];
  const clientIds = new Set((clients || []).map((c) => c?.id).filter(Boolean));
  const healthByClient = new Map<string, { score: number; risk: HealthRiskLevel }>();
  (clients || []).forEach((c) => {
    if (!c?.id) return;
    const checkIns = getClientCheckIns(c.id);
    const result = getPhaseAwareHealthResult(c, checkIns ?? []);
    healthByClient.set(c.id, { score: result.score, risk: result.risk });
  });
  const clientName = (id: string) => clients?.find((x) => x?.id === id)?.full_name ?? 'Client';

  const items: QueueItem[] = [];

  // CHECKIN_REVIEW
  const needsReview = (getNeedsReviewCheckIns() ?? []).filter((c) => clientIds.has(c?.client_id));
  for (const c of needsReview) {
    if (!c?.client_id) continue;
    const submitted = c.submitted_at || c.created_date;
    const weekStart = weekStartMonday(submitted || new Date().toISOString());
    const dedupeKey = dedupeKeyCheckin(c.client_id, weekStart);
    const health = healthByClient.get(c.client_id) ?? { score: 100, risk: 'low' as HealthRiskLevel };
    const title = clientName(c.client_id);
    const subtitle = submitted ? new Date(submitted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Check-in';
    const clientPhase = normalizeClientPhaseForPriority(getClientPhase(c.client_id, clients?.find((x) => x?.id === c.client_id)), undefined, now);
    const item: QueueItem = {
      id: c.id,
      dedupeKey,
      trainerId,
      clientId: c.client_id,
      clientName: title,
      type: 'CHECKIN_REVIEW',
      status: 'ACTIVE',
      title,
      subtitle,
      why: 'Check-in awaiting review',
      ctaLabel: 'Review',
      route: `/review/checkin/${encodeURIComponent(c.id)}?clientId=${encodeURIComponent(c.client_id)}`,
      priorityScore: 0,
      createdAt: submitted || new Date().toISOString(),
      dueAt: c.due_date,
      meta: { feedType: 'checkin', healthScore: health.score, healthRisk: health.risk, clientPhase },
    };
    item.priorityScore = computeReviewPriorityScore({
      type: 'CHECKIN_REVIEW',
      healthRisk: health.risk,
      healthScore: health.score,
      clientPhase,
      dueAt: item.dueAt,
      createdAt: item.createdAt,
      now,
    });
    items.push(item);
  }

  // Comp prep: POSING_REVIEW, MISSING_MANDATORY_POSES, PEAK_WEEK_DUE
  const compProfiles = listCompClientsForTrainer(trainerId) ?? [];
  const compClientIds = (compProfiles || []).map((p) => p?.clientId).filter(Boolean) as string[];
  const compMediaLogs = getMediaLogsForClients(compClientIds);
  const compClients = (clients || []).filter((c) => c?.id && compClientIds.includes(c.id)).map((c) => ({ id: c!.id, full_name: c?.full_name ?? 'Client' }));
  const today = now.toISOString().slice(0, 10);
  const hasCheckinToday = (clientId: string) =>
    (getClientCheckIns(clientId) ?? []).some((c) => ((c?.submitted_at || c?.created_date) || '').toString().slice(0, 10) === today);
  const compPrepInbox = buildCompPrepInboxItems({
    trainerId,
    clients: compClients,
    compProfiles,
    poses: getAllPoses() ?? [],
    mediaLogs: compMediaLogs ?? [],
    now,
    hasCheckinToday,
  });

  for (const it of compPrepInbox) {
    if (it.type === 'POSING_SUBMISSION_REVIEW') {
      const rawPayload = it.raw as { count?: number; media?: Array<{ id: string }> } | undefined;
      const firstMedia = rawPayload?.media?.[0];
      const mediaId = firstMedia?.id ?? it.id.replace(/^posing_review:/, '');
      const dedupeKey = dedupeKeyPosing(mediaId);
      const health = healthByClient.get(it.clientId) ?? { score: 100, risk: 'low' as HealthRiskLevel };
      const profile = compProfiles.find((p) => p.clientId === it.clientId);
      const clientPhase = normalizeClientPhaseForPriority(getClientPhase(it.clientId, compClients?.find((x) => x?.id === it.clientId)), profile?.showDate, now);
      const item: QueueItem = {
        id: mediaId,
        dedupeKey,
        trainerId,
        clientId: it.clientId,
        clientName: it.title,
        type: 'POSING_REVIEW',
        status: 'ACTIVE',
        title: it.title,
        subtitle: it.subtitle,
        why: it.why,
        ctaLabel: 'Review',
        route: `/comp-prep/review/${encodeURIComponent(mediaId)}?clientId=${encodeURIComponent(it.clientId)}`,
        priorityScore: 0,
        createdAt: it.createdAt,
        meta: { feedType: 'posing', healthScore: health.score, healthRisk: health.risk, showDate: profile?.showDate, posingCount: rawPayload?.count ?? 1, clientPhase },
      };
      item.priorityScore = computeReviewPriorityScore({
        type: 'POSING_REVIEW',
        healthRisk: health.risk,
        healthScore: health.score,
        clientPhase,
        showDate: profile?.showDate,
        createdAt: item.createdAt,
        now,
      });
      items.push(item);
    } else if (it.type === 'MISSING_MANDATORY_POSES') {
      const dedupeKey = dedupeKeyMissingPoses(it.clientId);
      const health = healthByClient.get(it.clientId) ?? { score: 100, risk: 'low' as HealthRiskLevel };
      const profile = compProfiles.find((p) => p.clientId === it.clientId);
      const missingPosesPhase = normalizeClientPhaseForPriority(getClientPhase(it.clientId, compClients?.find((x) => x?.id === it.clientId)), profile?.showDate, now);
      const item: QueueItem = {
        id: it.id,
        dedupeKey,
        trainerId,
        clientId: it.clientId,
        clientName: it.title,
        type: 'MISSING_MANDATORY_POSES',
        status: 'ACTIVE',
        title: it.title,
        subtitle: it.subtitle,
        why: it.why,
        ctaLabel: 'Poses',
        route: `/comp-prep/client/${it.clientId}`,
        priorityScore: 0,
        createdAt: it.createdAt ?? now.toISOString(),
        meta: { feedType: 'missing_poses', showDate: profile?.showDate, healthScore: health.score, healthRisk: health.risk, clientPhase: missingPosesPhase },
      };
      item.priorityScore = computeReviewPriorityScore({
        type: 'MISSING_MANDATORY_POSES',
        healthRisk: health.risk,
        healthScore: health.score,
        clientPhase: missingPosesPhase,
        showDate: profile?.showDate,
        createdAt: item.createdAt,
        now,
      });
      items.push(item);
    } else if (it.type === 'PEAK_WEEK_DUE') {
      const dateStr = it.showDate ?? today;
      const dedupeKey = dedupeKeyPeakWeek(it.clientId, today);
      const health = healthByClient.get(it.clientId) ?? { score: 100, risk: 'low' as HealthRiskLevel };
      const profile = compProfiles.find((p) => p.clientId === it.clientId);
      const item: QueueItem = {
        id: it.id,
        dedupeKey,
        trainerId,
        clientId: it.clientId,
        clientName: it.title,
        type: 'PEAK_WEEK_DUE',
        status: 'ACTIVE',
        title: it.title,
        subtitle: it.subtitle,
        why: it.why,
        ctaLabel: 'Open',
        route: `/comp-prep/client/${it.clientId}`,
        priorityScore: 0,
        createdAt: it.createdAt ?? now.toISOString(),
        dueAt: today,
        meta: { feedType: 'peak_week_due', showDate: profile?.showDate, healthScore: health.score, healthRisk: health.risk, clientPhase: 'peak_week' },
      };
      item.priorityScore = computeReviewPriorityScore({
        type: 'PEAK_WEEK_DUE',
        healthRisk: health.risk,
        healthScore: health.score,
        clientPhase: 'peak_week',
        showDate: profile?.showDate,
        dueAt: today,
        createdAt: item.createdAt,
        now,
      });
      items.push(item);
    }
  }

  // PAYMENT_OVERDUE
  const overdueClients = (clients || []).filter((c) => c?.payment_overdue && c?.id && !getClientMarkedPaid(c.id));
  for (const c of overdueClients) {
    if (!c?.id) continue;
    const dedupeKey = dedupeKeyPaymentOverdue(c.id);
    const health = healthByClient.get(c.id) ?? { score: 100, risk: 'low' as HealthRiskLevel };
    const item: QueueItem = {
      id: `pay:${c.id}`,
      dedupeKey,
      trainerId,
      clientId: c.id,
      clientName: c.full_name ?? 'Client',
      type: 'PAYMENT_OVERDUE',
      status: 'ACTIVE',
      title: c.full_name ?? 'Client',
      subtitle: 'Payment overdue',
      why: 'Follow up on overdue payment',
      ctaLabel: 'View',
      route: `/clients/${c.id}`,
      priorityScore: 0,
      createdAt: new Date().toISOString(),
      meta: { healthScore: health.score, healthRisk: health.risk },
    };
    item.priorityScore = computeReviewPriorityScore({
      type: 'PAYMENT_OVERDUE',
      healthRisk: health.risk,
      healthScore: health.score,
      clientPhase: c.id ? normalizeClientPhaseForPriority(getClientPhase(c.id, c), (c as { showDate?: string | null }).showDate, now) : null,
      now,
    });
    items.push(item);
  }

  // UNREAD_MESSAGES
  const threads = (getThreadsForTrainer(trainerId) ?? []).filter((t) => (t?.unread_count ?? 0) > 0);
  for (const t of threads) {
    const cid = t?.client_id;
    if (!cid || !clientIds.has(cid)) continue;
    const dedupeKey = dedupeKeyUnread(cid);
    const health = healthByClient.get(cid) ?? { score: 100, risk: 'low' as HealthRiskLevel };
    const unread = t.unread_count ?? 0;
    const item: QueueItem = {
      id: `thread:${t.id ?? cid}`,
      dedupeKey,
      trainerId,
      clientId: cid,
      clientName: clientName(cid),
      type: 'UNREAD_MESSAGES',
      status: 'ACTIVE',
      title: clientName(cid),
      subtitle: `${unread} unread`,
      why: `${unread} unread message(s)`,
      ctaLabel: 'Open',
      route: `/messages/${cid}`,
      priorityScore: 0,
      createdAt: t.last_message_at ?? new Date().toISOString(),
      meta: { unreadCount: unread, healthScore: health.score, healthRisk: health.risk },
    };
    item.priorityScore = computeReviewPriorityScore({
      type: 'UNREAD_MESSAGES',
      healthRisk: health.risk,
      healthScore: health.score,
      clientPhase: cid ? normalizeClientPhaseForPriority(getClientPhase(cid, clients?.find((x) => x?.id === cid)), undefined, now) : null,
      unreadCount: unread,
      createdAt: item.createdAt,
      now,
    });
    items.push(item);
  }

  // NEW_LEAD
  const leads = (getLeadsForTrainer(trainerId) ?? []).filter((l) => l?.status === 'new' || !l?.status);
  for (const l of leads) {
    const dedupeKey = dedupeKeyLead(l.id);
    const title = l.applicantName || l.name || 'New lead';
    const subtitle = l.serviceSnapshot?.name ? `${l.serviceSnapshot.name} · ${l.email || ''}` : (l.email || '');
    const why = (l.goal && l.goal.trim()) ? `${l.goal.slice(0, 60)}${l.goal.length > 60 ? '…' : ''}` : 'New lead to contact';
    const item: QueueItem = {
      id: l.id,
      dedupeKey,
      trainerId,
      type: 'NEW_LEAD',
      status: 'ACTIVE',
      title,
      subtitle,
      why,
      ctaLabel: 'View',
      route: '/leads',
      priorityScore: 0,
      createdAt: l.created_date ?? l.createdAt ?? new Date().toISOString(),
      meta: { leadId: l.id },
    };
    item.priorityScore = computeReviewPriorityScore({
      type: 'NEW_LEAD',
      createdAt: item.createdAt,
      now,
    });
    items.push(item);
  }

  // INTAKE_REVIEW: one card per submission needing review
  const intakeSubmissions = (listSubmissionsNeedingReview(trainerId) ?? []).filter((s) => s?.clientId && clientIds.has(s.clientId));
  for (const sub of intakeSubmissions) {
    if (!sub?.clientId) continue;
    const dedupeKey = dedupeKeyIntake(sub.id);
    const health = healthByClient.get(sub.clientId) ?? { score: 100, risk: 'low' as HealthRiskLevel };
    const title = clientName(sub.clientId);
    const flags = sub.flags ?? {};
    const why = flags.readinessRedFlags?.length
      ? 'Readiness flags need review'
      : flags.injuries?.length
        ? 'Injuries noted'
        : flags.equipmentLimits?.length
          ? 'Equipment limits'
          : 'Intake submitted';
    const item: QueueItem = {
      id: sub.id,
      dedupeKey,
      trainerId,
      clientId: sub.clientId ?? undefined,
      clientName: title,
      type: 'INTAKE_REVIEW',
      status: 'ACTIVE',
      title,
      subtitle: sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Intake',
      why,
      ctaLabel: 'Review',
      route: `/clients/${sub.clientId}/intake`,
      priorityScore: 0,
      createdAt: sub.submittedAt ?? sub.updatedAt ?? new Date().toISOString(),
      meta: { feedType: 'intake', submissionId: sub.id, healthScore: health.score, healthRisk: health.risk },
    };
    item.priorityScore = computeReviewPriorityScore({
      type: 'INTAKE_REVIEW',
      healthRisk: health.risk,
      healthScore: health.score,
      clientPhase: sub.clientId ? normalizeClientPhaseForPriority(getClientPhase(sub.clientId, clients?.find((x) => x?.id === sub.clientId)), undefined, now) : null,
      createdAt: item.createdAt,
      now,
    });
    items.push(item);
  }

  // RETENTION_RISK: evaluate per client, upsert, then add active items to queue
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  for (const c of clients ?? []) {
    if (!c?.id) continue;
    const phaseHealth = healthByClient.get(c.id);
    const healthSnap = getClientHealthScoreSnapshot(c.id);
    const health: number = phaseHealth?.score ?? (typeof healthSnap?.score === 'number' ? healthSnap.score : 100);
    const prevHealth = getPreviousHealthForRetention(c.id);
    const checkins = getClientCheckIns(c.id);
    const payments = getPaymentsForClient(c.id);
    const thread = getThreadByClientId(c.id);
    const profile = getClientCompProfile(c.id);
    const mediaLogs = listMedia(c.id, { category: 'posing' });
    const hasPosingInLast7Days: boolean = Array.isArray(mediaLogs)
      ? (mediaLogs as Array<{ createdAt?: string }>).some((m) => m.createdAt != null && new Date(m.createdAt) >= sevenDaysAgo)
      : false;
    const retentionItem = evaluateRetentionRisk({
      client: { id: c.id, trainer_id: c.trainer_id, payment_overdue: c.payment_overdue },
      healthSnapshot: healthSnap ? { score: health } : null,
      previousHealthScore: prevHealth?.score ?? null,
      previousHealthAt: prevHealth?.at ?? null,
      checkins,
      payments,
      thread: thread ? { unread_count: thread.unread_count, last_message_at: thread.last_message_at } : null,
      showDate: profile?.showDate ?? null,
      hasPosingInLast7Days,
      now,
    } as EvaluateRetentionRiskInput);
    if (retentionItem) {
      upsertRetentionItem(retentionItem);
    }
    setPreviousHealthForRetention(c.id, health, now.toISOString());
  }
  const activeRetention = listActiveRetentionItems(trainerId, now) ?? [];
  for (const r of activeRetention) {
    if (!r?.clientId) continue;
    const dedupeKey = dedupeKeyRetention(r.clientId);
    const health = healthByClient.get(r.clientId) ?? { score: 100, risk: 'low' as HealthRiskLevel };
    const client = clients?.find((x) => x?.id === r.clientId);
    const paymentOverdue = client?.payment_overdue && !getClientMarkedPaid(r.clientId);
    const why = (r?.reasons ?? []).map((s) => s?.detail ?? s).join(' · ').slice(0, 120) || 'Retention risk';
    const item: QueueItem = {
      id: `retention:${r.clientId}`,
      dedupeKey,
      trainerId,
      clientId: r.clientId,
      clientName: clientName(r.clientId),
      type: 'RETENTION_RISK',
      status: 'ACTIVE',
      title: clientName(r.clientId),
      subtitle: 'Retention risk',
      why,
      ctaLabel: 'Open',
      route: `/clients/${r.clientId}/intervention`,
      priorityScore: 0,
      createdAt: r.updatedAt,
      meta: { retentionLevel: r.level, score: r.score, healthScore: health.score, healthRisk: health.risk },
    };
    item.priorityScore = computeReviewPriorityScore({
      type: 'RETENTION_RISK',
      healthRisk: health.risk,
      healthScore: health.score,
      clientPhase: r.clientId ? normalizeClientPhaseForPriority(getClientPhase(r.clientId, clients?.find((x) => x?.id === r.clientId)), undefined, now) : null,
      now,
    });
    if (health.score < 60) {
      const fatigue = evaluateFatigue(r.clientId, { now });
      if (fatigue.fatigueLevel === 'HIGH') item.priorityScore += 10;
    }
    items.push(item);
  }

  return items;
}

/** Group by clientId + type; one card per (client, category) with count in meta. */
function consolidateQueueItems(items: QueueItem[]): QueueItem[] {
  const key = (i: QueueItem) => `${i.clientId ?? 'global'}:${i.type}`;
  const groups = new Map<string, QueueItem[]>();
  for (const item of items) {
    const k = key(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(item);
  }
  const out: QueueItem[] = [];
  for (const [, group] of groups) {
    if (group.length === 0) continue;
    const best = group.reduce((a, b) => (b.priorityScore >= a.priorityScore ? b : a));
    const count = group.length;
    const consolidated: QueueItem = {
      ...best,
      id: best.id,
      dedupeKey: best.dedupeKey,
      meta: { ...best.meta, count },
    };
    if (count > 1 && (best.type === 'CHECKIN_REVIEW' || best.type === 'POSING_REVIEW')) {
      consolidated.subtitle = `${count} ${best.type === 'CHECKIN_REVIEW' ? 'check-ins' : 'submissions'}`;
    }
    out.push(consolidated);
  }
  return out;
}

/**
 * Build full trainer queue: merge all sources, consolidate by client+category, apply state overlay, sort by priorityScore desc.
 */
export async function buildTrainerQueue(input: BuildTrainerQueueInput): Promise<QueueItem[]> {
  const { trainerId, now: inputNow } = input;
  const now = inputNow ?? new Date();
  const raw = buildItems(trainerId, now);
  const consolidated = consolidateQueueItems(raw);

  const withStatus: QueueItem[] = consolidated.map((item) => {
    const effective: QueueStatus = getEffectiveStatus(item.dedupeKey, item.status);
    return { ...item, status: effective };
  });

  withStatus.sort((a, b) => b.priorityScore - a.priorityScore);
  return withStatus;
}

/** Active count for auto-open. */
export async function getActiveQueueCount(trainerId: string): Promise<number> {
  const queue = await buildTrainerQueue({ trainerId });
  return queue.filter((i) => i.status === 'ACTIVE').length;
}

/** Active items with priorityScore (for auto-open threshold check). */
export async function getActiveQueueItems(trainerId: string): Promise<QueueItem[]> {
  const queue = await buildTrainerQueue({ trainerId });
  return queue.filter((i) => i.status === 'ACTIVE');
}

/** Top active item for single-item flow (e.g. /review-global). */
export async function getTopActiveQueueItem(trainerId: string): Promise<QueueItem | null> {
  const queue = await buildTrainerQueue({ trainerId });
  const active = queue.filter((i) => i.status === 'ACTIVE');
  return active.length > 0 ? active[0] : null;
}
