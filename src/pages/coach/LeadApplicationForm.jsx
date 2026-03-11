import React, { useState, useCallback } from 'react';
import { createLeadFromApplication } from '@/lib/leadsStore';
import Button from '@/ui/Button';
import { colors } from '@/ui/tokens';
import { X, CheckCircle } from 'lucide-react';
import { notificationSuccess } from '@/lib/haptics';

export default function LeadApplicationForm({
  trainerUserId,
  trainerProfileId,
  services = [],
  onClose,
  onSuccess,
}) {
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
    availability: '',
    trainingAge: '',
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
      const serviceSnapshot =
        selectedService
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
        trainerProfileId,
        applicantName: form.applicantName.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
        instagram: form.instagram?.trim() || undefined,
        goal: form.goal?.trim() || '',
        timeline: form.timeline?.trim() || undefined,
        budgetRange: form.budgetRange?.trim() || undefined,
        trainingAge: form.trainingAge?.trim() || undefined,
        gymAccess: form.gymAccess?.trim() || undefined,
        equipment: form.equipment?.trim() || undefined,
        injuries: form.injuries?.trim() || undefined,
        availability: form.availability?.trim() || undefined,
        preferredServiceId: form.preferredServiceId || undefined,
        serviceSnapshot,
        notes: form.notes?.trim() || undefined,
      });
      setSaving(false);
      setSubmitted(true);
      notificationSuccess();
      setTimeout(() => onSuccess?.(), 1500);
    },
    [
      trainerUserId,
      trainerProfileId,
      services,
      form,
      onSuccess,
    ]
  );

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
        style={{
          background: 'rgba(11,18,32,0.95)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.2)' }}>
          <CheckCircle size={32} style={{ color: colors.success }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>Application sent</h2>
        <p className="text-center text-sm mb-6" style={{ color: colors.muted }}>
          Thanks for applying. The coach will be in touch soon.
        </p>
        <Button onClick={onClose}>Done</Button>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border px-3 py-2.5 text-[15px]';
  const inputStyle = { borderColor: colors.border, background: colors.card, color: colors.text };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: colors.border }}>
        <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Apply for coaching</h2>
        <button type="button" onClick={onClose} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Name *</label>
          <input
            type="text"
            value={form.applicantName}
            onChange={(e) => update('applicantName', e.target.value)}
            required
            placeholder="Your name"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
            placeholder="you@example.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Phone (optional)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+44 ..."
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Instagram (optional)</label>
          <input
            type="text"
            value={form.instagram}
            onChange={(e) => update('instagram', e.target.value)}
            placeholder="@handle"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Goal *</label>
          <textarea
            value={form.goal}
            onChange={(e) => update('goal', e.target.value)}
            placeholder="What do you want to achieve?"
            rows={3}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        {services.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Preferred service</label>
            <select
              value={form.preferredServiceId}
              onChange={(e) => update('preferredServiceId', e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Select…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.price != null ? `(£${(s.price / 100).toFixed(0)}/mo)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Gym access</label>
          <input
            type="text"
            value={form.gymAccess}
            onChange={(e) => update('gymAccess', e.target.value)}
            placeholder="e.g. Full gym, home only"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Equipment</label>
          <input
            type="text"
            value={form.equipment}
            onChange={(e) => update('equipment', e.target.value)}
            placeholder="What equipment do you have?"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Injuries / limitations</label>
          <textarea
            value={form.injuries}
            onChange={(e) => update('injuries', e.target.value)}
            placeholder="Any injuries or health considerations?"
            rows={2}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Timeline (optional)</label>
          <input
            type="text"
            value={form.timeline}
            onChange={(e) => update('timeline', e.target.value)}
            placeholder="e.g. 12 weeks to show"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Budget range (optional)</label>
          <input
            type="text"
            value={form.budgetRange}
            onChange={(e) => update('budgetRange', e.target.value)}
            placeholder="e.g. £100–150/month"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div className="pt-4">
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Sending…' : 'Submit application'}
          </Button>
        </div>
      </form>
    </div>
  );
}
