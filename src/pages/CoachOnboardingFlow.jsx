/**
 * Beta coach onboarding flow: Welcome → Choose type → Set focus → Add client → Create program → Explore dashboard.
 * Stores coach_focus and onboarding_complete in public.profiles when Supabase is available.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { setCoachProfile } from '@/lib/data/coachProfileRepo';
import { COACH_FOCUS_OPTIONS, coachFocusToCoachType, coachFocusLabel } from '@/lib/data/coachTypeHelpers';
import { impactLight } from '@/lib/haptics';
import { colors, spacing } from '@/ui/tokens';
import Button from '@/ui/Button';
import {
  Sparkles,
  Target,
  UserPlus,
  FileText,
  LayoutDashboard,
  ChevronRight,
  CheckCircle,
  Loader2,
} from 'lucide-react';

const TOTAL_STEPS = 6;

export default function CoachOnboardingFlow() {
  const navigate = useNavigate();
  const {
    user,
    isDemoMode,
    updateProfile,
    setCoachType,
    hasSupabase,
    supabaseUser,
    profile,
  } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedFocus, setSelectedFocus] = useState(() => profile?.coach_focus || null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;

  const handleFocusSelect = useCallback((focus) => {
    impactLight();
    setSelectedFocus(focus);
  }, []);

  const handleSaveFocusAndNext = useCallback(
    async () => {
      if (!trainerId || !selectedFocus || saving) return;
      setSaving(true);
      setSaveError(null);
      try {
        if (hasSupabase && supabaseUser?.id) {
          const result = await updateProfile({ coach_focus: selectedFocus });
          if (result?.error) {
            setSaveError(result.error?.message || 'Could not save. Try again.');
            setSaving(false);
            return;
          }
        } else {
          setCoachProfile(trainerId, { coach_focus: selectedFocus });
        }
        if (typeof setCoachType === 'function') setCoachType(coachFocusToCoachType(selectedFocus));
        impactLight();
        setStep((s) => s + 1);
      } catch (err) {
        setSaveError(err?.message || 'Something went wrong.');
      } finally {
        setSaving(false);
      }
    },
    [trainerId, selectedFocus, saving, updateProfile, setCoachType, hasSupabase, supabaseUser]
  );

  const handleFinish = useCallback(async () => {
    if (!trainerId) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (hasSupabase && supabaseUser?.id) {
        const result = await updateProfile({ onboarding_complete: true });
        if (result?.error) {
          setSaveError(result.error?.message || 'Could not save.');
          setSaving(false);
          return;
        }
      } else {
        setCoachProfile(trainerId, { onboardingComplete: true, onboardingSkipped: false });
      }
      impactLight();
      navigate('/home', { replace: true });
    } catch (err) {
      setSaveError(err?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }, [trainerId, hasSupabase, supabaseUser, updateProfile, navigate]);

  const handleNext = useCallback(() => {
    impactLight();
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    impactLight();
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  if (!trainerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 size={32} className="animate-spin" style={{ color: colors.primary }} />
      </div>
    );
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden flex flex-col"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${spacing[24]}px)`,
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${spacing[24]}px)`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      <div style={{ marginBottom: spacing[24] }}>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: colors.primary, transition: 'width 0.2s ease' }} />
        </div>
        <p className="text-[13px] mt-2" style={{ color: colors.muted }}>
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>

      {saveError && (
        <p className="text-sm mb-4" style={{ color: colors.danger }}>
          {saveError}
        </p>
      )}

      {/* Step 1: Welcome */}
      {step === 1 && (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <Sparkles size={28} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>
            Welcome to Atlas
          </h1>
          <p className="text-[15px] mb-8 leading-relaxed" style={{ color: colors.muted }}>
            A few quick steps to set up your coaching space. You can change these later.
          </p>
          <Button variant="primary" onClick={handleNext} style={{ width: '100%' }}>
            Get started <ChevronRight size={18} className="inline ml-1" />
          </Button>
        </>
      )}

      {/* Step 2: Choose coach type */}
      {step === 2 && (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <Target size={28} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>
            Choose your coach type
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            This shapes your default tools and client experience.
          </p>
          <div className="flex flex-col gap-3 mb-6">
            {COACH_FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.focus}
                type="button"
                onClick={() => handleFocusSelect(opt.focus)}
                className="text-left rounded-xl border p-4 transition-all"
                style={{
                  background: selectedFocus === opt.focus ? colors.primarySubtle : colors.surface1,
                  borderColor: selectedFocus === opt.focus ? colors.primary : colors.border,
                }}
              >
                <span className="font-medium block" style={{ color: colors.text }}>{opt.label}</span>
                <span className="text-sm" style={{ color: colors.muted }}>{opt.description}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleBack} style={{ flex: 1 }}>Back</Button>
            <Button variant="primary" onClick={handleSaveFocusAndNext} disabled={!selectedFocus || saving} style={{ flex: 1 }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : 'Next'}
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Set coaching focus (confirmation) */}
      {step === 3 && (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <Target size={28} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>
            Coaching focus set
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            You’re set as <strong style={{ color: colors.text }}>{selectedFocus ? coachFocusLabel(selectedFocus) : 'Coach'}</strong>. You can change this later in settings.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleBack} style={{ flex: 1 }}>Back</Button>
            <Button variant="primary" onClick={handleNext} style={{ flex: 1 }}>Next <ChevronRight size={18} className="inline ml-1" /></Button>
          </div>
        </>
      )}

      {/* Step 4: Add first client */}
      {step === 4 && (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <UserPlus size={28} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>
            Add your first client
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            Invite a client via link or add them manually. You can do this now or skip and come back later.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleBack} style={{ flex: 1 }}>Back</Button>
            <Button variant="secondary" onClick={() => { impactLight(); navigate('/inviteclient'); }} style={{ flex: 1 }}>Add client</Button>
            <Button variant="primary" onClick={handleNext} style={{ flex: 1 }}>Next</Button>
          </div>
        </>
      )}

      {/* Step 5: Create first program */}
      {step === 5 && (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <FileText size={28} style={{ color: colors.primary }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>
            Create your first program
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            Build a training block in Program Builder and assign it to clients. Optional for now.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleBack} style={{ flex: 1 }}>Back</Button>
            <Button variant="secondary" onClick={() => { impactLight(); navigate('/program-builder'); }} style={{ flex: 1 }}>Create program</Button>
            <Button variant="primary" onClick={handleNext} style={{ flex: 1 }}>Next</Button>
          </div>
        </>
      )}

      {/* Step 6: Explore dashboard */}
      {step === 6 && (
        <>
          <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 64, height: 64, background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <CheckCircle size={28} style={{ color: colors.success }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ color: colors.text }}>
            Explore your dashboard
          </h1>
          <p className="text-[15px] mb-8" style={{ color: colors.muted }}>
            You’re all set. Head to Home to see your clients, check-ins, and programs.
          </p>
          <Button
            variant="primary"
            onClick={handleFinish}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? <Loader2 size={18} className="animate-spin inline mr-2" /> : <LayoutDashboard size={18} className="inline mr-2" />}
            Go to dashboard
          </Button>
          <Button variant="secondary" onClick={handleBack} style={{ width: '100%', marginTop: 12 }}>
            Back
          </Button>
        </>
      )}

      {step > 1 && step < 6 && (
        <button
          type="button"
          onClick={() => { impactLight(); navigate('/home', { replace: true }); }}
          className="text-sm mt-8"
          style={{ color: colors.muted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
