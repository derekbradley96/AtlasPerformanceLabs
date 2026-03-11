import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, AlertTriangle, ClipboardList, Calendar, RefreshCw, Check, ChevronRight, Settings2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getCapacitySnapshot } from '@/lib/capacity/capacityService';
import { getTrainerCapacity, setTrainerCapacity } from '@/lib/trainerFoundation';
import Card from '@/ui/Card';
import { SkeletonCard } from '@/ui/Skeleton';
import { colors, spacing } from '@/ui/tokens';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { impactLight } from '@/lib/haptics';

const STATUS_COLORS = { IN_CONTROL: '#22C55E', BUSY: '#F59E0B', OVERLOADED: '#EF4444' };

function formatUpdatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function CapacityDashboard() {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { registerRefresh } = outletContext;
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limitInput, setLimitInput] = useState(() => {
    const cap = getTrainerCapacity(trainerId);
    return String(cap?.dailyAdminLimitMinutes ?? 60);
  });
  const { refresh, lastRefreshed } = useAppRefresh(() => {});

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCapacitySnapshot(trainerId);
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot, lastRefreshed]);


  useEffect(() => {
    if (typeof registerRefresh === 'function') return registerRefresh(loadSnapshot);
  }, [registerRefresh, loadSnapshot]);

  const onRefresh = useCallback(async () => {
    await impactLight();
    await loadSnapshot();
  }, [loadSnapshot]);

  const handleLimitBlur = useCallback(() => {
    const num = parseInt(limitInput, 10);
    if (Number.isFinite(num) && num > 0) {
      setTrainerCapacity(trainerId, { dailyAdminLimitMinutes: num });
      setLimitInput(String(num));
      loadSnapshot();
    } else {
      const cap = getTrainerCapacity(trainerId);
      setLimitInput(String(cap?.dailyAdminLimitMinutes ?? 60));
    }
  }, [limitInput, loadSnapshot, trainerId]);

  const isEmpty = snapshot && snapshot.counts.activeClients === 0;
  const allClear =
    snapshot &&
    snapshot.counts.reviewsActive === 0 &&
    snapshot.counts.peakWeekDueToday === 0 &&
    snapshot.counts.overduePayments === 0 &&
    snapshot.counts.unreadThreads === 0 &&
    snapshot.counts.newLeads === 0 &&
    snapshot.counts.retentionHigh === 0 &&
    snapshot.minutes.total === 0;

  if (loading && !snapshot) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{
          padding: spacing[16],
          paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
          background: colors.bg,
        }}
      >
        <div style={{ height: 28, width: '50%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: spacing[8] }} />
        <div style={{ height: 16, width: '70%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: spacing[16] }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[10], marginBottom: spacing[16] }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className="app-screen min-w-0 max-w-full flex flex-col items-center justify-center"
        style={{
          minHeight: '60vh',
          padding: spacing[24],
          background: colors.bg,
          color: colors.text,
        }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <Users size={32} style={{ color: colors.muted }} />
        </div>
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: colors.text }}>No clients yet</h2>
        <p className="text-[14px] text-center max-w-[280px] mb-6" style={{ color: colors.muted }}>
          Add clients to see capacity and workload here.
        </p>
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="rounded-full px-5 py-2.5 text-[15px] font-medium border-none"
          style={{ background: colors.accent, color: '#fff' }}
        >
          View clients
        </button>
      </div>
    );
  }

  if (allClear) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden flex flex-col items-center justify-center"
        style={{
          minHeight: '60vh',
          padding: spacing[24],
          background: colors.bg,
          color: colors.text,
        }}
      >
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
          <Check size={40} style={{ color: colors.success }} />
        </div>
        <h2 className="text-[20px] font-semibold mb-2" style={{ color: colors.text }}>All clear</h2>
        <p className="text-[14px] text-center max-w-[280px] mb-6" style={{ color: colors.muted }}>
          No reviews, payments, or messages due. Focus on proactive check-ins.
        </p>
        <p className="text-xs" style={{ color: colors.muted }}>Updated {formatUpdatedAt(snapshot?.updatedAt)}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-2 mt-4 text-[13px] font-medium border-none bg-transparent"
          style={{ color: colors.accent }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
    );
  }

  const c = snapshot?.counts ?? {};
  const m = snapshot?.minutes ?? {};
  const statusColor = STATUS_COLORS[snapshot?.status] ?? STATUS_COLORS.IN_CONTROL;
  const limit = snapshot?.dailyLimitMinutes ?? 60;
  const progressPct = limit > 0 ? Math.min(100, (m.total / limit) * 100) : 0;
  const clientsNeedingAttention = (c.atRiskClients ?? 0) + (c.retentionHigh ?? 0) + (c.peakWeekDueToday ?? 0);

  const breakdown = [
    { label: 'Check-ins', count: c.checkinsActive, min: m.checkins, minEach: 6 },
    { label: 'Posing', count: c.posingActive, min: m.posing, minEach: 4 },
    { label: 'Peak week', count: c.peakWeekDueToday, min: m.peakWeek, minEach: 2 },
    { label: 'Payments', count: c.overduePayments, min: m.payments, minEach: 2 },
    { label: 'Messages', count: c.unreadThreads, min: m.messages, minEach: 2 },
    { label: 'Leads', count: c.newLeads, min: m.leads, minEach: 3 },
  ].filter((r) => r.count > 0);

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        padding: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
        background: colors.bg,
        color: colors.text,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[22px] font-semibold" style={{ color: colors.text }}>
          Capacity
        </h1>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-2 text-[13px] font-medium border-none bg-transparent"
          style={{ color: colors.accent }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Today
      </p>

      {/* 2x2 tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[10], marginBottom: spacing[16] }}>
        <Card style={{ padding: spacing[14] }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.2)' }}>
              <Users size={18} style={{ color: '#3B82F6' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: colors.muted }}>Active clients</p>
              <p className="text-[18px] font-semibold tabular-nums" style={{ color: colors.text }}>{c.activeClients ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card style={{ padding: spacing[14] }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}>
              <AlertTriangle size={18} style={{ color: '#EF4444' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: colors.muted }}>At-risk</p>
              <p className="text-[18px] font-semibold tabular-nums" style={{ color: colors.text }}>{c.atRiskClients ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card style={{ padding: spacing[14] }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.2)' }}>
              <ClipboardList size={18} style={{ color: '#EAB308' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: colors.muted }}>Reviews active</p>
              <p className="text-[18px] font-semibold tabular-nums" style={{ color: colors.text }}>{c.reviewsActive ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card style={{ padding: spacing[14] }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
              <Calendar size={18} style={{ color: '#8B5CF6' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: colors.muted }}>Peak week due today</p>
              <p className="text-[18px] font-semibold tabular-nums" style={{ color: colors.text }}>{c.peakWeekDueToday ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Workload card */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>
          Estimated admin time today
        </p>
        <p className="text-[24px] font-bold mb-3 tabular-nums" style={{ color: colors.text }}>
          ~{m.total ?? 0} min
        </p>
        {breakdown.length > 0 && (
          <div className="space-y-2 mb-4">
            {breakdown.map(({ label, count, min, minEach }) => (
              <div key={label} className="flex justify-between text-[13px] min-w-0" style={{ color: colors.text }}>
                <span className="truncate">{label}</span>
                <span className="flex-shrink-0 ml-2" style={{ color: colors.muted }}>{count} × {minEach} min</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 min-w-0 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, progressPct)}%`,
                background: progressPct > 100 ? statusColor : colors.accent,
              }}
            />
          </div>
          <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>{m.total ?? 0} / {limit}</span>
        </div>
        <p className="text-[11px]" style={{ color: colors.muted }}>vs daily limit</p>
      </Card>

      {/* Risk load card */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[16], borderLeft: `4px solid ${statusColor}` }}>
        <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>Risk load</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] mb-3" style={{ color: colors.text }}>
          <span>Retention high: <strong>{c.retentionHigh ?? 0}</strong></span>
          <span>Overdue payments: <strong>{c.overduePayments ?? 0}</strong></span>
        </div>
        <p className="text-[13px] mb-3" style={{ color: colors.text }}>
          Clients needing attention: <strong>{clientsNeedingAttention}</strong>
        </p>
        <p className="text-[13px] mb-3" style={{ color: colors.muted }}>
          {snapshot?.guidance}
        </p>
        <button
          type="button"
          onClick={async () => {
            await impactLight();
            navigate('/global-review?tab=active&filter=all');
          }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[14px] font-medium border-none"
          style={{ background: colors.accent, color: '#fff' }}
        >
          Open Global Review <ChevronRight size={18} />
        </button>
      </Card>

      {/* Daily admin limit setting */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <div className="flex items-center gap-2 mb-2">
          <Settings2 size={16} style={{ color: colors.muted }} />
          <p className="text-[13px] font-medium" style={{ color: colors.muted }}>Daily admin limit</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={480}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            onBlur={handleLimitBlur}
            className="w-20 rounded-lg border text-[15px] font-medium tabular-nums text-right"
            style={{
              padding: spacing[8],
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          />
          <span className="text-[13px]" style={{ color: colors.muted }}>minutes</span>
        </div>
      </Card>

      <p className="text-xs text-center" style={{ color: colors.muted }}>
        Updated {formatUpdatedAt(snapshot?.updatedAt)}
      </p>
    </div>
  );
}
