import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { colors, shell } from '@/ui/tokens';

export default function TopBar({ title, onBack, rightAction, showBack = true }) {
  // When rendered inside AppShell, tell the shell to hide its own chrome header
  // so this page-owned TopBar doesn't stack a second header on mobile. Outside
  // the shell (auth/onboarding/marketing) the context is absent and this no-ops.
  const outletContext = useOutletContext();
  const setChromeHeaderHidden = outletContext?.setChromeHeaderHidden;
  React.useEffect(() => {
    if (typeof setChromeHeaderHidden !== 'function') return undefined;
    setChromeHeaderHidden(true);
    return () => setChromeHeaderHidden(false);
  }, [setChromeHeaderHidden]);

  return (
    <header
      className="flex items-center justify-center relative flex-shrink-0"
      style={{
        height: `calc(${shell.headerHeight}px + env(safe-area-inset-top, 0px))`,
        minHeight: shell.headerHeight,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingLeft: shell.pagePaddingH,
        paddingRight: shell.pagePaddingH,
        background: colors.bg,
      }}
    >
      <div className="flex items-center justify-between w-full max-w-full" style={{ height: shell.headerHeight, minHeight: shell.headerHeight }}>
        <div className="flex items-center" style={{ minWidth: 88, minHeight: 44 }}>
          {showBack && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center rounded-lg active:opacity-80"
              style={{ minWidth: 44, minHeight: 44, color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <span style={{ width: 44, height: 44 }} aria-hidden />
          )}
        </div>
        <h1 className="atlas-header-title absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold truncate max-w-[50%]" style={{ color: colors.text }}>
          {title}
        </h1>
        <div className="flex items-center justify-end" style={{ minWidth: 88, minHeight: 44 }}>
          {rightAction != null ? rightAction : <span className="w-10" aria-hidden />}
        </div>
      </div>
    </header>
  );
}

export const HEADER_HEIGHT = shell.headerHeight;
