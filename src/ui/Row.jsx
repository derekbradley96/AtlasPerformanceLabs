import React from 'react';
import { ChevronRight } from 'lucide-react';
import { colors, spacing, touchTargetMin, rowHeight, shell } from './tokens';

/**
 * iOS-style list row: optional left icon/avatar, title, optional subtitle, optional right badge + chevron.
 * Use as button or div; 68px min height, 16px horizontal padding (shell provides container padding).
 */
function getInitials(name) {
  if (typeof name !== 'string') return '?';
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Row({
  as: _as,
  left,
  avatar,
  title,
  titleRight,
  subtitle,
  rightBadge,
  rightLabel,
  showChevron = true,
  onPress,
  className = '',
  style = {},
  children,
}) {
  const isInteractive = typeof onPress === 'function';
  const handleKeyDown = (e) => {
    if (!isInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPress(e);
    }
  };

  const content = (
    <>
      {avatar != null && (
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            width: shell.listRowAvatarSize ?? 44,
            height: shell.listRowAvatarSize ?? 44,
            background: 'rgba(255,255,255,0.12)',
            color: colors.text,
          }}
        >
          {typeof avatar === 'string' ? getInitials(avatar) : avatar}
        </div>
      )}
      {left != null && !avatar && <div className="flex-shrink-0">{left}</div>}
      <div className="flex-1 min-w-0 text-left">
        {(title != null || titleRight != null) && (
          <div className="flex items-center justify-between gap-2">
            {title != null && (
              <p className="text-[15px] font-medium truncate flex-1 min-w-0" style={{ color: colors.text }}>
                {title}
              </p>
            )}
            {titleRight != null && (
              <span className="text-xs flex-shrink-0" style={{ color: colors.muted }}>
                {titleRight}
              </span>
            )}
          </div>
        )}
        {subtitle != null && (
          <p className="text-xs truncate mt-0.5" style={{ color: colors.muted }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {(rightBadge != null || rightLabel != null || showChevron) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {rightBadge != null && (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: colors.accent, color: colors.bg }}
            >
              {rightBadge > 99 ? '99+' : rightBadge}
            </span>
          )}
          {rightLabel}
          {showChevron && <ChevronRight size={18} style={{ color: colors.muted }} />}
        </div>
      )}
    </>
  );

  const sharedStyle = {
    width: '100%',
    minHeight: rowHeight,
    height: rowHeight,
    display: 'flex',
    alignItems: 'center',
    gap: shell.listRowGap ?? spacing[12],
    paddingLeft: shell.listRowPaddingH ?? spacing[16],
    paddingRight: shell.listRowPaddingH ?? spacing[16],
    border: 'none',
    borderBottom: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    textAlign: 'left',
    cursor: isInteractive ? 'pointer' : undefined,
    WebkitTapHighlightColor: 'transparent',
    ...style,
  };

  // Root is always a div to avoid validateDOMNesting (no <button> inside <button>).
  // Inner action controls (e.g. health pill) remain real <button> elements.
  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onPress}
      onKeyDown={handleKeyDown}
      className={`last:border-b-0 ${isInteractive ? 'active:opacity-90' : ''} ${className}`}
      style={sharedStyle}
    >
      {content}
    </div>
  );
}
