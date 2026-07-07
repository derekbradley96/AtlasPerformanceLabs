/**
 * Role picker for signed-in users who have never chosen an account type —
 * i.e. Google/Apple sign-ins that skipped the signup form (the DB trigger
 * defaults them to 'personal', which must never be assumed silently).
 * Picking a role writes user_metadata (the durable "explicitly chosen" marker)
 * plus profiles.role, then routes into that role's onboarding flow.
 */
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Dumbbell, Users, User, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseClient';
import { getPersonalOnboardingEntryPath } from '@/lib/onboardingStatus';
import { CANONICAL_COACH_ONBOARDING_PATH } from '@/lib/coachOnboardingRoutes';
import { impactLight } from '@/lib/haptics';
import AtlasLogo from '@/components/Brand/AtlasLogo';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

const ROLES = [
  {
    key: 'coach',
    title: "I'm a coach",
    subtitle: 'Manage clients, programmes, check-ins and payments',
    icon: Dumbbell,
  },
  {
    key: 'client',
    title: 'I have a coach',
    subtitle: "You'll connect with your coach's invite code next",
    icon: Users,
  },
  {
    key: 'personal',
    title: 'Training on my own',
    subtitle: 'Programmes, nutrition and progress tracking — free',
    icon: User,
  },
];

export default function OnboardingRole() {
  const navigate = useNavigate();
  const { isDemoMode, supabaseUser, profile } = useAuth();
  const [savingRole, setSavingRole] = useState(null);

  if (isDemoMode) return <Navigate to="/home" replace />;

  const handleSelect = async (roleKey) => {
    if (savingRole) return;
    impactLight();
    setSavingRole(roleKey);
    try {
      const supabase = getSupabase();
      if (!supabase || !supabaseUser?.id) throw new Error('Not signed in');

      // user_metadata first — it's the marker that stops the role picker re-appearing.
      const { error: metaError } = await supabase.auth.updateUser({ data: { role: roleKey } });
      if (metaError) throw metaError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: roleKey })
        .eq('id', supabaseUser.id);
      if (profileError) throw profileError;

      let destination;
      if (roleKey === 'coach') {
        destination = CANONICAL_COACH_ONBOARDING_PATH;
      } else if (roleKey === 'client') {
        destination = '/client-onboarding-flow';
      } else {
        destination = getPersonalOnboardingEntryPath(profile);
      }
      // Full navigation (not SPA navigate) so AuthContext re-derives role/routes from the fresh profile.
      window.location.assign(destination);
    } catch (error) {
      toast.error(error?.message || 'Could not save your choice — try again');
      setSavingRole(null);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background: colors.bg,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <AtlasLogo variant="auth" />
        <h1 className="text-xl font-bold text-center mb-1" style={{ color: colors.text }}>
          How will you use Atlas?
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
          Pick the one that fits — this sets up the right experience for you.
        </p>

        <div className="flex flex-col gap-3">
          {ROLES.map(({ key, title, subtitle, icon: Icon }) => (
            <Card key={key} style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                disabled={!!savingRole}
                onClick={() => handleSelect(key)}
                className="w-full flex items-center gap-4 text-left disabled:opacity-60"
                style={{
                  minHeight: touchTargetMin,
                  padding: spacing[16],
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.lg,
                    background: 'rgba(59,130,246,0.16)',
                  }}
                >
                  <Icon size={22} style={{ color: colors.primary }} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold m-0" style={{ color: colors.text }}>{title}</p>
                  <p className="text-xs m-0 mt-0.5" style={{ color: colors.muted }}>{subtitle}</p>
                </div>
                {savingRole === key ? (
                  <div
                    className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: colors.primary }}
                  />
                ) : (
                  <ChevronRight size={20} className="flex-shrink-0" style={{ color: colors.muted }} />
                )}
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
