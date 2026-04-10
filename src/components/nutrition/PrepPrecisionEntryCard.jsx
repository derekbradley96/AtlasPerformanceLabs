import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crosshair, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal as isPersonalRoleFn } from '@/lib/roles';
import { resolvePersonalPlanTier } from '@/config/plans';
import { resolvePrepPrecisionAccess } from '@/lib/prepPrecisionAccess';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

/**
 * Gated link into Prep Precision Mode — never shown for transformation-only contexts.
 */
export default function PrepPrecisionEntryCard() {
  const navigate = useNavigate();
  const {
    effectiveRole,
    resolvedAccess,
    coachFocus,
    clientLinkedRow,
    clientLinkedResolved,
    user,
    profile,
  } = useAuth();

  const isPersonal = isPersonalRoleFn(effectiveRole);
  const personalPlanTier = isPersonal ? resolvePersonalPlanTier(profile, user) : null;

  const { data: personalGoal } = useQuery({
    queryKey: ['personal-primary-goal', user?.id],
    enabled: Boolean(isPersonal && user?.id && hasSupabase),
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return null;
      const { data, error } = await sb.from('personal').select('primary_goal').eq('user_id', user.id).maybeSingle();
      if (error && !/primary_goal|schema cache|PGRST204/i.test(String(error.message || ''))) throw new Error(error.message);
      return data?.primary_goal ?? null;
    },
  });

  const { tier } = resolvePrepPrecisionAccess({
    role: effectiveRole,
    resolvedAccess,
    coachFocus,
    clientRowForCoach: null,
    personalPrimaryGoal: personalGoal,
    personalPlanTier,
    clientLinkedResolved,
  });

  if (tier === 'hidden') return null;

  const href = '/prep-precision';

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
        padding: 0,
      }}
    >
      <Card
        style={{
          padding: spacing[16],
          border: `1px solid ${colors.primary}44`,
          background: colors.primarySubtle ?? colors.surface1,
          display: 'flex',
          alignItems: 'center',
          gap: spacing[12],
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${colors.primary}22`,
            color: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Crosshair size={20} strokeWidth={2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Prep precision
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: colors.text, lineHeight: 1.35 }}>
            {tier === 'light'
              ? 'Water, sodium, timing, and day-type structure for prep — separate from your daily macro budget.'
              : 'Sodium, water, timing, day types, and peak-week overrides — coach-set structure, separate from standard nutrition.'}
          </p>
        </div>
        <ChevronRight size={20} style={{ color: colors.muted, flexShrink: 0 }} />
      </Card>
    </button>
  );
}
