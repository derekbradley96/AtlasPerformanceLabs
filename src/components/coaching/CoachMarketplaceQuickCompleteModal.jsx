import React, { useState, useEffect } from 'react';
import Button from '@/ui/Button';
import { colors, touchTargetMin } from '@/ui/tokens';
import { X } from 'lucide-react';
import { SERVICE_DEFS } from '@/lib/coachMarketplaceListingDetails';

const QUICK_SERVICE_KEYS = ['training_plans', 'nutrition_support', 'weekly_checkins', 'messaging'];

/**
 * Optional ~2 min flow: who you help → services → pricing. Non-blocking; parent persists.
 */
export default function CoachMarketplaceQuickCompleteModal({
  open,
  onClose,
  onComplete,
  initialIdealLines = '',
  initialPricingSummary = '',
  initialPricingAmount = '',
}) {
  const [step, setStep] = useState(0);
  const [ideal, setIdeal] = useState('');
  const [services, setServices] = useState(() =>
    Object.fromEntries(QUICK_SERVICE_KEYS.map((k) => [k, true]))
  );
  const [pricingSummary, setPricingSummary] = useState('');
  const [pricingAmount, setPricingAmount] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setIdeal(initialIdealLines);
    setPricingSummary(initialPricingSummary);
    setPricingAmount(initialPricingAmount);
    setServices(Object.fromEntries(QUICK_SERVICE_KEYS.map((k) => [k, true])));
  }, [open, initialIdealLines, initialPricingSummary, initialPricingAmount]);

  if (!open) return null;

  const toggle = (key) => setServices((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFinish = () => {
    onComplete?.({
      idealClientLinesText: ideal,
      serviceKeys: QUICK_SERVICE_KEYS.filter((k) => services[k]),
      pricingSummary: pricingSummary.trim(),
      pricingFromAmount: pricingAmount.trim() === '' ? '' : pricingAmount.trim(),
    });
    onClose?.();
  };

  const titles = ['Who you help', 'What you offer', 'Pricing'];
  const bodies = [
    'Two short lines are enough — who thrives with you, and what they are working on.',
    'Select what coaching typically includes. You can fine-tune everything after.',
    'Clear pricing invites serious enquiries. You can still offer custom packages.',
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: colors.card, border: `1px solid ${colors.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
              Get clients faster
            </p>
            <h2 className="text-lg font-semibold mt-0.5" style={{ color: colors.text }}>
              {titles[step]}
            </h2>
          </div>
          <button type="button" onClick={() => onClose?.()} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm mb-4" style={{ color: colors.muted, lineHeight: 1.5 }}>
            {bodies[step]}
          </p>
          {step === 0 ? (
            <textarea
              value={ideal}
              onChange={(e) => setIdeal(e.target.value)}
              rows={4}
              placeholder="e.g. Busy professionals who want structure for fat loss&#10;e.g. First-time competitors who need accountability through prep"
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
              style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
            />
          ) : null}
          {step === 1 ? (
            <div className="flex flex-col gap-2">
              {SERVICE_DEFS.filter((d) => QUICK_SERVICE_KEYS.includes(d.key)).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 py-1 cursor-pointer">
                  <input type="checkbox" checked={!!services[key]} onChange={() => toggle(key)} className="rounded border-gray-500" />
                  <span className="text-sm" style={{ color: colors.text }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={pricingSummary}
                onChange={(e) => setPricingSummary(e.target.value)}
                rows={2}
                placeholder="e.g. From £150/month — includes training, check-ins, messaging"
                className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
                style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
              />
              <input
                type="number"
                min={0}
                value={pricingAmount}
                onChange={(e) => setPricingAmount(e.target.value)}
                placeholder="Starting monthly amount (optional)"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
              />
            </div>
          ) : null}
          <div className="flex gap-2 mt-6">
            {step > 0 ? (
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            {step < 2 ? (
              <Button type="button" className="flex-1" style={{ minHeight: touchTargetMin }} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : (
              <Button type="button" className="flex-1" style={{ minHeight: touchTargetMin }} onClick={handleFinish}>
                Apply to listing
              </Button>
            )}
          </div>
          <p className="text-xs mt-3 text-center" style={{ color: colors.muted }}>
            Step {step + 1} of 3 · You can edit every field in full detail anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
