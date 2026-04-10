/**
 * Personal: choose Basic (free) vs Enhanced (£14.99) before the onboarding question flow.
 * Persists `profiles.personal_plan_tier` then routes to `/personal-onboarding-flow`.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase } from '@/lib/supabaseClient';
import { isProfileOnboardingComplete, hasPersonalPlanTierSelected } from '@/lib/onboardingStatus';
import { normalizeRole } from '@/lib/roles';
import { getPostOnboardingPath, PERSONAL_ONBOARDING_TIER_SESSION_KEY } from '@/lib/postOnboardingRoutes';
import { PERSONAL_ENHANCED_PRICE_DISPLAY } from '@/config/plans';
import { usePresentationMode } from '@/lib/presentationMode';
import { impactLight } from '@/lib/haptics';
import { colors, touchTargetMin } from '@/ui/tokens';
import Button from '@/ui/Button';
import { ChevronLeft, Layers, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { derivePersonalOnboardingTierSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';

export default function PersonalOnboardingTierPage() {
  const navigate = useNavigate();
  const { authReady, supabaseUser, user, profile, updateProfile, signOut, isDemoMode } = useAuth();
  const { isWideWeb } = usePresentationMode();
  const userId = supabaseUser?.id ?? user?.id ?? null;
  const [tierSaving, setTierSaving] = useState(false);

  const isPersonal =
    normalizeRole(profile?.role) === 'personal' ||
    normalizeRole(user?.role) === 'personal' ||
    normalizeRole(user?.user_type) === 'personal';

  useEffect(() => {
    if (!authReady) return;
    if (!userId && !isDemoMode) return;
    if (profile && isProfileOnboardingComplete(profile)) {
      navigate(getPostOnboardingPath('personal'), { replace: true });
      return;
    }
    if (profile && hasPersonalPlanTierSelected(profile)) {
      navigate('/personal-onboarding-flow', { replace: true });
    }
  }, [authReady, userId, profile, navigate, isDemoMode]);

  const persistTierChoice = useCallback(
    async (tier) => {
      setTierSaving(true);
      try {
        try {
          window.sessionStorage?.setItem(PERSONAL_ONBOARDING_TIER_SESSION_KEY, tier);
        } catch (_) {
          /* ignore */
        }
        if (hasSupabase && userId) {
          const res = await updateProfile({ personal_plan_tier: tier });
          if (res?.error) {
            toast.error(res.error?.message || 'Could not save tier');
            return false;
          }
        }
        impactLight();
        navigate('/personal-onboarding-flow', { replace: true });
        return true;
      } finally {
        setTierSaving(false);
      }
    },
    [updateProfile, userId, navigate]
  );

  if (!authReady || (!userId && !isDemoMode)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 className="animate-spin" size={28} style={{ color: colors.primary }} />
      </div>
    );
  }

  if (!isPersonal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: colors.bg, color: colors.text }}>
        <p className="text-sm text-center" style={{ color: colors.muted }}>
          This step is for Personal accounts.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => navigate(getPostOnboardingPath('personal'), { replace: true })}>
          Go home
        </Button>
      </div>
    );
  }

  const containerClass = isWideWeb ? 'max-w-5xl mx-auto px-8' : 'max-w-md mx-auto px-4';

  const tierMigration = derivePersonalOnboardingTierSurfaceState({ saving: tierSaving });

  return (
    <PersonalSurface>
      <div
        className="min-h-screen max-w-full overflow-x-hidden pb-10"
        style={{ color: colors.text }}
        {...atlasMigrationDataAttributes(tierMigration.phase, tierMigration.primary)}
      >
        <div className={`${containerClass} w-full pt-4`}>
          <button
            type="button"
            onClick={() => {
              impactLight();
              if (signOut) void signOut();
              else navigate('/login', { replace: true });
            }}
            className="flex items-center gap-1 text-sm mb-4"
            style={{ color: colors.muted, background: 'none', border: 'none', minHeight: touchTargetMin }}
          >
            <ChevronLeft size={18} /> Use a different account
          </button>

          <div
            className="flex items-center justify-center rounded-2xl mb-4 mx-auto"
            style={{ width: 52, height: 52, background: colors.surface1, border: `1px solid ${colors.border}` }}
          >
            <Layers size={24} style={{ color: colors.primary }} />
          </div>
          <h1
            className={`font-semibold mb-1 text-center ${isWideWeb ? 'text-2xl' : 'text-[22px]'}`}
            style={{ color: colors.text }}
          >
            Choose your Personal plan
          </h1>
          <p
            className={`mb-6 text-center ${isWideWeb ? 'text-[15px] max-w-xl mx-auto' : 'text-[14px]'}`}
            style={{ color: colors.muted }}
          >
            Pick before setup starts. You can change this later from settings if your product allows it.
          </p>

          <div className={isWideWeb ? 'grid grid-cols-2 gap-6 mb-6' : 'flex flex-col gap-4 mb-6'}>
            {(isWideWeb ? ['basic', 'enhanced'] : ['enhanced', 'basic']).map((tier) => {
              const isEnhancedCard = tier === 'enhanced';
              const title = isEnhancedCard ? `Enhanced (${PERSONAL_ENHANCED_PRICE_DISPLAY})` : 'Basic (Free)';
              const tag = isEnhancedCard ? 'Guided setup' : 'Manual tracking';
              const description = isEnhancedCard
                ? 'Structured training and nutrition with smarter insights.'
                : 'Simple logging and manual control — no generated starter plan.';
              const bullets = isEnhancedCard
                ? ['Guided setup', 'Structured training + nutrition', 'Smarter insights']
                : ['Manual tracking', 'Simple logging', 'No generated plans'];
              const cta = isEnhancedCard ? 'Start with Enhanced' : 'Start with Basic';
              return (
                <motion.button
                  key={tier}
                  type="button"
                  disabled={tierSaving}
                  onClick={() => {
                    impactLight();
                    persistTierChoice(tier);
                  }}
                  whileTap={{ scale: 0.98 }}
                  whileHover={isWideWeb ? { y: -4 } : undefined}
                  animate={
                    isEnhancedCard
                      ? { boxShadow: ['0 0 0 rgba(37,99,235,0.0)', '0 0 18px rgba(37,99,235,0.24)', '0 0 0 rgba(37,99,235,0.0)'] }
                      : undefined
                  }
                  transition={isEnhancedCard ? { duration: 1.8, repeat: Infinity, repeatType: 'mirror' } : { duration: 0.16 }}
                  className="text-left rounded-2xl p-6 transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                  style={{
                    minHeight: touchTargetMin * 2.8,
                    background: isEnhancedCard ? 'linear-gradient(180deg, rgba(37,99,235,0.12) 0%, rgba(15,23,42,1) 100%)' : '#0F172A',
                    border: isEnhancedCard ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isEnhancedCard ? '0 10px 30px rgba(37,99,235,0.16)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[22px] leading-tight font-bold" style={{ color: colors.text }}>
                      {title}
                    </p>
                    {isEnhancedCard ? (
                      <span
                        className="text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                        style={{ color: '#BFDBFE', background: 'rgba(37,99,235,0.22)', border: '1px solid rgba(59,130,246,0.45)' }}
                      >
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="text-[11px] mt-2 font-bold uppercase tracking-wider"
                    style={{ color: isEnhancedCard ? '#93C5FD' : 'rgba(255,255,255,0.72)' }}
                  >
                    {tag}
                  </p>
                  <p className="text-[14px] mt-3 leading-snug" style={{ color: colors.text }}>
                    {description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {bullets.map((line) => (
                      <li key={line} className="text-[13px]" style={{ color: 'rgba(255,255,255,0.82)' }}>
                        {`• ${line}`}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="mt-5 w-full rounded-xl px-4 py-3 text-center text-[14px] font-semibold"
                    style={{
                      minHeight: touchTargetMin,
                      border: isEnhancedCard ? '1px solid rgba(96,165,250,0.6)' : '1px solid rgba(255,255,255,0.22)',
                      background: isEnhancedCard ? 'rgba(37,99,235,0.22)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                    }}
                  >
                    {tierSaving ? 'Saving…' : cta}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <p className="text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Basic stays manual-first. Enhanced adds a starter plan and suggested macro targets.
          </p>
        </div>
      </div>
    </PersonalSurface>
  );
}
