/**
 * Coach Action Dock: icons only, styled to match Home TabBar.
 * Message → client messages; Call / Video → Call Prep sheet; Check-in → focus Check-ins tab.
 */
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Phone, Video, ClipboardList } from 'lucide-react';
import { colors } from '@/ui/tokens';

const TAB_BAR_HEIGHT = 76;

const actions = [
  { key: 'message', label: 'Message', icon: MessageSquare },
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'requestCheckin', label: 'Check-ins', icon: ClipboardList },
];

export const CLIENT_ACTION_BAR_TOTAL_HEIGHT = `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

export default function ClientActionBar({
  clientId,
  segment,
  onOpenCallPrep,
  onFocusCheckins,
  unreadCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAction = (key) => {
    if (key === 'message' && clientId) {
      navigate(`/messages/${clientId}`, { state: { from: location.pathname } });
      return;
    }
    if (key === 'requestCheckin' && typeof onFocusCheckins === 'function') {
      onFocusCheckins();
      return;
    }
    if ((key === 'call' || key === 'video') && typeof onOpenCallPrep === 'function') {
      onOpenCallPrep(key);
      return;
    }
  };

  return (
    <nav
      role="toolbar"
      aria-label="Coach quick actions"
      className="fixed left-0 right-0 z-40 grid grid-cols-4 flex-shrink-0 border-t"
      style={{
        bottom: 0,
        height: CLIENT_ACTION_BAR_TOTAL_HEIGHT,
        paddingTop: 12,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
        background: colors.bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: colors.border,
      }}
    >
      {actions.map(({ key, label, icon: Icon }) => {
        const isActive = key === 'requestCheckin' && segment === 'checkins';
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            onClick={() => handleAction(key)}
            className="flex flex-col items-center justify-center transition-colors active:opacity-80 relative"
            style={{
              minHeight: 44,
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: isActive ? colors.primary : colors.muted,
            }}
          >
            <span className="relative inline-flex flex-shrink-0">
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? colors.primary : colors.muted }} />
              {key === 'message' && unreadCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: colors.danger, color: '#fff' }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
