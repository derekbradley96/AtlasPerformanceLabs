/**
 * Card-based plan composer: templates, name, price, billing pills, short description, optional includes.
 * Mobile-first; minimal labels (placeholders carry weight).
 */
import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { impactLight } from '@/lib/haptics';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import Card from '@/ui/Card';
import { COACH_PLAN_QUICK_TEMPLATES, patchFromCoachPlanTemplate } from '@/lib/coachPlanTemplates';

/**
 * @param {{
 *   value: { name: string; shortDescription: string; includes: string; priceMajor: string; interval: string; currency: string };
 *   onChange: (patch: Record<string, string>) => void;
 *   header?: React.ReactNode;
 *   footerActions?: React.ReactNode;
 *   savedBadge?: React.ReactNode;
 * }} props
 */
export default function CoachPlanPackageEditor({ value, onChange, header, footerActions, savedBadge }) {
  const [includesOpen, setIncludesOpen] = useState(() => !!(value.includes || '').trim());

  const applyTemplate = useCallback(
    (templateId) => {
      impactLight();
      const patch = patchFromCoachPlanTemplate(templateId);
      onChange(patch);
      if ((patch.includes || '').trim()) setIncludesOpen(true);
    },
    [onChange]
  );

  const v = value || {};

  return (
    <Card
      style={{
        padding: spacing[16],
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
      }}
    >
      {(header || savedBadge) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">{header}</div>
          {savedBadge}
        </div>
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
        Quick start
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {COACH_PLAN_QUICK_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className="shrink-0 text-left rounded-xl border px-3 py-2.5 transition-all active:scale-[0.98]"
            style={{
              minWidth: 108,
              maxWidth: 140,
              minHeight: touchTargetMin - 4,
              background: 'rgba(255,255,255,0.04)',
              borderColor: colors.border,
            }}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: colors.text }}>
              <Sparkles size={14} style={{ color: colors.accent, flexShrink: 0 }} />
              {t.label}
            </span>
            <span className="text-[11px] block mt-0.5 leading-tight" style={{ color: colors.muted }}>
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      <input
        type="text"
        value={v.name || ''}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Plan name"
        className="w-full rounded-xl px-3 py-3 text-[17px] font-medium mb-3 border-none"
        style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
        autoComplete="off"
      />

      <div className="flex flex-wrap items-stretch gap-2 mb-3">
        <div
          className="flex-1 min-w-[120px] rounded-xl px-3 py-2 flex items-center gap-1"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <span className="text-lg font-semibold pr-0.5" style={{ color: colors.muted }}>
            {v.currency === 'usd' ? '$' : v.currency === 'eur' ? '€' : '£'}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            placeholder="Price"
            value={v.priceMajor ?? ''}
            onChange={(e) => onChange({ priceMajor: e.target.value })}
            className="flex-1 min-w-0 bg-transparent border-none text-[20px] font-semibold py-1"
            style={{ color: colors.text }}
          />
        </div>
        <select
          value={v.currency || 'gbp'}
          onChange={(e) => onChange({ currency: e.target.value })}
          aria-label="Currency"
          className="rounded-xl px-2 text-[14px] font-medium border-none shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: colors.text, minHeight: touchTargetMin }}
        >
          <option value="gbp">GBP</option>
          <option value="usd">USD</option>
          <option value="eur">EUR</option>
        </select>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
        Billing
      </p>
      <div className="flex gap-2 mb-4">
        {[
          { id: 'month', label: 'Monthly' },
          { id: 'year', label: 'Yearly' },
        ].map((opt) => {
          const on = (v.interval || 'month') === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                impactLight();
                onChange({ interval: opt.id });
              }}
              className="flex-1 rounded-xl py-2.5 text-[15px] font-medium border transition-all"
              style={{
                minHeight: touchTargetMin - 2,
                background: on ? colors.primarySubtle : 'rgba(255,255,255,0.06)',
                borderColor: on ? colors.primary : colors.border,
                color: colors.text,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={v.shortDescription || ''}
        onChange={(e) => onChange({ shortDescription: e.target.value })}
        placeholder="Short description — what clients get"
        rows={2}
        maxLength={320}
        className="w-full rounded-xl px-3 py-3 text-[15px] mb-2 border-none resize-none"
        style={{ background: 'rgba(255,255,255,0.06)', color: colors.text }}
      />

      <button
        type="button"
        onClick={() => {
          impactLight();
          setIncludesOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between py-2 text-[14px] font-medium rounded-lg px-1"
        style={{ color: colors.accent }}
      >
        <span>What&apos;s included (optional)</span>
        {includesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {includesOpen ? (
        <textarea
          value={v.includes || ''}
          onChange={(e) => onChange({ includes: e.target.value })}
          placeholder="e.g. Weekly check-in, form video review, app access"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl px-3 py-3 text-[14px] mt-1 border-none resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: colors.text }}
        />
      ) : null}

      {footerActions ? <div className="mt-4 flex flex-col gap-2">{footerActions}</div> : null}
    </Card>
  );
}
