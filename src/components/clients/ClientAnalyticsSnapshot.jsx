/**
 * Compact Analytics Snapshot card for Client Detail.
 * Data from public.v_client_progress_metrics. Actions: View Progress, Review Check-ins, Adjust Program.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ClipboardList, ListChecks } from 'lucide-react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

function formatWeightChange(change) {
  if (change == null || Number.isNaN(Number(change))) return '—';
  const n = Number(change);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)} kg`;
}

export default function ClientAnalyticsSnapshot({
  metrics,
  loading,
  clientId,
  onViewProgress,
  onReviewCheckins,
  onAdjustProgram,
}) {
  const navigate = useNavigate();
  const handleViewProgress = () => {
    if (clientId) navigate(`/clients/${clientId}/progress`);
    onViewProgress?.();
  };
  const handleReviewCheckins = () => {
    if (clientId) navigate('/review-center/queue');
    onReviewCheckins?.();
  };
  const handleAdjustProgram = () => {
    if (typeof onAdjustProgram === 'function') onAdjustProgram();
    else if (clientId) navigate(`/program-builder?clientId=${clientId}&source=client_detail`);
  };

  if (loading) {
    return (
      <Card style={{ padding: spacing[16], marginBottom: spacing[20] }}>
        <p className="text-sm font-medium" style={{ color: colors.muted, marginBottom: spacing[12] }}>Analytics Snapshot</p>
        <div className="animate-pulse flex flex-wrap gap-4">
          <div style={{ width: 72, height: 32, background: colors.surface2, borderRadius: 6 }} />
          <div style={{ width: 72, height: 32, background: colors.surface2, borderRadius: 6 }} />
          <div style={{ width: 72, height: 32, background: colors.surface2, borderRadius: 6 }} />
          <div style={{ width: 72, height: 32, background: colors.surface2, borderRadius: 6 }} />
        </div>
      </Card>
    );
  }

  const weight = metrics?.latest_weight != null ? `${Number(metrics.latest_weight)} kg` : '—';
  const weightChange = formatWeightChange(metrics?.weight_change);
  const compliance = metrics?.avg_compliance_last_4w != null ? `${Math.round(Number(metrics.avg_compliance_last_4w))}%` : '—';
  const flags = metrics?.active_flags_count != null ? Number(metrics.active_flags_count) : 0;
  const phase = metrics?.latest_phase_type ? String(metrics.latest_phase_type) : '—';
  const phaseWeek = metrics?.current_phase_week != null ? `Week ${metrics.current_phase_week}` : '';
  const hasPrep = metrics?.has_active_prep === true;
  const daysOut = metrics?.days_out != null ? Number(metrics.days_out) : null;

  return (
    <Card style={{ padding: spacing[16], marginBottom: spacing[20] }}>
      <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: colors.muted, marginBottom: spacing[12] }}>
        Analytics Snapshot
      </p>
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"
        style={{ marginBottom: spacing[16] }}
      >
        <div>
          <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Latest weight</p>
          <p style={{ color: colors.text }}>{weight}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Weight change</p>
          <p style={{ color: colors.text }}>{weightChange}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Avg compliance (4w)</p>
          <p style={{ color: colors.text }}>{compliance}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Active flags</p>
          <p style={{ color: colors.text }}>{flags}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Phase</p>
          <p style={{ color: colors.text }}>{phase}{phaseWeek ? ` · ${phaseWeek}` : ''}</p>
        </div>
        {hasPrep && daysOut != null && (
          <div>
            <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Days out</p>
            <p style={{ color: colors.text }}>{daysOut} days</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handleViewProgress} className="inline-flex items-center gap-1.5">
          <TrendingUp size={14} /> View Progress
        </Button>
        <Button variant="secondary" size="sm" onClick={handleReviewCheckins} className="inline-flex items-center gap-1.5">
          <ListChecks size={14} /> Review Check-ins
        </Button>
        <Button variant="secondary" size="sm" onClick={handleAdjustProgram} className="inline-flex items-center gap-1.5">
          <ClipboardList size={14} /> Adjust Program
        </Button>
      </div>
    </Card>
  );
}
