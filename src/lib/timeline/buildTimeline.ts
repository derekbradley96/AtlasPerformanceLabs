/**
 * Build client timeline from existing repos. Single sort by occurredAt desc.
 * Retention-related events from v_client_retention_signals and v_client_progress_trends when Supabase is available.
 */
import type { TimelineEvent, TimelineEventType, TimelineBadge } from './timelineTypes';
import * as sandbox from '@/lib/sandboxStore';
import { SUPABASE_ENABLED } from '@/lib/config';
import {
  getClientById as repoGetClientById,
  getCheckInsForClient,
  getPaymentsForClient as repoGetPaymentsForClient,
} from '@/data/repos/atlasRepo';
import { getClientPhaseHistory } from '@/lib/clientPhaseStore';
import { getProgramChangeLog } from '@/lib/programChangeLogStore';
import { getCheckinReviewed, getCheckinReviewedAt } from '@/lib/checkinReviewStorage';
import { getAchievementsList } from '@/lib/milestonesStore';
import { getClientCompProfile, listMedia } from '@/lib/repos/compPrepRepo';
import { getStoredRetention } from '@/lib/retention/retentionRepo';
import { getActionLogForClient } from './actionLogRepo';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { formatWeightForViewer, normalizeWeightUnit } from '@/lib/bodyMeasurementUnits';
import { getMessagesThreadPath } from '@/lib/messagesPath';

function ev(
  id: string,
  clientId: string,
  type: TimelineEventType,
  occurredAt: string,
  title: string,
  opts: { subtitle?: string; meta?: Record<string, unknown>; route?: string; badge?: TimelineBadge } = {}
): TimelineEvent {
  return {
    id,
    clientId,
    type,
    occurredAt,
    title,
    subtitle: opts.subtitle,
    meta: opts.meta,
    route: opts.route,
    badge: opts.badge,
  };
}

export type ClientTimelineOptions = { weightUnit?: string; trainerId?: string };

