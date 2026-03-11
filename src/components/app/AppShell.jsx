import React, { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';
import TabBar from './TabBar';
import { useEdgeSwipeBack } from './useEdgeSwipeBack';

const HEADER_OFFSET = 56;
const TAB_BAR_OFFSET = 76;

export default function AppShell() {
  const contentRef = useRef(null);
  useEdgeSwipeBack(contentRef);

  return (
    <div
      className="flex flex-col w-full max-w-full min-w-0 h-full"
      style={{
        background: '#0B1220',
        color: '#E5E7EB',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      <AppHeader />
      <main
        ref={contentRef}
        className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${HEADER_OFFSET}px)`,
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${TAB_BAR_OFFSET}px)`,
          paddingLeft: 16,
          paddingRight: 16,
          background: '#0B1220',
        }}
      >
        <div className="min-h-full min-w-0 max-w-full">
          <Outlet />
        </div>
      </main>
      <TabBar />
    </div>
  );
}
