/**
 * Beta onboarding checklist for new coaches. Shown on Coach Home until all items are complete.
 * Completion is derived from real data (profile, clients, programs, check-ins) where possible.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/data/useData';
import { VALID_COACH_FOCUS } from '@/lib/coachFocus';
import { hasSupabase } from '@/lib/supabaseClient';
import { hasReviewedAnyCheckin } from '@/lib/sandboxStore';
import { colors, spacing } from '@/ui/tokens';
import { Check, Circle, Target, UserPlus, FileText, Link2, MessageSquare } from 'lucide-react';
import { impactLight } from '@/lib/haptics';

const ITEMS = [
  {
    key: 'coach_focus',
    label: 'Choose coach focus',
    path: '/account',
    icon: Target,
  },
  {
    key: 'first_client',
    label: 'Add or import first client',
    path: '/clients',
    icon: UserPlus,
  },
  {
    key: 'first_program',
    label: 'Create first program',
    path: '/program-builder',
    icon: FileText,
  },
  {
    key: 'first_assignment',
    label: 'Assign first program',
    path: '/program-assignments',
    icon: Link2,
  },
  {
    key: 'first_review',
    label: 'Review first check-in',
    path: '/review-center',
    icon: MessageSquare,
  },
];

export default function CoachOnboardingChecklist() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const data = useData();
  const trainerId = user?.id ?? 'local-trainer';

  const [clients, setClients] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  const coachFocusSet = useMemo(() => {
    const focus = (profile?.coach_focus ?? '').toString().trim().toLowerCase();
    return focus && VALID_COACH_FOCUS.includes(focus);
  }, [profile?.coach_focus]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      data.listClients().catch(() => []),
      data.listPrograms().catch(() => []),
      data.listCheckInsForTrainer().catch(() => []),
    ]).then(([clientList, programList, checkInList]) => {
      if (!cancelled) {
        setClients(Array.isArray(clientList) ? clientList : []);
        setPrograms(Array.isArray(programList) ? programList : []);
        setCheckIns(Array.isArray(checkInList) ? checkInList : []);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [data]);

  const hasClient = clients.length >= 1;
  const hasProgram = programs.length >= 1;
  const hasAssignment = useMemo(() => {
    return programs.some((p) => p && (p.client_id || (p.client_id != null && p.client_id !== '')));
  }, [programs]);
  const hasReviewedCheckin = useMemo(() => {
    if (hasSupabase && trainerId && trainerId !== 'local-trainer') {
      return checkIns.some((c) => c && (c.reviewed_at || c.reviewed_by));
    }
    return hasReviewedAnyCheckin();
  }, [checkIns, trainerId]);

  const completion = useMemo(
    () => ({
      coach_focus: coachFocusSet,
      first_client: hasClient,
      first_program: hasProgram,
      first_assignment: hasAssignment,
      first_review: hasReviewedCheckin,
    }),
    [coachFocusSet, hasClient, hasProgram, hasAssignment, hasReviewedCheckin]
  );

  const allComplete = Object.values(completion).every(Boolean);
  const completedCount = Object.values(completion).filter(Boolean).length;

  const handleItemPress = (item) => {
    impactLight();
    if (item.path) navigate(item.path);
  };

  if (loading || allComplete) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden border min-w-0"
      style={{
        background: colors.card,
        borderColor: colors.border,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
          Get started
        </span>
        <span className="text-xs font-medium tabular-nums" style={{ color: colors.text }}>
          {completedCount}/{ITEMS.length}
        </span>
      </div>
      <ul className="divide-y divide-opacity-10" style={{ borderColor: colors.border }}>
        {ITEMS.map((item) => {
          const done = completion[item.key];
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => handleItemPress(item)}
                className="w-full flex items-center gap-3 text-left active:opacity-90 min-w-0"
                style={{
                  minHeight: 48,
                  padding: spacing[12],
                  paddingLeft: spacing[16],
                  paddingRight: spacing[16],
                  background: 'transparent',
                  border: 'none',
                  color: colors.text,
                }}
              >
                <div
                  className="flex-shrink-0 rounded-full flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    background: done ? colors.primarySubtle : colors.surface2,
                    color: done ? colors.primary : colors.muted,
                  }}
                >
                  {done ? <Check size={16} strokeWidth={2.5} /> : <Icon size={14} style={{ color: colors.muted }} />}
                </div>
                <span
                  className="flex-1 min-w-0 text-[14px] font-medium"
                  style={{
                    color: done ? colors.muted : colors.text,
                    textDecoration: done ? 'none' : 'none',
                  }}
                >
                  {item.label}
                </span>
                {!done && item.path && (
                  <Circle size={14} className="flex-shrink-0" style={{ color: colors.muted }} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