export async function getClientTimeline(
  clientId: string,
  _now: Date = new Date(),
  options: ClientTimelineOptions = {}
): Promise<TimelineEvent[]> {
  const wu = normalizeWeightUnit(options.weightUnit ?? 'kg');
  const trainerIdOpt = options.trainerId;

  let client: Record<string, unknown> | null = null;
  let checkIns: Array<Record<string, unknown>> = [];
  let payments: Array<Record<string, unknown>> = [];

  if (!SUPABASE_ENABLED) {
    client = (sandbox.getClientById(clientId) as Record<string, unknown>) ?? null;
    checkIns = (sandbox.listCheckIns(clientId) ?? []) as Array<Record<string, unknown>>;
    payments = (sandbox.listPayments(clientId) ?? []) as Array<Record<string, unknown>>;
  } else {
    const [c, ch, pay] = await Promise.all([
      repoGetClientById(clientId, false, trainerIdOpt),
      getCheckInsForClient(clientId, false, trainerIdOpt),
      repoGetPaymentsForClient(clientId, false),
    ]);
    client = (c as Record<string, unknown> | null) ?? ((sandbox.getClientById(clientId) as Record<string, unknown>) ?? null);
    checkIns = (Array.isArray(ch) ? ch : []) as unknown as Array<Record<string, unknown>>;
    payments = (Array.isArray(pay) ? pay : []) as unknown as Array<Record<string, unknown>>;
  }

  const events: TimelineEvent[] = [];

  // CLIENT_JOINED
  if (client?.created_date) {
    events.push(
      ev(`joined-${clientId}`, clientId, 'CLIENT_JOINED', String(client.created_date), 'Joined', { badge: 'System' })
    );
  }

  // PHASE_CHANGED (from clientPhaseStore history)
  const phaseHistory = getClientPhaseHistory(clientId, 30);
  for (const h of phaseHistory) {
    const at = h.effectiveDate && h.effectiveDate !== (typeof client?.created_date === 'string' ? client.created_date.slice(0, 10) : '')
      ? `${h.effectiveDate}T12:00:00Z`
      : (h.createdAt ?? `${h.effectiveDate}T12:00:00Z`);
    events.push(
      ev(`phase-${h.id}`, clientId, 'PHASE_CHANGED', at, `Phase: ${h.phase}`, {
        subtitle: h.note || undefined,
        meta: { phase: h.phase, effectiveDate: h.effectiveDate },
        badge: 'System',
      })
    );
  }

  // PROGRAM_ASSIGNED / PROGRAM_UPDATED
  const changeLog = getProgramChangeLog(clientId);
  for (const e of changeLog) {
    const at = e.created_date ?? `${e.effectiveDate}T12:00:00Z`;
    const isAssign = (e.action || '').toLowerCase() === 'assigned';
    events.push(
      ev(`pcl-${e.id}`, clientId, isAssign ? 'PROGRAM_ASSIGNED' : 'PROGRAM_UPDATED', at, `${e.programName ?? 'Program'} ${e.action ?? 'updated'}`, {
        subtitle: `Effective ${e.effectiveDate}`,
        meta: { programId: e.programId },
        route: '/programs',
        badge: 'System',
      })
    );
  }

  // CHECKIN_SUBMITTED + CHECKIN_REVIEWED
  for (const c of checkIns) {
    const submittedAt = c.submitted_at || c.created_date;
    if (submittedAt) {
      events.push(
        ev(`checkin-sub-${String(c.id)}`, clientId, 'CHECKIN_SUBMITTED', String(submittedAt), 'Check-in submitted', {
          subtitle: c.weight_kg != null ? formatWeightForViewer(Number(c.weight_kg), wu) : undefined,
          meta: { checkinId: c.id },
          route: `/clients/${clientId}/checkins/${c.id}`,
          badge: 'Review',
        })
      );
    }
    if (getCheckinReviewed(String(c.id))) {
      const reviewedAt = getCheckinReviewedAt(String(c.id)) || submittedAt;
      if (reviewedAt) {
        events.push(
          ev(`checkin-rev-${String(c.id)}`, clientId, 'CHECKIN_REVIEWED', String(reviewedAt), 'Check-in reviewed', {
            meta: { checkinId: c.id },
            route: `/clients/${clientId}/checkins/${c.id}`,
            badge: 'Review',
          })
        );
      }
    }
  }

  // PAYMENT_PAID / PAYMENT_OVERDUE
  for (const p of payments) {
    const pay = p as {
      id: string;
      status?: string;
      paid_at?: string | null;
      due_date?: string;
      amount?: number;
      created_at?: string;
    };
    if (pay.status === 'paid' && pay.paid_at) {
      events.push(
        ev(`pay-paid-${pay.id}`, clientId, 'PAYMENT_PAID', pay.paid_at, 'Payment received', {
          subtitle: pay.amount != null ? `$${pay.amount}` : undefined,
          meta: { paymentId: pay.id },
          badge: 'Payment',
        })
      );
    }
    const overdueAt = pay.due_date || (typeof pay.created_at === 'string' ? pay.created_at.slice(0, 10) : null);
    if (pay.status === 'overdue' && overdueAt) {
      events.push(
        ev(`pay-overdue-${pay.id}`, clientId, 'PAYMENT_OVERDUE', `${overdueAt}T23:59:59Z`, 'Payment overdue', {
          subtitle: pay.amount != null ? `$${pay.amount}` : undefined,
          meta: { paymentId: pay.id },
          route: getMessagesThreadPath(clientId),
          badge: 'Payment',
        })
      );
    }
  }

  // PAYMENT_REMINDER_SENT, INTERVENTION_OPENED, INTERVENTION_ACK (from action log)
  const actionLog = getActionLogForClient(clientId);
  for (const a of actionLog) {
    if (a.action === 'payment_reminder_sent') {
      events.push(
        ev(a.id, clientId, 'PAYMENT_REMINDER_SENT', a.at, 'Payment reminder sent', { badge: 'Payment' })
      );
    }
    if (a.action === 'intervention_opened') {
      events.push(
        ev(a.id, clientId, 'INTERVENTION_OPENED', a.at, 'Intervention opened', {
          route: `/clients/${clientId}/intervention`,
          badge: 'System',
        })
      );
    }
    if (a.action === 'intervention_ack') {
      events.push(
        ev(a.id, clientId, 'INTERVENTION_ACK', a.at, 'Intervention acknowledged', {
          route: `/clients/${clientId}/intervention`,
          badge: 'System',
        })
      );
    }
    if (a.action === 'peak_week_completed') {
      events.push(
        ev(a.id, clientId, 'PEAK_WEEK_COMPLETED', a.at, 'Peak week completed', {
          badge: 'Comp Prep',
        })
      );
    }
    if (a.action === 'milestone_ack_trainer') {
      events.push(
        ev(a.id, clientId, 'MILESTONE_ACK_TRAINER', a.at, 'Milestone acknowledged', {
          meta: a.meta,
          badge: 'Milestone',
        })
      );
    }
  }

  // MILESTONE_UNLOCKED
  const achievements = getAchievementsList(clientId, { byUser: false });
  for (const a of achievements) {
    const at = a.unlockedAt ?? new Date().toISOString();
    events.push(
      ev(`ms-${a.id}`, clientId, 'MILESTONE_UNLOCKED', at, a.title ?? 'Milestone unlocked', {
        subtitle: a.description ?? undefined,
        meta: { milestoneId: a.milestoneId },
        badge: 'Milestone',
      })
    );
  }

  // COMP_SHOW_SET (profile showDate updated)
  const profile = getClientCompProfile(clientId);
  if (profile?.showDate && profile?.updatedAt) {
    events.push(
      ev(`comp-show-${clientId}`, clientId, 'COMP_SHOW_SET', profile.updatedAt, 'Show date set', {
        subtitle: profile.showDate,
        meta: { showDate: profile.showDate },
        route: `/comp-prep/client/${clientId}`,
        badge: 'Comp Prep',
      })
    );
  }

  // POSING_SUBMITTED / POSING_REVIEWED (comp prep media)
  const posingMedia = listMedia(clientId, { category: 'posing' });
  for (const m of posingMedia) {
    const createdAt = m.createdAt ?? new Date().toISOString();
    events.push(
      ev(`pose-sub-${m.id}`, clientId, 'POSING_SUBMITTED', createdAt, 'Posing submission', {
        meta: { mediaId: m.id },
        route: `/comp-prep/review/${m.id}`,
        badge: 'Comp Prep',
      })
    );
    if (m.reviewedAt) {
      events.push(
        ev(`pose-rev-${m.id}`, clientId, 'POSING_REVIEWED', m.reviewedAt, 'Posing reviewed', {
          meta: { mediaId: m.id },
          route: `/comp-prep/review/${m.id}`,
          badge: 'Comp Prep',
        })
      );
    }
  }

  // RETENTION_FLAGGED
  const stored = getStoredRetention(clientId);
  if (stored?.lastSeenAt && !stored.archivedAt) {
    events.push(
      ev(`retention-${clientId}`, clientId, 'RETENTION_FLAGGED', stored.lastSeenAt, 'Retention risk flagged', {
        subtitle: stored.item.reasons?.[0]?.detail ?? undefined,
        route: `/clients/${clientId}/intervention`,
        badge: 'System',
      })
    );
  }

  // INTERVENTION_ACK from stored (legacy) only if not already in action log
  const hasAckInLog = actionLog.some((a) => a.action === 'intervention_ack');
  if (!hasAckInLog && stored?.lastAcknowledgedAt) {
    events.push(
      ev(`intervention-ack-${clientId}`, clientId, 'INTERVENTION_ACK', stored.lastAcknowledgedAt, 'Intervention acknowledged', {
        route: `/clients/${clientId}/intervention`,
        badge: 'System',
      })
    );
  }

  // Retention events from v_client_retention_signals and v_client_progress_trends (Supabase)
  if (hasSupabase) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const [signalsRes, trendsRes] = await Promise.all([
          supabase
            .from('v_client_retention_signals')
            .select('client_id, days_since_last_checkin, days_since_last_workout, workouts_last_7d')
            .eq('client_id', clientId)
            .maybeSingle(),
          supabase
            .from('v_client_progress_trends')
            .select('client_id, checkin_id, submitted_at, compliance')
            .eq('client_id', clientId)
            .order('submitted_at', { ascending: false })
            .limit(100),
        ]);
        const signals = signalsRes.data;
        const trends = (trendsRes.data ?? []) as Array<{ checkin_id?: string; submitted_at?: string; compliance?: number | null }>;

        const nowIso = new Date().toISOString();

        if (signals != null) {
          const daysSinceWorkout = signals.days_since_last_workout ?? null;
          const workouts7d = signals.workouts_last_7d ?? null;
          const daysSinceCheckin = signals.days_since_last_checkin ?? null;

          if (workouts7d === 0 && daysSinceWorkout != null && daysSinceWorkout >= 7) {
            events.push(
              ev(`retention-no-workouts-${clientId}`, clientId, 'NO_WORKOUTS_7D', nowIso, 'No workouts logged for 7 days', {
                badge: 'Retention',
                meta: { days_since_last_workout: daysSinceWorkout },
                route: `/clients/${clientId}`,
              })
            );
          }
          if (daysSinceCheckin != null && daysSinceCheckin >= 7) {
            events.push(
              ev(`retention-missed-checkin-${clientId}`, clientId, 'CHECKIN_MISSED', nowIso, 'Missed check-in', {
                badge: 'Retention',
                subtitle: daysSinceCheckin > 0 ? `${daysSinceCheckin} days since last check-in` : undefined,
                meta: { days_since_last_checkin: daysSinceCheckin },
                route: `/clients/${clientId}/checkins`,
              })
            );
          }
        }

        for (const row of trends) {
          const compliance = row.compliance != null ? Number(row.compliance) : null;
          if (compliance !== null && compliance < 60 && row.submitted_at) {
            const checkinId = row.checkin_id ?? `trend-${row.submitted_at}`;
            events.push(
              ev(`retention-compliance-${checkinId}`, clientId, 'COMPLIANCE_LOW', row.submitted_at, 'Compliance dropped below 60%', {
                badge: 'Retention',
                subtitle: `${Math.round(compliance)}%`,
                meta: { checkin_id: checkinId, compliance },
                route: row.checkin_id ? `/clients/${clientId}/checkins/${row.checkin_id}` : undefined,
              })
            );
          }
        }
      } catch (_) {
        // Supabase fetch failed; timeline still has other events
      }
    }
  }

  // Dedupe by id and sort by occurredAt desc
  const byId = new Map<string, TimelineEvent>();
  for (const e of events) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const list = Array.from(byId.values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
  return list;
}
