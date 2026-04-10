/**
 * Coach onboarding wizard (steps 2–5 of activation): Add client → Create program → Assign program → Finish.
 * Deprecated: routes redirect to /coach-onboarding-flow. Kept for reference only.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getCoachProfile, setCoachProfile } from '@/lib/data/coachProfileRepo';
import { trackFriction } from '@/services/frictionTracker';
import { impactLight } from '@/lib/haptics';
import { colors, spacing } from '@/ui/tokens';
import Button from '@/ui/Button';
import { UserPlus, FileText, Link2, CheckCircle, Store } from 'lucide-react';
import { getPostOnboardingPath } from '@/lib/postOnboardingRoutes';

const ONBOARDING_STEP_OFFSET = 1; // Step 1 = coach focus (separate page). Wizard = steps 2–5.
const DRAFT_VERSION = 1;

function draftKey(trainerId) {
  return `atlas_coach_onboarding_wizard_v${DRAFT_VERSION}:${trainerId}`;
}

const STEPS = [
  {
    id: 'add-client',
    title: 'Add or import a client',
    subtitle: 'Bring your roster into Atlas.',
    description: 'Add clients manually or import from CSV. You need at least one client to assign programs and receive check-ins.',
    icon: UserPlus,
    ctaLabel: 'Add client',
    ctaPath: '/get-clients?onboarding=1',
  },
  {
    id: 'create-program',
    title: 'Create a program',
    subtitle: 'Build your first training block.',
    description: 'Use Program Builder to create blocks, weeks, and days. You can assign this program to clients in the next step.',
    icon: FileText,
    ctaLabel: 'Create program',
    ctaPath: '/program-builder',
  },
  {
    id: 'assign-program',
    title: 'Assign program to a client',
    subtitle: 'Connect your program to a client.',
    description: 'Assign the program you created so your client sees their workouts and can submit check-ins.',
    icon: Link2,
    ctaLabel: 'Assign program',
    ctaPath: '/program-assignments',
  },
  {
    id: 'finish',
    title: "You're set",
    subtitle: 'Start using Atlas.',
    description: 'You can always add more clients, create programs, and manage assignments from Home and Clients.',
    icon: CheckCircle,
    ctaLabel: 'Finish',
    ctaPath: null,
  },
];

const WIZARD_STEP_COUNT = STEPS.length;
const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEP_OFFSET + WIZARD_STEP_COUNT; // 5

export default function CoachOnboardingWizard() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : (user?.id ?? '');

  const [step, setStep] = useState(1);
  useEffect(() => {
    if (!trainerId || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftKey(trainerId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const savedStep = Number(parsed?.step);
      if (Number.isFinite(savedStep) && savedStep >= 1 && savedStep <= WIZARD_STEP_COUNT) {
        setStep(savedStep);
      }
    } catch (_) {}
  }, [trainerId]);

  useEffect(() => {
    if (!trainerId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(draftKey(trainerId), JSON.stringify({ step }));
    } catch (_) {}
  }, [trainerId, step]);

  const current = STEPS[step - 1];
  const stepNumber = ONBOARDING_STEP_OFFSET + step; // 2..5
  const progress = (stepNumber / TOTAL_ONBOARDING_STEPS) * 100;
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    return () => {
      const profile = getCoachProfile(trainerId);
      if (profile && !profile.onboardingComplete && !profile.onboardingSkipped) {
        trackFriction('onboarding_abandoned', { step: stepRef.current, stepId: STEPS[stepRef.current - 1]?.id });
      }
    };
  }, [trainerId]);

  const handleNext = useCallback(() => {
    impactLight();
    if (step < WIZARD_STEP_COUNT) {
      setStep((s) => s + 1);
    } else {
      setCoachProfile(trainerId, {
        ...(getCoachProfile(trainerId) || {}),
        onboardingComplete: true,
        onboardingSkipped: false,
      });
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey(trainerId));
      } catch (_) {}
      navigate(getPostOnboardingPath('coach'), { replace: true });
    }
  }, [step, trainerId, navigate]);

  const isLastStep = step === WIZARD_STEP_COUNT;

  const handleBack = useCallback(() => {
    impactLight();
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const handleCta = useCallback(() => {
    impactLight();
    if (current.ctaPath) {
      navigate(current.ctaPath);
    } else {
      handleNext();
    }
  }, [current, navigate, handleNext]);

  const handleSkip = useCallback(() => {
    impactLight();
    setCoachProfile(trainerId, {
      ...(getCoachProfile(trainerId) || {}),
      onboardingSkipped: true,
    });
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey(trainerId));
    } catch (_) {}
    navigate(getPostOnboardingPath('coach'), { replace: true });
  }, [trainerId, navigate]);

  if (!trainerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
      </div>
    );
  }

  const Icon = current.icon;

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden overflow-y-auto"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: spacing[24],
        paddingBottom: spacing[24] + 80,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      <div style={{ marginBottom: spacing[24] }}>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: colors.primary ?? colors.accent, transition: 'width 0.2s ease' }} />
        </div>
        <p className="text-[13px] mt-2" style={{ color: colors.muted }}>
          Step {stepNumber} of {TOTAL_ONBOARDING_STEPS}
        </p>
      </div>

      <div style={{ marginBottom: spacing[32] }}>
        {Icon && (
          <div
            className="flex items-center justify-center rounded-2xl mb-6"
            style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}
          >
            <Icon size={28} style={{ color: colors.primary ?? colors.accent }} />
          </div>
        )}
        <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
          {current.title}
        </h1>
        <p className="text-[15px] font-medium mb-2" style={{ color: colors.muted }}>
          {current.subtitle}
        </p>
        <p className="text-[15px] leading-relaxed" style={{ color: colors.muted }}>
          {current.description}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {current.ctaPath && (
          <Button variant="secondary" onClick={handleCta} style={{ width: '100%' }}>
            {current.ctaLabel}
          </Button>
        )}
        {current.id === 'finish' && (
          <>
            <p className="text-sm text-center leading-relaxed" style={{ color: colors.muted }}>
              Finish your profile to get in front of the right athletes — optional, but it helps enquiries land faster.
            </p>
            <Button variant="secondary" onClick={() => navigate('/marketplace-setup?quick=1')} style={{ width: '100%' }}>
              Quick profile polish (about 2 minutes)
            </Button>
            <Button variant="secondary" onClick={() => navigate('/marketplace-setup')} style={{ width: '100%' }}>
              <Store size={18} className="mr-2 inline" />
              Full marketplace listing
            </Button>
          </>
        )}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="secondary" onClick={handleBack} style={{ flex: 1 }}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            onClick={current.ctaPath ? handleNext : handleCta}
            style={{ flex: 1 }}
          >
            {!current.ctaPath ? current.ctaLabel : isLastStep ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm"
          style={{ color: colors.muted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
