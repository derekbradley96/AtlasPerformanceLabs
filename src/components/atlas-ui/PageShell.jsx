import React from 'react';
import { usePresentationMode } from '@/lib/presentationMode';
import {
  getAppShellOutletScrollPaddingBottom,
  getStandaloneScrollablePagePaddingBottom,
  layout,
  pageContainer,
} from '@/ui/pageLayout';

/**
 * Scroll-safe page wrapper: website shell gets max-width + desktop gutters; app shell stays full width.
 * @param {{
 *   children: React.ReactNode,
 *   variant?: 'default'|'marketing'|'compact',
 *   maxWidth?: number,
 *   showTabBar?: boolean,
 *   bottomPadding?: string|number,
 *   noHorizontalPadding?: boolean,
 *   noTopPadding?: boolean,
 *   style?: React.CSSProperties,
 * }} props
 */
export function PageShell({
  children,
  variant = 'default',
  maxWidth,
  showTabBar,
  bottomPadding,
  noHorizontalPadding = false,
  noTopPadding = false,
  style,
}) {
  const { shellMode } = usePresentationMode();
  const website = shellMode === 'desktop_web';
  const mw =
    maxWidth ??
    (variant === 'marketing'
      ? layout.widths.marketing
      : variant === 'compact'
        ? layout.widths.compact
        : layout.widths.dashboard);
  const padH = website ? layout.pagePadding.desktop : layout.pagePadding.mobile;
  const bottom =
    bottomPadding ??
    (typeof showTabBar === 'boolean'
      ? getAppShellOutletScrollPaddingBottom(showTabBar)
      : getStandaloneScrollablePagePaddingBottom());

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: website ? mw : undefined,
        boxSizing: 'border-box',
        paddingLeft: noHorizontalPadding ? 0 : padH,
        paddingRight: noHorizontalPadding ? 0 : padH,
        paddingTop: noTopPadding ? 0 : pageContainer.paddingTop,
        paddingBottom: bottom,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default PageShell;
