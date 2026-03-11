import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import Button from '@/ui/Button';
import { colors } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { roleHomePath } from '@/lib/roles';

/**
 * Shown when user hits a route they don't have permission for (e.g. client/solo on trainer-only).
 * No crash; clear message and way back. Redirect matches EntryRoute (client→/messages, solo→/home).
 * Optional secondaryAction: { label, path } e.g. { label: 'Find a Coach', path: '/discover' } for personal upgrade path.
 */
export default function AccessDenied({ message = "You don't have access to this area.", title = 'Access denied', secondaryAction }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const dashboardPath = role ? roleHomePath(role) : '/home';
  return (
    <div
      className="app-screen flex flex-col items-center justify-center min-h-[60vh] px-6"
      style={{ background: colors.bg, color: colors.text }}
    >
      <div className="flex flex-col items-center max-w-sm text-center">
        <div
          className="rounded-full flex items-center justify-center mb-4"
          style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.15)' }}
        >
          <ShieldOff size={32} style={{ color: '#EF4444' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>{title}</h1>
        <p className="text-sm mb-6" style={{ color: colors.muted }}>{message}</p>
        <div className="flex flex-col gap-3 w-full max-w-[240px]">
          <Button variant="primary" onClick={() => navigate(dashboardPath)}>
            Back to Dashboard
          </Button>
          {secondaryAction?.label && secondaryAction?.path && (
            <Button variant="secondary" onClick={() => navigate(secondaryAction.path)}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
