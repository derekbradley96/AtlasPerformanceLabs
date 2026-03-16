/**
 * Client Detail – Client Health card: lifecycle stage, risk band/score, reasons from v_client_retention_risk.
 * Quick actions: Message Client, Send Nudge, Adjust Program, Add Flag.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { MessageSquare, ClipboardList, Flag, Send } from 'lucide-react';
import { getReengagementTemplate, sendReengagementNudge } from '@/lib/reengagementTemplates';
import { toast } from 'sonner';

const REASON_LABELS = {
  days_since_last_checkin_high: 'Check-in overdue',
  no_workouts_last_7d: 'No workout this week',
  compliance_last_4w_low: 'Compliance trending down',
  days_since_last_message_high: 'No recent message',
  active_flags_present: 'Attention flags',
  billing_overdue: 'Payment overdue',
};

function formatReason(key) {
  return REASON_LABELS[key] || key;
}

function formatLifecycleStage(stage) {
  if (!stage) return '—';
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskBandLabel(band) {
  if (!band) return '—';
  const map = {
    healthy: 'Healthy',
    watch: 'Watch',
    at_risk: 'At risk',
    churn_risk: 'Churn risk',
  };
  return map[band] || band;
}

export default function ClientHealthCard({
  clientId,
  lifecycleStage,
  riskBand,
  riskScore,
  reasons = [],
  loading,
  onMessage,
  onSendNudge,
  onAdjustProgram,
  onAddFlag,
}) {
  const navigate = useNavigate();
  const displayReasons = Array.isArray(reasons) ? reasons.map(formatReason) : [];
  const handleAddFlag = onAddFlag ?? (() => clientId && navigate(`/clients/${clientId}/intervention`));
  const handleSendNudge = onSendNudge ?? (() => {
    const template = getReengagementTemplate(reasons);
    sendReengagementNudge({ clientId, template, navigate, toast });
  });

  if (loading) {
    return (
      <Card style={{ padding: spacing[20] }}>
        <div className="animate-pulse">
          <div className="h-5 rounded bg-white/10 w-1/3 mb-3" />
          <div className="h-8 rounded bg-white/10 w-1/4 mb-4" />
          <div className="h-4 rounded bg-white/10 w-full mb-2" />
          <div className="h-4 rounded bg-white/10 w-2/3" />
        </div>
      </Card>
    );
  }

  return (
    <Card id="client-health" style={{ padding: spacing[20] }}>
      <h3 className="text-[15px] font-semibold" style={{ color: colors.text, marginBottom: spacing[16] }}>
        Client Health
      </h3>
      <div className="grid gap-3" style={{ marginBottom: spacing[16] }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]" style={{ color: colors.muted }}>Lifecycle stage</span>
          <span className="text-[14px] font-medium" style={{ color: colors.text }}>
            {formatLifecycleStage(lifecycleStage)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]" style={{ color: colors.muted }}>Risk band</span>
          <span className="text-[14px] font-medium" style={{ color: colors.text }}>
            {riskBandLabel(riskBand)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]" style={{ color: colors.muted }}>Risk score</span>
          <span className="text-[14px] font-medium tabular-nums" style={{ color: colors.text }}>
            {riskScore != null ? riskScore : '—'}
          </span>
        </div>
      </div>
      {displayReasons.length > 0 && (
        <>
          <p className="text-[12px] font-medium uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Reasons
          </p>
          <ul className="list-none space-y-1" style={{ marginBottom: spacing[16] }}>
            {displayReasons.map((label, i) => (
              <li key={i} className="text-[14px]" style={{ color: colors.text }}>
                ⚠ {label}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {typeof onMessage === 'function' && (
          <Button variant="secondary" size="sm" onClick={onMessage} className="flex items-center gap-1.5">
            <MessageSquare size={16} /> Message Client
          </Button>
        )}
        {clientId && (displayReasons.length > 0 || riskBand === 'at_risk' || riskBand === 'churn_risk') && (
          <Button variant="secondary" size="sm" onClick={handleSendNudge} className="flex items-center gap-1.5">
            <Send size={16} /> Send Nudge
          </Button>
        )}
        {typeof onAdjustProgram === 'function' && (
          <Button variant="secondary" size="sm" onClick={onAdjustProgram} className="flex items-center gap-1.5">
            <ClipboardList size={16} /> Adjust Program
          </Button>
        )}
        {clientId && (
          <Button variant="secondary" size="sm" onClick={handleAddFlag} className="flex items-center gap-1.5">
            <Flag size={16} /> Add Flag
          </Button>
        )}
      </div>
    </Card>
  );
}
