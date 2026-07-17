import React from 'react';
import { Pin } from 'lucide-react';
import { colors } from '@/ui/tokens';
import Img from '@/components/ui/Img';

/**
 * One conversation in the messages list. Presentational only — the press and
 * hold behaviour belongs to whatever wraps it (see components/ui/HoldMenu).
 *
 * Rows are flat rather than carded: a continuous surface reads as one list,
 * which is the modern messaging idiom (and leaves the lifted card look to mean
 * "you're holding this row").
 */
export default function ThreadRow({
  name,
  avatarUrl,
  lastMessage,
  timeLabel,
  unreadCount = 0,
  isPinned = false,
  padY = 10,
  padX = 6,
}) {
  const unread = unreadCount > 0;
  return (
    <div
      className="flex items-center gap-3 w-full text-left"
      style={{
        paddingTop: padY,
        paddingBottom: padY,
        paddingLeft: padX,
        paddingRight: padX,
        minHeight: 72,
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <Img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          fallback={(
            <div
              className="w-full h-full flex items-center justify-center text-[16px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.08)', color: colors.muted }}
            >
              {(name || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="truncate"
            style={{ fontSize: 16, fontWeight: unread ? 700 : 600, color: colors.text }}
          >
            {name}
          </span>
          {isPinned && <Pin size={12} style={{ color: colors.muted, flexShrink: 0 }} aria-label="Pinned" />}
          {timeLabel ? (
            <span
              style={{
                marginLeft: 'auto',
                paddingLeft: 8,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: unread ? 600 : 400,
                color: unread ? colors.primary : colors.muted,
              }}
            >
              {timeLabel}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 min-w-0" style={{ marginTop: 3 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.35,
              color: unread ? colors.text : colors.muted,
              fontWeight: unread ? 500 : 400,
            }}
          >
            {lastMessage}
          </p>
          {unread && (
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                marginLeft: 'auto',
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                background: colors.primary,
                color: '#fff',
              }}
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
