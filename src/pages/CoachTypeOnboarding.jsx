/**
 * Coach focus onboarding: required when role === trainer and coach_focus is null/empty.
 * Coaching Focus (Transformation / Competition / Integrated) – premium selection cards.
 * Saves coach_focus only to Supabase profiles (and local cache when no Supabase). No boot loop: on save failure show retry UI.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { setCoachProfile } from '@/lib/data/coachProfileRepo';
import { COACH_FOCUS_OPTIONS, coachFocusToCoachType } from '@/lib/data/coachTypeHelpers';
import { impactLight } from '@/lib/haptics';
import Button from '@/ui/Button';
import { colors, spacing, radii } from '@/ui/tokens';

export default function CoachTypeOnboarding() {
  const navigate = useNavigate();
  const { user, isDemoMode, setCoachType, updateProfile, hasSupabase, supabaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedFocus, setSelectedFocus] = useState(null);

  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;

  const handleSelect = useCallback(
    async (focus) => {
      if (!trainerId || saving) return;
      setSelectedFocus(focus);
      setSaving(true);
      setSaveError(null);
      try {
        const useSupabase = hasSupabase && supabaseUser?.id;
        if (useSupabase) {
          const result = await updateProfile({ coach_focus: focus });
          if (result?.error) {
            setSaveError(result.error.message || 'Could not save. Check your connection and try again.');
            setSaving(false);
            return;
          }
        } else {
          setCoachProfile(trainerId, { coach_focus: focus });
        }
        if (typeof setCoachType === 'function') setCoachType(coachFocusToCoachType(focus));
        if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(10);
        navigate(useSupabase ? '/coach-onboarding' : '/setup', { replace: true });
      } catch (err) {
        setSaveError(err?.message || 'Something went wrong. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [trainerId, saving, navigate, setCoachType, updateProfile, hasSupabase, supabaseUser]
  );

  if (!trainerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden flex flex-col"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
        Choose your coaching focus
      </h1>
      <p className="text-[15px] mb-8" style={{ color: colors.muted }}>
        This shapes your default client view, check-in templates, and which tools we show.
      </p>

      <div className="flex flex-col gap-2">
        {COACH_FOCUS_OPTIONS.map((opt) => {
          const selected = selectedFocus === opt.focus;
          return (
            <button
              key={opt.focus}
              type="button"
              disabled={saving}
              onClick={() => { impactLight(); handleSelect(opt.focus); }}
              aria-label={opt.label}
              aria-pressed={selected}
              className="flex items-start gap-3 rounded-xl text-left transition-all duration-200 ease-out border outline-none disabled:opacity-60"
              style={{
                padding: spacing[16],
                background: selected ? colors.primarySubtle : colors.surface1,
                borderColor: selected ? colors.primary : colors.border,
                borderWidth: 1,
                borderRadius: radii.sm,
              }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 border transition-colors duration-200"
                style={{
                  borderColor: selected ? colors.primary : colors.border,
                  background: selected ? colors.primary : 'transparent',
                }}
              >
                {selected && <Check size={14} strokeWidth={2.5} style={{ color: '#fff' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[15px] mb-0.5" style={{ color: selected ? colors.accent : colors.text }}>
                  {opt.label}
                </p>
                <p className="text-[13px]" style={{ color: colors.muted }}>
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {saveError && (
        <div
          className="mt-6 p-4 rounded-xl"
          style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}
        >
          <p className="text-sm mb-3" style={{ color: colors.text }}>{saveError}</p>
          <Button
            variant="primary"
            onClick={() => setSaveError(null)}
            style={{ width: '100%' }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

