/**
 * Lead intake page: public route for /i/:handle or /lead-intake/:handle.
 * Lead fills name, email, goals, injuries, equipment, gym, diet prefs, check-in day.
 * On submit creates Lead and shows success. Trainer sees lead in Leads queue.
 */
import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCoachProfileByHandle } from '@/lib/data/coachProfileRepo';
import { createLeadFromApplication } from '@/lib/leadsStore';
import Button from '@/ui/Button';
import { colors } from '@/ui/tokens';
import { CheckCircle } from 'lucide-react';
import { impactLight, notificationSuccess } from '@/lib/haptics';

const trainerIdFromProfile = (profile) => (profile?.userId || profile?.id || 'demo-trainer').replace(/^coach-/, '');

export default function LeadIntake() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const profile = getCoachProfileByHandle(handle);
  const trainerUserId = profile ? trainerIdFromProfile(profile) : '';
  const services = profile?.services || [];

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    applicantName: '',
    email: '',
    phone: '',
    instagram: '',
    goal: '',
    preferredServiceId: '',
    gymAccess: '',
    equipment: '',
    injuries: '',
    timeline: '',
    budgetRange: '',
    checkInDayPreference: '',
    dietPrefs: '',
    notes: '',
  });

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!trainerUserId) return;
      if (!form.applicantName?.trim() || !form.email?.trim()) return;
      setSaving(true);
      const selectedService = services.find((s) => s.id === form.preferredServiceId);
      const serviceSnapshot = selectedService
        ? {
            name: selectedService.name,
            priceMonthly: selectedService.price ?? 0,
            includesCheckins: !!selectedService.includesCheckins,
            includesCalls: !!selectedService.includesCalls,
            includesPosing: !!selectedService.includesPosing,
            includesPeakWeek: !!selectedService.includesPeakWeek,
          }
        : undefined;
      createLeadFromApplication({
        trainerUserId,
        trainerProfileId: profile?.id,
        applicantName: form.applicantName.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
        instagram: form.instagram?.trim() || undefined,
        goal: [form.goal?.trim(), form.dietPrefs?.trim(), form.checkInDayPreference ? `Check-in day: ${form.checkInDayPreference}` : ''].filter(Boolean).join('. ') || '',
        timeline: form.timeline?.trim() || undefined,
        budgetRange: form.budgetRange?.trim() || undefined,
        gymAccess: form.gymAccess?.trim() || undefined,
        equipment: form.equipment?.trim() || undefined,
        injuries: form.injuries?.trim() || undefined,
        preferredServiceId: form.preferredServiceId || undefined,
        serviceSnapshot,
        notes: form.notes?.trim() || undefined,
      });
      setSaving(false);
      setSubmitted(true);
      notificationSuccess();
    },
    [trainerUserId, profile?.id, services, form]
  );

  if (!handle) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.muted }}>
        <p>Invalid link.</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
        <p className="text-center" style={{ color: colors.muted }}>Coach not found.</p>
        <Button variant="secondary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>Go home</Button>
      </div>
    );
  }

  if (submitted) {
    const checkoutUrl = trainerUserId
      ? `/lead-checkout?uid=${encodeURIComponent(trainerUserId)}&name=${encodeURIComponent(form.applicantName || '')}&email=${encodeURIComponent(form.email || '')}`
      : null;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          background: colors.bg,
          paddingLeft: 'max(24px, env(safe-area-inset-left))',
          paddingRight: 'max(24px, env(safe-area-inset-right))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.2)' }}>
          <CheckCircle size={32} style={{ color: colors.success }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>Application sent</h2>
        <p className="text-center text-sm mb-6" style={{ color: colors.muted }}>Thanks! The coach will be in touch.</p>
        {checkoutUrl && (
          <Button variant="primary" onClick={() => { impactLight(); navigate(checkoutUrl); }} style={{ marginBottom: 12, minHeight: 48 }}>Pay for a plan</Button>
        )}
        <Button variant="secondary" onClick={() => { impactLight(); navigate('/'); }} style={{ minHeight: 48 }}>Done</Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-y-auto p-6"
      style={{
        background: colors.bg,
        paddingBottom: 80,
        paddingLeft: 'max(24px, env(safe-area-inset-left))',
        paddingRight: 'max(24px, env(safe-area-inset-right))',
      }}
    >
      <h1 className="text-xl font-semibold mb-1" style={{ color: colors.text }}>Apply for coaching</h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>{profile.displayName || 'Coach'}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Name *</label>
          <input type="text" value={form.applicantName} onChange={(e) => update('applicantName', e.target.value)} required placeholder="Your name" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Email *</label>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required placeholder="you@example.com" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Phone (optional)</label>
          <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 234 567 8900" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Instagram (optional)</label>
          <input type="text" value={form.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="@handle" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Goals</label>
          <textarea value={form.goal} onChange={(e) => update('goal', e.target.value)} rows={3} placeholder="What do you want to achieve?" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, resize: 'vertical' }} />
        </div>
        {services.length > 0 && (
          <div>
            <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Preferred service</label>
            <select value={form.preferredServiceId} onChange={(e) => update('preferredServiceId', e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }}>
              <option value="">Select…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Gym access</label>
          <input type="text" value={form.gymAccess} onChange={(e) => update('gymAccess', e.target.value)} placeholder="Full gym, home, etc." style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Equipment</label>
          <input type="text" value={form.equipment} onChange={(e) => update('equipment', e.target.value)} placeholder="Dumbbells, bands, etc." style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Injuries / limitations</label>
          <textarea value={form.injuries} onChange={(e) => update('injuries', e.target.value)} rows={2} placeholder="Any injuries or limitations?" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, resize: 'vertical' }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Check-in day preference</label>
          <select value={form.checkInDayPreference} onChange={(e) => update('checkInDayPreference', e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }}>
            <option value="">Any</option>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Diet preferences</label>
          <input type="text" value={form.dietPrefs} onChange={(e) => update('dietPrefs', e.target.value)} placeholder="e.g. Flexible, high protein" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Timeline / budget (optional)</label>
          <input type="text" value={form.timeline} onChange={(e) => update('timeline', e.target.value)} placeholder="e.g. 12 weeks, £200/mo" style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text }} />
        </div>
        <div>
          <label className="block text-[13px] mb-1" style={{ color: colors.muted }}>Notes</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, resize: 'vertical' }} />
        </div>
        <Button type="submit" variant="primary" disabled={saving} onClick={impactLight} style={{ width: '100%', marginTop: 8 }}>{saving ? 'Sending…' : 'Submit'}</Button>
      </form>
    </div>
  );
}
