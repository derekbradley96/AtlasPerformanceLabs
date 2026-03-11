import React from 'react';
import { colors, spacing } from '@/ui/tokens';

const CARD_BG = '#111827';
const CARD_BORDER = 'rgba(255,255,255,0.06)';
const RADIUS = 20;

/** Risk badge colors: urgent = red, warning = amber, admin = blue. Legacy keys kept for compatibility. */
export const INBOX_BADGE_TONES = {
  urgent: { bg: 'rgba(239,68,68,0.2)', color: '#EF4444' },
  warning: { bg: 'rgba(234,179,8,0.2)', color: '#EAB308' },
  admin: { bg: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
  danger: { bg: 'rgba(239,68,68,0.2)', color: '#EF4444' },
  info: { bg: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
  accent: { bg: 'rgba(100,116,139,0.25)', color: '#94A3B8' },
  lead: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
};

/**
 * Inbox card row: 76–88px target height, avatar 44x44, title 16 semibold, subtitle 14 muted,
 * age 12 muted, CTA 34–38px, badge pill. Reusable across Inbox and previews.
 */
export default function InboxRowCard({
  avatar,
  title,
  subtitle,
  why,
  badgeLabel,
  badgeTone = 'accent',
  priorityBadge,
  ageLabel,
  ctaLabel,
  onCta,
  onCardTap,
  pinned,
  compact = false,
  style = {},
}) {
  const tone = INBOX_BADGE_TONES[badgeTone] || INBOX_BADGE_TONES.accent;
  const handleClick = (e) => {
    if (e.target.closest('button')) return;
    onCardTap?.();
  };

  return (
    <div
      role={onCardTap ? 'button' : undefined}
      tabIndex={onCardTap ? 0 : undefined}
      onClick={onCardTap ? handleClick : undefined}
      onKeyDown={onCardTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') onCardTap(); } : undefined}
      className="min-w-0 flex items-center gap-3 active:opacity-90"
      style={{
        minHeight: compact ? 56 : 82,
        padding: compact ? spacing[12] : spacing[14],
        paddingLeft: compact ? spacing[12] : spacing[16],
        paddingRight: compact ? spacing[12] : spacing[16],
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: RADIUS,
        borderLeft: pinned ? `3px solid ${colors.accent}` : undefined,
        cursor: onCardTap ? 'pointer' : undefined,
        ...style,
      }}
    >
      <div
        className="flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden text-[13px] font-semibold"
        style={{
          width: 44,
          height: 44,
          background: tone.bg,
          color: tone.color,
        }}
      >
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[16px] font-semibold truncate" style={{ color: colors.text }}>
            {title}
          </p>
          {badgeLabel && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0"
              style={{ background: tone.bg, color: tone.color }}
            >
              {badgeLabel}
            </span>
          )}
          {priorityBadge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 opacity-90"
              style={{ background: 'rgba(255,255,255,0.12)', color: colors.muted }}
            >
              {priorityBadge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[14px] truncate mt-0.5" style={{ color: colors.muted }}>
            {subtitle}
          </p>
        )}
        {why && (
          <p className="text-[12px] truncate mt-0.5" style={{ color: colors.muted, opacity: 0.9 }}>
            {why}
          </p>
        )}
        {ageLabel && !compact && (
          <p className="text-[12px] mt-0.5" style={{ color: colors.muted }}>
            {ageLabel}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {ageLabel && compact && (
          <span className="text-[12px]" style={{ color: colors.muted }}>{ageLabel}</span>
        )}
        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCta(); }}
            className="rounded-lg px-3 font-medium text-[14px]"
            style={{
              minHeight: 36,
              background: colors.accent,
              color: '#fff',
              border: 'none',
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
