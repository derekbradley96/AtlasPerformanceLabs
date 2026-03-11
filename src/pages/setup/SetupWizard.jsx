/**
 * 5-step coach onboarding. Runs when coach profile is incomplete.
 * Persists to CoachProfile (coachProfileRepo) and sets onboardingComplete on finish.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAuth } from '@/lib/AuthContext';
import { getCoachProfile, setCoachProfile } from '@/lib/data/coachProfileRepo';
import { impactLight } from '@/lib/haptics';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import Button from '@/ui/Button';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHECKIN_FREQUENCY = [{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }];
const SPECIALTY_OPTIONS = ['Fat loss', 'Hypertrophy', 'Comp prep', 'Strength', 'General fitness', 'Nutrition'];
const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic', desc: 'Core features' },
  { value: 'pro', label: 'Pro', desc: 'Full toolkit' },
  { value: 'elite', label: 'Elite', desc: 'Priority support' },
];

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

export default function SetupWizard() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : (user?.id ?? '');

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [responseTargetHours, setResponseTargetHours] = useState(24);
  const [services, setServices] = useState([{ id: 's1', name: 'Online coaching, monthly', compPrepAddOn: false, checkInFrequency: 'weekly', tags: ['training', 'nutrition'] }]);
  const [policies, setPolicies] = useState({
    checkInDay: 1,
    responseWindow: 'Mon–Fri',
    paymentTerms: 'Monthly in advance',
    pausePolicy: '1 pause per 6 months',
    peakWeekRules: 'Daily updates required; posing submissions as scheduled',
    cancellationRefund: '',
  });
  const [branding, setBranding] = useState({
    profilePhotoUrl: '',
    bannerImageUrl: '',
    portfolioUrls: [],
    uspBullets: ['', '', ''],
    specialties: [],
    instagram: '',
    website: '',
  });
  const [adminBudgetHoursPerWeek, setAdminBudgetHoursPerWeek] = useState(5);
  const [planTier, setPlanTier] = useState('pro');

  useEffect(() => {
    if (!trainerId) return;
    const existing = getCoachProfile(trainerId);
    if (existing) {
      if (existing.displayName) setDisplayName(existing.displayName);
      if (existing.handle) setHandle(existing.handle);
      if (existing.timezone) setTimezone(existing.timezone);
      if (existing.workingHours) {
        const wh = existing.workingHours;
        if (wh.days) setWorkingDays(wh.days);
        if (wh.startTime) setStartTime(wh.startTime);
        if (wh.endTime) setEndTime(wh.endTime);
      }
      if (existing.responseTargetHours != null) setResponseTargetHours(existing.responseTargetHours);
      if (existing.services?.length) setServices(existing.services);
      if (existing.policies && Object.keys(existing.policies).length) setPolicies((p) => ({ ...p, ...existing.policies }));
      if (existing.branding && Object.keys(existing.branding).length) setBranding((b) => ({ ...b, ...existing.branding }));
      if (existing.adminBudgetHoursPerWeek != null) setAdminBudgetHoursPerWeek(existing.adminBudgetHoursPerWeek);
      if (existing.plan_tier) setPlanTier(existing.plan_tier);
    }
  }, [trainerId]);

  const totalSteps = 7;
  const progress = (step / totalSteps) * 100;

  const persistStep = useCallback(() => {
    if (!trainerId) return;
    setCoachProfile(trainerId, {
      displayName: step >= 1 ? displayName : undefined,
      handle: step >= 1 ? handle : undefined,
      timezone: step >= 1 ? timezone : undefined,
      workingHours: step >= 2 ? { days: workingDays, startTime, endTime } : undefined,
      responseTargetHours: step >= 2 ? responseTargetHours : undefined,
      services: step >= 3 ? services : undefined,
      policies: step >= 4 ? policies : undefined,
      branding: step >= 5 ? branding : undefined,
      plan_tier: step >= 6 ? planTier : undefined,
      adminBudgetHoursPerWeek: step >= 7 ? adminBudgetHoursPerWeek : undefined,
    });
  }, [trainerId, step, displayName, handle, timezone, workingDays, startTime, endTime, responseTargetHours, services, policies, branding, planTier, adminBudgetHoursPerWeek]);

  const handleNext = useCallback(() => {
    impactLight();
    if (step < totalSteps) {
      persistStep();
      setStep((s) => s + 1);
    } else {
      setCoachProfile(trainerId, {
        displayName,
        handle,
        timezone,
        workingHours: { days: workingDays, startTime, endTime },
        responseTargetHours,
        services,
        policies,
        branding,
        plan_tier: planTier,
        adminBudgetHoursPerWeek,
        onboardingComplete: true,
        onboardingSkipped: false,
      });
      lightHaptic();
      navigate('/home', { replace: true });
    }
  }, [step, trainerId, persistStep, displayName, handle, timezone, workingDays, startTime, endTime, responseTargetHours, services, policies, branding, planTier, adminBudgetHoursPerWeek, navigate]);

  const handleBack = useCallback(() => {
    impactLight();
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const toggleDay = (d) => {
    setWorkingDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const addService = () => {
    setServices((prev) => [...prev, { id: `s-${Date.now()}`, name: '', compPrepAddOn: false, checkInFrequency: 'weekly', tags: [] }]);
  };
  const updateService = (id, field, value) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const setUsp = (index, value) => {
    setBranding((b) => ({ ...b, uspBullets: b.uspBullets.map((v, i) => (i === index ? value : v)) }));
  };
  const toggleSpecialty = (spec) => {
    setBranding((b) => ({
      ...b,
      specialties: b.specialties.includes(spec) ? b.specialties.filter((s) => s !== spec) : [...b.specialties, spec],
    }));
  };

  if (!trainerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const canNext = step === 1 ? (displayName?.trim() && handle?.trim()) : true;

  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden overflow-y-auto"
      style={{
        background: colors.bg,
        color: colors.text,
        paddingTop: spacing[16],
        paddingBottom: spacing[24] + 80,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      <div style={{ marginBottom: spacing[24] }}>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: colors.accent, transition: 'width 0.2s ease' }} />
        </div>
        <p className="text-[13px] mt-2" style={{ color: colors.muted }}>Step {step} of {totalSteps}</p>
      </div>

      {/* Step 1: Coach basics */}
      {step === 1 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Coach basics</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>How clients will see you.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jane Smith"
                style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 16 }}
              />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Username / handle</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/\s/g, '').toLowerCase())}
                placeholder="e.g. janesmith"
                style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 16 }}
              />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
                style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: 16 }}
              />
            </div>
          </div>
        </>
      )}

      {/* Step 2: Working hours */}
      {step === 2 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Working hours</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>When you’re available and how fast you respond.</p>
          <div className="space-y-4">
            <p className="text-[13px]" style={{ color: colors.muted }}>Available days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: radii.full,
                    border: `1px solid ${workingDays.includes(i) ? colors.accent : colors.border}`,
                    background: workingDays.includes(i) ? 'rgba(37,99,235,0.2)' : colors.card,
                    color: colors.text,
                    fontSize: 14,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Start</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
              </div>
              <div className="flex-1">
                <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>End</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Response time target (hours)</label>
              <input type="number" min={1} max={72} value={responseTargetHours} onChange={(e) => setResponseTargetHours(parseInt(e.target.value, 10) || 24)} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
          </div>
        </>
      )}

      {/* Step 3: Services (online coaching) */}
      {step === 3 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Online coaching services</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>Define your offerings (e.g. monthly coaching, comp prep add-on).</p>
          <div className="space-y-4">
            {services.map((s) => (
              <div key={s.id} style={{ padding: spacing[12], borderRadius: radii.md, background: colors.card, border: `1px solid ${colors.border}` }}>
                <input type="text" placeholder="Service name (e.g. Online coaching, monthly)" value={s.name} onChange={(e) => updateService(s.id, 'name', e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, marginBottom: 8 }} />
                <label className="flex items-center gap-2 mt-2" style={{ color: colors.muted, fontSize: 14 }}>
                  <input type="checkbox" checked={!!s.compPrepAddOn} onChange={(e) => updateService(s.id, 'compPrepAddOn', e.target.checked)} />
                  Comp prep add-on
                </label>
                <div className="mt-2">
                  <span className="text-[13px]" style={{ color: colors.muted }}>Check-in frequency </span>
                  <select value={s.checkInFrequency || 'weekly'} onChange={(e) => updateService(s.id, 'checkInFrequency', e.target.value)} style={{ marginLeft: 8, padding: 6, borderRadius: 8, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                    {CHECKIN_FREQUENCY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="Tags (training, nutrition, comp prep)" value={Array.isArray(s.tags) ? s.tags.join(', ') : ''} onChange={(e) => updateService(s.id, 'tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} style={{ width: '100%', padding: 8, marginTop: 8, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 13 }} />
              </div>
            ))}
            <button type="button" onClick={addService} style={{ width: '100%', minHeight: touchTargetMin, border: `1px dashed ${colors.border}`, borderRadius: radii.md, background: 'transparent', color: colors.muted, fontSize: 15 }}>+ Add service</button>
          </div>
        </>
      )}

      {/* Step 4: Policies */}
      {step === 4 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Online coach policies</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>Check-in day, response window, payment and pause rules.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Check-in day</label>
              <select value={policies.checkInDay} onChange={(e) => setPolicies((p) => ({ ...p, checkInDay: parseInt(e.target.value, 10) }))} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }}>
                {DAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Response window</label>
              <input type="text" value={policies.responseWindow} onChange={(e) => setPolicies((p) => ({ ...p, responseWindow: e.target.value }))} placeholder="e.g. Mon–Fri" style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Payment terms</label>
              <input type="text" value={policies.paymentTerms} onChange={(e) => setPolicies((p) => ({ ...p, paymentTerms: e.target.value }))} placeholder="e.g. Monthly in advance" style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Pause policy</label>
              <input type="text" value={policies.pausePolicy} onChange={(e) => setPolicies((p) => ({ ...p, pausePolicy: e.target.value }))} placeholder="e.g. 1 pause per 6 months" style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Peak week rules</label>
              <textarea value={policies.peakWeekRules} onChange={(e) => setPolicies((p) => ({ ...p, peakWeekRules: e.target.value }))} placeholder="Daily updates required; posing frequency" rows={2} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, resize: 'vertical' }} />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Cancellation / refund (optional)</label>
              <textarea value={policies.cancellationRefund} onChange={(e) => setPolicies((p) => ({ ...p, cancellationRefund: e.target.value }))} rows={2} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, resize: 'vertical' }} />
            </div>
          </div>
        </>
      )}

      {/* Step 6: Plan */}
      {step === 6 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Plan</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>Choose your billing plan. You can change this later in Plan & Billing.</p>
          <div className="space-y-3">
            {PLAN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { impactLight(); setPlanTier(opt.value); }}
                style={{
                  width: '100%',
                  padding: spacing[16],
                  borderRadius: radii.md,
                  border: `1px solid ${planTier === opt.value ? colors.accent : colors.border}`,
                  background: planTier === opt.value ? 'rgba(37,99,235,0.15)' : colors.card,
                  color: colors.text,
                  textAlign: 'left',
                }}
              >
                <span className="font-medium">{opt.label}</span>
                {opt.desc && <span className="block text-[13px] mt-0.5" style={{ color: colors.muted }}>{opt.desc}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 7: Admin budget */}
      {step === 7 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Admin budget</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>How many hours per week do you set aside for admin (reviews, messages, planning)?</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Hours per week</label>
              <input type="number" min={1} max={40} value={adminBudgetHoursPerWeek} onChange={(e) => setAdminBudgetHoursPerWeek(parseInt(e.target.value, 10) || 5)} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
          </div>
        </>
      )}

      {/* Step 5: Branding / Public profile */}
      {step === 5 && (
        <>
          <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Branding & public profile</h1>
          <p className="text-[15px] mb-6" style={{ color: colors.muted }}>Profile photo, USPs, specialties and links.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Profile photo URL (optional)</label>
              <input type="text" value={branding.profilePhotoUrl} onChange={(e) => setBranding((b) => ({ ...b, profilePhotoUrl: e.target.value }))} placeholder="https://..." style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Banner / portfolio image URLs (optional)</label>
              <input type="text" value={(branding.portfolioUrls || []).join(', ')} onChange={(e) => setBranding((b) => ({ ...b, portfolioUrls: e.target.value.split(',').map((u) => u.trim()).filter(Boolean) }))} placeholder="Comma-separated URLs" style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
            <p className="text-[13px]" style={{ color: colors.muted }}>USP bullets (max 3)</p>
            {[0, 1, 2].map((i) => (
              <input key={i} type="text" value={branding.uspBullets[i] || ''} onChange={(e) => setUsp(i, e.target.value)} placeholder={`USP ${i + 1}`} style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            ))}
            <p className="text-[13px]" style={{ color: colors.muted }}>Specialties</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((spec) => (
                <button key={spec} type="button" onClick={() => toggleSpecialty(spec)} style={{ padding: '8px 12px', borderRadius: radii.full, border: `1px solid ${branding.specialties.includes(spec) ? colors.accent : colors.border}`, background: branding.specialties.includes(spec) ? 'rgba(37,99,235,0.2)' : colors.card, color: colors.text, fontSize: 13 }}>{spec}</button>
              ))}
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Instagram</label>
              <input type="text" value={branding.instagram} onChange={(e) => setBranding((b) => ({ ...b, instagram: e.target.value }))} placeholder="@handle" style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
            <div>
              <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Website</label>
              <input type="text" value={branding.website} onChange={(e) => setBranding((b) => ({ ...b, website: e.target.value }))} placeholder="https://..." style={{ width: '100%', padding: 12, borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3 mt-10">
        {step > 1 && (
          <Button variant="secondary" onClick={handleBack} style={{ flex: 1 }}>Back</Button>
        )}
        <Button variant="primary" onClick={handleNext} disabled={!canNext} style={{ flex: step > 1 ? 1 : 1 }}>{step === totalSteps ? 'Finish' : 'Next'}</Button>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            impactLight();
            setCoachProfile(trainerId, { onboardingSkipped: true });
            navigate('/home', { replace: true });
          }}
          className="text-sm"
          style={{ color: colors.muted, background: 'none', border: 'none', textDecoration: 'underline' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
