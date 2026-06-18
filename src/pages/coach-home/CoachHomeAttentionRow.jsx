import React from 'react';
import {
  ChevronRight,
  User,
  MessageSquare,
  Send,
  SearchCheck,
} from 'lucide-react';
import { colors } from '@/ui/tokens';
import { getReengagementTemplate, sendReengagementNudge } from '@/lib/reengagementTemplates';
import { navigateToThread } from '@/lib/messagesPath';
import { reasonLabel } from '@/pages/coach-home/loadCoachHomeDashboardData';

/** Format last_checkin_at for display (relative or short date). */
export function formatLastCheckin(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/** Risk level badge style (high / medium / low). */
export function riskBadgeStyle(riskLevel) {
  const r = (riskLevel || '').toLowerCase();
  if (r === 'high') return { bg: 'rgba(239,68,68,0.2)', color: colors.danger };
  if (r === 'medium') return { bg: colors.warningSubtle, color: colors.warning };
  return { bg: colors.surface2, color: colors.muted };
}

/** Single row in Needs Attention queue (shared flat list + integrated prep/lifestyle split). */
export function CoachHomeAttentionRow({
  item,
  navigate,
  onOpenAttention,
  attentionReasons,
  formatLastCheckin: formatLc,
  riskBadgeStyle: riskStyleFn,
  hapticLight,
  toast,
}) {
  const reasons = attentionReasons(item);
  const topReasons = reasons.slice(0, 3).map(reasonLabel).join(' · ');
  const riskStyle = riskStyleFn(item.risk_level);
  const lastCheckin = formatLc(item.last_checkin_at);
  const isAdaptive = Array.isArray(reasons) && reasons.includes('adaptive_recommendation');
  const adaptiveType = item.recommendation_type ? String(item.recommendation_type).replaceAll('_', ' ') : null;
  const adaptiveSeverity = item.adaptive_severity ? String(item.adaptive_severity).toLowerCase() : null;
  const adaptiveSummary = item.adaptive_reason_summary || null;
  return (
    <li style={{ borderBottom: `1px solid ${colors.border}` }}>
      <div className="py-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>{item.client_name || 'Client'}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {item.risk_level && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium capitalize"
                  style={{ background: riskStyle.bg, color: riskStyle.color }}
                >
                  {item.risk_level}
                </span>
              )}
              {lastCheckin && (
                <span className="text-[11px]" style={{ color: colors.muted }}>Last check-in: {lastCheckin}</span>
              )}
            </div>
            {topReasons && (
              <p className="text-xs truncate text-left mt-0.5" style={{ color: colors.muted }}>{topReasons}</p>
            )}
            {isAdaptive && (
              <>
                <p className="text-xs text-left mt-1" style={{ color: colors.text }}>
                  <span style={{ fontWeight: 600 }}>Type:</span> {adaptiveType || 'adaptive recommendation'}
                  {adaptiveSeverity ? (
                    <span style={{ marginLeft: 8 }}>
                      <span style={{ fontWeight: 600 }}>Severity:</span> {adaptiveSeverity}
                    </span>
                  ) : null}
                </p>
                {adaptiveSummary && (
                  <p className="text-xs text-left mt-0.5" style={{ color: colors.muted }}>
                    {adaptiveSummary}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenAttention(item.client_id)}
            className="shrink-0 p-1.5 rounded-lg active:opacity-80"
            style={{ background: 'transparent', color: colors.muted }}
            aria-label="Open client"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            onClick={() => { hapticLight(); navigate(`/clients/${item.client_id}`); }}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
          >
            <User size={14} /> Open Client
          </button>
          <button
            type="button"
            onClick={() => { hapticLight(); navigateToThread(navigate, item.client_id); }}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
          >
            <MessageSquare size={14} /> Message
          </button>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              const template = getReengagementTemplate(attentionReasons(item));
              sendReengagementNudge({ clientId: item.client_id, template, navigate, toast });
            }}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
          >
            <Send size={14} /> Send Nudge
          </button>
          <button
            type="button"
            onClick={() => { hapticLight(); navigate('/review-center'); }}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
            style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
          >
            <SearchCheck size={14} /> {isAdaptive ? 'Review Recommendation' : 'Review'}
          </button>
        </div>
      </div>
    </li>
  );
}
