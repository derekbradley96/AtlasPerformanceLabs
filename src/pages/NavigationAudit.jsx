import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ROUTE_TABLE, DEV_ONLY_PATHS, getDashboardPathForRole } from '@/lib/routeInventory';
import { ChevronLeft } from 'lucide-react';

const BG = '#0B1220';
const CARD = '#111827';
const TEXT = '#E5E5E7';
const MUTED = 'rgba(229,231,235,0.65)';
const RED = '#EF4444';
const GREEN = '#22C55E';
const AMBER = '#F59E0B';

export default function NavigationAudit() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isDev = import.meta.env.DEV;

  if (!isDev) {
    navigate('/', { replace: true });
    return null;
  }

  const dashboardPath = getDashboardPathForRole(role);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        paddingTop: 'max(24px, env(safe-area-inset-top, 0))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0))',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 44,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            color: MUTED,
            fontSize: 15,
          }}
        >
          <ChevronLeft size={20} /> Back
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>Navigation Audit</h1>
        <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
          Every route, role access, and forbidden/missing highlights. Current role: <strong>{role || 'none'}</strong>. Dashboard: <code>{dashboardPath}</code>.
        </p>

        <div style={{ overflow: 'hidden', borderRadius: 14, background: CARD }}>
          {ROUTE_TABLE.map((row) => {
            const isDevOnly = DEV_ONLY_PATHS.includes(row.path);
            const forbidden = role && row.roles !== 'public' && row.roles !== 'any' && row.roles !== role;
            return (
              <div
                key={row.path}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  background: forbidden ? 'rgba(239,68,68,0.08)' : undefined,
                }}
              >
                <code style={{ fontSize: 13, color: forbidden ? RED : TEXT, flex: '1 1 200px', wordBreak: 'break-all' }}>
                  {row.path}
                </code>
                <span style={{ fontSize: 12, color: MUTED, flex: '0 0 auto' }}>{row.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: row.roles === 'public' ? 'rgba(255,255,255,0.06)' : row.roles === 'any' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                    color: row.roles === 'public' ? MUTED : row.roles === 'any' ? GREEN : AMBER,
                  }}
                >
                  {row.roles}
                </span>
                {isDevOnly && (
                  <span style={{ fontSize: 10, color: MUTED }}>DEV</span>
                )}
                {forbidden && (
                  <span style={{ fontSize: 11, color: RED, fontWeight: 600 }}>Forbidden for current role</span>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>
          Red row = route forbidden for current role. Missing routes (referenced in app but not in this table) should be added to App.jsx and optionally to routeInventory.js.
        </p>
      </div>
    </div>
  );
}
