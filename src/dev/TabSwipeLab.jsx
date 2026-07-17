import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { useTabSwipeNavigation } from '@/hooks/useTabSwipeNavigation';

/**
 * Dev-only harness for useTabSwipeNavigation (served at /dev/tabswipe.html,
 * not routed, not bundled). Mounts the real hook on a fake coach tab set so
 * the gesture discriminator can be exercised with synthetic TouchEvents.
 */
const TABS = ['/home', '/clients', '/messages', '/more'];

function Lab() {
  const ref = useRef(null);
  const [active, setActive] = useState('/messages');
  const [log, setLog] = useState('—');

  useTabSwipeNavigation({
    containerRef: ref,
    enabled: true,
    tabPaths: TABS,
    activeKey: active,
    onSwitch: (path, dir) => {
      setActive(path);
      setLog(`switch ${dir} -> ${path}`);
    },
  });

  return (
    <div
      ref={ref}
      id="swipe-area"
      style={{ height: '100vh', background: '#0B1220', color: '#fff', padding: 16, overflowY: 'auto' }}
    >
      <p id="lab-active">active: {active}</p>
      <p id="lab-log">last: {log}</p>
      <input id="lab-input" placeholder="text field" style={{ display: 'block', margin: '12px 0', padding: 8 }} />
      <div
        id="lab-hscroll"
        style={{ overflowX: 'auto', whiteSpace: 'nowrap', border: '1px solid #333', padding: 8 }}
      >
        <div style={{ width: 1200, height: 40 }}>wide horizontally scrollable strip</div>
      </div>
      <div style={{ height: 1400 }}>tall filler so the page scrolls</div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Lab />);
