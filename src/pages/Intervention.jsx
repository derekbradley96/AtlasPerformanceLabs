import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, MessageSquare, CreditCard, Camera, Calendar, ClipboardList, CheckCircle } from 'lucide-react';
import { getInterventionSnapshot } from '@/lib/intervention/interventionService';
import { setRetentionAcknowledged } from '@/lib/retention/retentionRepo';
import { appendActionLog } from '@/lib/timeline/actionLogRepo';
import { setQueueItemState } from '@/lib/reviewQueue';
import { dedupeKeyPaymentOverdue } from '@/lib/reviewQueue/dedupe';
import { getCheckinNudgeTemplate, getTemplate } from '@/lib/intervention/templates';
import Card from '@/ui/Card';
import { SkeletonCard } from '@/ui/Skeleton';
import { colors, spacing } from '@/ui/tokens';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';

const HEALTH_PILL = { on_track: { bg: 'rgba(34,197,94,0.2)', color: '#22C55E' }, monitor: { bg: 'rgba(245,158,11,0.2)', color: '#F59E0B' }, at_risk: { bg: 'rgba(239,68,68,0.2)', color: '#EF4444' } };

function formatDaysAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now - d) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function Intervention() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { registerRefresh } = outletContext;
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await getInterventionSnapshot(clientId);
      setSnapshot(data);
    } catch (e) {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (clientId) appendActionLog(clientId, 'intervention_opened');
  }, [clientId]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') return registerRefresh(loadSnapshot);
  }, [registerRefresh, loadSnapshot]);

  if (!clientId) {
    return (
      <div className="app-screen" style={{ padding: spacing[16], background: colors.bg, color: colors.text }}>
        <p style={{ color: colors.muted }}>Client not found.</p>
        <button type="button" onClick={() => navigate('/review-center')} className="text-[15px] font-medium" style={{ color: colors.accent, marginTop: spacing[16] }}>
          Back to Review Center
        </button>
      </div>
    );
  }

  if (loading && !snapshot) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{ padding: spacing[16], paddingBottom: spacing[24], background: colors.bg }}
      >
        <div style={{ height: 24, width: 80, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: spacing[16] }} />
        <SkeletonCard style={{ marginBottom: spacing[12] }} />
        <SkeletonCard style={{ marginBottom: spacing[12] }} />
        <SkeletonCard />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app-screen" style={{ padding: spacing[16], background: colors.bg, color: colors.text }}>
        <p style={{ color: colors.muted }}>Could not load intervention data.</p>
        <button type="button" onClick={() => navigate(clientId ? `/clients/${clientId}` : -1)} className="text-[15px] font-medium mt-4" style={{ color: colors.accent }}>
          Back
        </button>
      </div>
    );
  }

  const { client, health, retention, workload, trends, context, recovery } = snapshot;
  const pillStyle = HEALTH_PILL[health.status] ?? HEALTH_PILL.at_risk;
  const reasons = (retention?.reasons?.length ? retention.reasons.map((r) => r.detail) : health.reasons).slice(0, 5);

  const openMessagesWithPrefill = (template) => {
    navigate(`/messages/${clientId}`, { state: { prefilledMessage: template } });
  };

  const handlePaymentReminder = async () => {
    await impactLight();
    appendActionLog(clientId, 'payment_reminder_sent');
    const dedupeKey = dedupeKeyPaymentOverdue(clientId);
    const until = new Date();
    until.setHours(until.getHours() + 48);
    setQueueItemState(dedupeKey, { status: 'WAITING', snoozedUntil: until.toISOString() });
    openMessagesWithPrefill(getTemplate('payment_reminder'));
    toast.success('Reminder template ready. Edit and send when ready.');
  };

  const handleMarkMonitored = async () => {
    await impactLight();
    setRetentionAcknowledged(clientId);
    appendActionLog(clientId, 'intervention_ack');
    toast.success('Marked as monitored for 7 days.');
    loadSnapshot();
  };

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        padding: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <button
        type="button"
        onClick={async () => { await impactLight(); navigate(clientId ? `/clients/${clientId}` : -1); }}
        className="flex items-center gap-2 border-none bg-transparent mb-4"
        style={{ color: colors.accent }}
      >
        <ArrowLeft size={20} /> Back
      </button>

      {/* 1) Status strip */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <h1 className="text-[20px] font-semibold mb-2" style={{ color: colors.text }}>{client.name}</h1>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.1)', color: colors.text }}>
            {client.phase}
          </span>
          {client.goal && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: colors.muted }}>
              {client.goal}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: pillStyle.bg, color: pillStyle.color }}>
            {health.score} {health.status === 'on_track' ? 'On track' : health.status === 'monitor' ? 'Monitor' : 'At risk'}
          </span>
          {context.daysToShow != null && context.daysToShow >= 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }}>
              Show in {context.daysToShow} days
            </span>
          )}
        </div>
      </Card>

      {/* 2) What's happening */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>What's happening</p>
        {reasons.length > 0 ? (
          <ul className="list-disc list-inside text-[14px] space-y-1" style={{ color: colors.text }}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px]" style={{ color: colors.muted }}>No specific signals right now.</p>
        )}
      </Card>

      {/* 2b) Recovery & Energy */}
      {recovery && (
        <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
          <p className="text-[13px] font-medium mb-3" style={{ color: colors.muted }}>Recovery & Energy</p>
          <div className="space-y-2 text-[14px]" style={{ color: colors.text }}>
            <p>Energy avg {recovery.energyAvg7d > 0 ? recovery.energyAvg7d.toFixed(1) : '—'} (7d)</p>
            {recovery.sleepAvg7d != null && <p>Sleep avg {recovery.sleepAvg7d}h</p>}
            <p>Fatigue: {recovery.fatigueLevel}</p>
            {recovery.signals?.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5" style={{ color: colors.muted }}>
                {recovery.signals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {/* 3) Trends */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-[13px] font-medium mb-3" style={{ color: colors.muted }}>Trends</p>
        <div className="space-y-2 text-[14px]" style={{ color: colors.text }}>
          {trends.weight.last14dDelta != null && (
            <p>Weight 14d: {trends.weight.last14dDelta > 0 ? '+' : ''}{trends.weight.last14dDelta} kg ({client.phase})</p>
          )}
          {trends.strength.summary && <p>Strength: {trends.strength.summary}</p>}
          {(trends.adherence.last2Avg != null || trends.adherence.last4Avg != null) && (
            <p>Adherence: last 2 avg {trends.adherence.last2Avg != null ? `${Math.round(trends.adherence.last2Avg)}%` : '—'} · last 4 avg {trends.adherence.last4Avg != null ? `${Math.round(trends.adherence.last4Avg)}%` : '—'}</p>
          )}
          <p>Last check-in {formatDaysAgo(trends.checkins.lastSubmittedAt) ?? '—'}</p>
        </div>
      </Card>

      {/* 4) Admin blockers */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-[13px] font-medium mb-3" style={{ color: colors.muted }}>Admin blockers</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]" style={{ color: colors.text }}>
          <span>Pending reviews: <strong>{workload.pendingReviews}</strong></span>
          <span>Overdue payment: <strong>{workload.overduePayment ? 'Yes' : 'No'}</strong></span>
          <span>Unread messages: <strong>{workload.unreadThreads}</strong></span>
          <span>Peak week due today: <strong>{workload.peakWeekDueToday ? 'Yes' : 'No'}</strong></span>
        </div>
      </Card>

      {/* 5) Actions */}
      <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>Actions</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={async () => { await impactLight(); openMessagesWithPrefill(getCheckinNudgeTemplate(client.phase)); }}
          className="flex items-center gap-3 w-full text-left rounded-xl border-none py-3 px-4 active:opacity-90"
          style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <MessageSquare size={20} style={{ color: colors.accent }} />
          <span className="text-[15px] font-medium">Send check-in nudge</span>
        </button>
        <button
          type="button"
          onClick={handlePaymentReminder}
          className="flex items-center gap-3 w-full text-left rounded-xl border-none py-3 px-4 active:opacity-90"
          style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <CreditCard size={20} style={{ color: colors.accent }} />
          <span className="text-[15px] font-medium">Send payment reminder</span>
        </button>
        {client.compProfile && (
          <button
            type="button"
            onClick={async () => { await impactLight(); openMessagesWithPrefill(getTemplate('posing_request')); }}
            className="flex items-center gap-3 w-full text-left rounded-xl border-none py-3 px-4 active:opacity-90"
            style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            <Camera size={20} style={{ color: colors.accent }} />
            <span className="text-[15px] font-medium">Request posing updates</span>
          </button>
        )}
        <button
          type="button"
          onClick={async () => { await impactLight(); toast.info('Schedule call – date picker coming soon.'); }}
          className="flex items-center gap-3 w-full text-left rounded-xl border-none py-3 px-4 active:opacity-90"
          style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <Calendar size={20} style={{ color: colors.accent }} />
          <span className="text-[15px] font-medium">Schedule call</span>
        </button>
        {retention && (
          <button
            type="button"
            onClick={handleMarkMonitored}
            className="flex items-center gap-3 w-full text-left rounded-xl border-none py-3 px-4 active:opacity-90"
            style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            <CheckCircle size={20} style={{ color: colors.accent }} />
            <span className="text-[15px] font-medium">Mark as monitored</span>
          </button>
        )}
        <button
          type="button"
          onClick={async () => { await impactLight(); navigate(`/clients/${clientId}/review-center`); }}
          className="flex items-center gap-3 w-full text-left rounded-xl border-none py-3 px-4 active:opacity-90"
          style={{ background: colors.card, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <ClipboardList size={20} style={{ color: colors.accent }} />
          <span className="text-[15px] font-medium">Open Review Center</span>
        </button>
      </div>
    </div>
  );
}
