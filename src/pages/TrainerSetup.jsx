import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { impactLight } from '@/lib/haptics';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import {
  getTrainerProfile,
  setTrainerProfile,
  setOnboardingComplete,
  getTrainerServices,
  setTrainerServices,
  getTrainerPolicies,
  setTrainerPolicies,
  getTrainerSchedule,
  setTrainerSchedule,
  getTrainerCapacity,
  setTrainerCapacity,
} from '@/lib/trainerFoundation';

const FOCUS_OPTIONS = [
  { value: 'general', label: 'General fitness' },
  { value: 'bodybuilding', label: 'Bodybuilding' },
  { value: 'strength', label: 'Strength' },
  { value: 'weightloss', label: 'Weight loss' },
  { value: 'sport', label: 'Sport performance' },
  { value: 'other', label: 'Other' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TrainerSetup() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? '';

  const [step, setStep] = useState(1);
  const [focusType, setFocusType] = useState(() => {
    const p = trainerId ? getTrainerProfile(trainerId) : null;
    return (p?.focusType ?? 'general');
  });
  const [services, setServicesState] = useState(() => {
    const s = trainerId ? getTrainerServices(trainerId) : { services: [] };
    return s.services.length ? s.services : [{ id: 's1', name: '1:1 Coaching', durationMinutes: 60, enabled: true }];
  });
  const [policies, setPoliciesState] = useState(() => {
    const p = trainerId ? getTrainerPolicies(trainerId) : null;
    return {
      cancellationHours: p?.cancellationHours ?? 24,
      latePolicy: p?.latePolicy ?? '',
      paymentTerms: p?.paymentTerms ?? '',
    };
  });
  const [schedule, setScheduleState] = useState(() => {
    const s = trainerId ? getTrainerSchedule(trainerId) : { windows: [] };
    if (s.windows?.length) return s.windows;
    return DAY_LABELS.map((_, i) => ({
      dayOfWeek: i,
      start: '09:00',
      end: '17:00',
    }));
  });
  const [capacity, setCapacityState] = useState(() => {
    const c = trainerId ? getTrainerCapacity(trainerId) : null;
    return {
      maxClients: c?.maxClients ?? 20,
      dailyAdminLimitMinutes: c?.dailyAdminLimitMinutes ?? 60,
    };
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const handleFocusSelect = useCallback((value) => {
    impactLight();
    setFocusType(value);
  }, []);

  const handleNext = useCallback(() => {
    impactLight();
    if (step < totalSteps) {
      if (step === 1) {
        setTrainerProfile(trainerId, { user_id: user?.id ?? trainerId, focusType });
      } else if (step === 2) {
        setTrainerServices(trainerId, services);
      } else if (step === 3) {
        setTrainerPolicies(trainerId, policies);
      } else if (step === 4) {
        setTrainerSchedule(trainerId, { windows: schedule });
      } else if (step === 5) {
        setTrainerCapacity(trainerId, capacity);
        setOnboardingComplete(trainerId);
        navigate('/home', { replace: true });
        return;
      }
      setStep((s) => s + 1);
    }
  }, [step, trainerId, user?.id, focusType, services, policies, schedule, capacity, navigate]);

  const handleBack = useCallback(() => {
    impactLight();
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const addService = useCallback(() => {
    impactLight();
    setServicesState((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, name: '', durationMinutes: 60, enabled: true },
    ]);
  }, []);

  const updateService = useCallback((id, field, value) => {
    setServicesState((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }, []);

  const removeService = useCallback((id) => {
    impactLight();
    setServicesState((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateScheduleDay = useCallback((dayOfWeek, field, value) => {
    setScheduleState((prev) =>
      prev.map((w) => (w.dayOfWeek === dayOfWeek ? { ...w, [field]: value } : w))
    );
  }, []);

  if (!trainerId || (!isDemoMode && user == null)) {
    return (
      <div className="min-h-screen flex flex-col max-w-full overflow-x-hidden" style={{ background: colors.bg, padding: spacing[16] }}>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', marginBottom: spacing[24] }} />
        <div style={{ height: 24, width: '60%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: spacing[12] }} />
        <div style={{ height: 16, width: '80%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: spacing[24] }} />
        <div style={{ height: 48, borderRadius: radii.md, background: 'rgba(255,255,255,0.06)', marginBottom: spacing[12] }} />
        <div style={{ height: 48, borderRadius: radii.md, background: 'rgba(255,255,255,0.06)', marginBottom: spacing[12] }} />
        <div style={{ height: 48, borderRadius: radii.md, background: 'rgba(255,255,255,0.06)' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: spacing[16],
        paddingBottom: spacing[24] + 24,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      {/* Progress */}
      <div style={{ marginBottom: spacing[24] }}>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: colors.accent,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
        <p className="text-[13px] mt-2" style={{ color: colors.muted }}>
          Step {step} of {totalSteps}
        </p>
      </div>

      {/* Step 1: Focus type */}
      {step === 1 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
            What’s your focus?
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            Choose the primary type of coaching you offer.
          </p>
          <div className="space-y-2">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleFocusSelect(opt.value)}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin,
                  paddingLeft: spacing[16],
                  paddingRight: spacing[16],
                  borderRadius: radii.md,
                  border: `1px solid ${focusType === opt.value ? colors.accent : colors.border}`,
                  background: focusType === opt.value ? 'rgba(37,99,235,0.15)' : colors.card,
                  color: colors.text,
                  textAlign: 'left',
                  fontSize: 16,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 2: Services */}
      {step === 2 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
            Services
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            Add the services you offer (e.g. 1:1, group, check-in only).
          </p>
          <div className="space-y-3">
            {services.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: spacing[12],
                  borderRadius: radii.md,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <input
                  type="text"
                  placeholder="Service name"
                  value={s.name}
                  onChange={(e) => updateService(s.id, 'name', e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.text,
                    fontSize: 15,
                  }}
                />
                <input
                  type="number"
                  min={5}
                  max={240}
                  placeholder="min"
                  value={s.durationMinutes ?? ''}
                  onChange={(e) => updateService(s.id, 'durationMinutes', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  style={{
                    width: 56,
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.text,
                    fontSize: 15,
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeService(s.id)}
                  style={{
                    padding: 8,
                    color: colors.muted,
                    background: 'transparent',
                    border: 'none',
                    fontSize: 14,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addService}
              style={{
                width: '100%',
                minHeight: touchTargetMin,
                border: `1px dashed ${colors.border}`,
                borderRadius: radii.md,
                background: 'transparent',
                color: colors.muted,
                fontSize: 15,
              }}
            >
              + Add service
            </button>
          </div>
        </>
      )}

      {/* Step 3: Policies */}
      {step === 3 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
            Policies
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            Set your cancellation and payment terms (optional).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>
                Cancellation notice (hours)
              </label>
              <input
                type="number"
                min={0}
                value={policies.cancellationHours ?? ''}
                onChange={(e) => setPoliciesState((p) => ({ ...p, cancellationHours: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                style={{
                  width: '100%',
                  maxWidth: 120,
                  padding: '12px 14px',
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>
                Late policy (short description)
              </label>
              <input
                type="text"
                placeholder="e.g. Sessions start on time"
                value={policies.latePolicy}
                onChange={(e) => setPoliciesState((p) => ({ ...p, latePolicy: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>
                Payment terms
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly in advance"
                value={policies.paymentTerms}
                onChange={(e) => setPoliciesState((p) => ({ ...p, paymentTerms: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Step 4: Working hours */}
      {step === 4 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
            Working hours
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            When you’re typically available (for capacity planning).
          </p>
          <div className="space-y-2">
            {schedule.map((w) => (
              <div
                key={w.dayOfWeek}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  padding: spacing[12],
                  borderRadius: radii.md,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ width: 36, color: colors.text, fontSize: 14 }}>{DAY_LABELS[w.dayOfWeek]}</span>
                <input
                  type="time"
                  value={w.start}
                  onChange={(e) => updateScheduleDay(w.dayOfWeek, 'start', e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.text,
                    fontSize: 14,
                  }}
                />
                <span style={{ color: colors.muted }}>–</span>
                <input
                  type="time"
                  value={w.end}
                  onChange={(e) => updateScheduleDay(w.dayOfWeek, 'end', e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.text,
                    fontSize: 14,
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Step 5: Capacity */}
      {step === 5 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
            Capacity
          </h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>
            Set your client cap and daily admin time budget.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>
                Max clients
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={capacity.maxClients ?? ''}
                onChange={(e) => setCapacityState((c) => ({ ...c, maxClients: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                style={{
                  width: '100%',
                  maxWidth: 120,
                  padding: '12px 14px',
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>
                Daily admin limit (minutes)
              </label>
              <input
                type="number"
                min={15}
                max={240}
                value={capacity.dailyAdminLimitMinutes ?? ''}
                onChange={(e) => setCapacityState((c) => ({ ...c, dailyAdminLimitMinutes: e.target.value ? parseInt(e.target.value, 10) : 60 }))}
                style={{
                  width: '100%',
                  maxWidth: 120,
                  padding: '12px 14px',
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
              <p className="text-[12px] mt-1" style={{ color: colors.muted }}>
                Used for capacity dashboard and busy/overloaded status.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Footer actions */}
      <div
        style={{
          marginTop: spacing[32],
          display: 'flex',
          gap: 12,
          justifyContent: step > 1 ? 'space-between' : 'flex-end',
        }}
      >
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            style={{
              minHeight: touchTargetMin,
              paddingLeft: spacing[20],
              paddingRight: spacing[20],
              borderRadius: radii.md,
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.text,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          style={{
            minHeight: touchTargetMin,
            paddingLeft: spacing[24],
            paddingRight: spacing[24],
            borderRadius: radii.md,
            border: 'none',
            background: colors.accent,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            marginLeft: step === 1 ? 'auto' : 0,
          }}
        >
          {step === totalSteps ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}
