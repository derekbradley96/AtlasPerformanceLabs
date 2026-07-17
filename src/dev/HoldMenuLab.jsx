import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Pin, PinOff, Trash2, MailOpen } from 'lucide-react';
import '@/index.css';
import { colors } from '@/ui/tokens';
import HoldMenu from '@/components/ui/HoldMenu';
import ThreadRow from '@/components/messages/ThreadRow';

/**
 * Dev-only harness: renders the real ThreadRow + HoldMenu with fake data so the
 * messages list can be looked at without a Supabase session. Not routed, not
 * imported by the app — served directly by vite at /dev/holdmenu.html.
 */
const SEED = [
  { id: '1', name: 'Jan Bradley', lastMessage: 'Ffs', timeLabel: '52m', unreadCount: 2, isPinned: true },
  { id: '2', name: 'Connor', lastMessage: 'Liked a message', timeLabel: '7h', unreadCount: 0 },
  { id: '3', name: 'Kenny Wall', lastMessage: 'Sent a post by unclaimedarchive', timeLabel: '15h', unreadCount: 0 },
  { id: '4', name: 'Emma Davies', lastMessage: 'Can we move Thursday to Friday please?', timeLabel: '1d', unreadCount: 12 },
  { id: '5', name: 'Marcus Hill', lastMessage: 'No messages yet', timeLabel: '', unreadCount: 0 },
];

function Lab() {
  const [rows, setRows] = useState(SEED);
  const [log, setLog] = useState('—');

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', padding: '16px 16px 40px' }}>
      <p style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }} id="lab-log">
        last action: {log}
      </p>
      {rows.map((r) => (
        <HoldMenu
          key={r.id}
          label={r.name}
          liftBackground={colors.surface1}
          radius={16}
          onPress={() => setLog(`open ${r.name}`)}
          items={[
            {
              key: 'pin',
              label: r.isPinned ? 'Unpin' : 'Pin',
              icon: r.isPinned ? PinOff : Pin,
              onSelect: () => {
                setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, isPinned: !x.isPinned } : x)));
                setLog(`pin ${r.name}`);
              },
            },
            ...(r.unreadCount > 0 ? [{
              key: 'read',
              label: 'Mark as read',
              icon: MailOpen,
              onSelect: () => {
                setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, unreadCount: 0 } : x)));
                setLog(`read ${r.name}`);
              },
            }] : []),
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onSelect: () => setLog(`delete ${r.name}`),
            },
          ]}
        >
          <div className="atlas-thread-row" style={{ borderRadius: 16, cursor: 'pointer' }}>
            <ThreadRow
              name={r.name}
              lastMessage={r.lastMessage}
              timeLabel={r.timeLabel}
              unreadCount={r.unreadCount}
              isPinned={r.isPinned}
            />
          </div>
        </HoldMenu>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Lab />);
