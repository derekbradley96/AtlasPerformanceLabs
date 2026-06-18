import React, { useMemo, useState } from 'react';
import { colors } from '@/ui/tokens';
import { formatNumber } from '@/lib/format';
import { ELITE_MONTHLY_GBP } from '@/lib/coachUpgradeMomentMath';

function formatMoney(n) {
  return `£${formatNumber(Math.max(0, Number(n) || 0))}`;
}

/**
 * @param {{ embed?: boolean }} [props] — When true, compact block + single summary line for onboarding.
 */
export default function EarningsCalculator({ embed = false } = {}) {
  const [clients, setClients] = useState(10);
  const [pricePerClientInput, setPricePerClientInput] = useState('100');

  const values = useMemo(() => {
    const safeClients = Math.max(1, Math.min(50, Number(clients) || 1));
    const safePrice = Math.max(1, Number(pricePerClientInput) || 1);

    const monthlyRevenue = safeClients * safePrice;
    const basicCommission = monthlyRevenue * 0.1;
    const proCommission = monthlyRevenue * 0.03;

    const basicTotal = basicCommission;
    const proTotal = 59 + proCommission;
    const eliteTotal = ELITE_MONTHLY_GBP;

    let recommended = 'basic';
    if (proTotal < basicTotal) recommended = 'pro';
    if (eliteTotal < proTotal) recommended = 'elite';

    const proSavingsVsBasic = Math.max(0, basicTotal - proTotal);
    const eliteSavingsVsPro = Math.max(0, proTotal - eliteTotal);

    return {
      clients: safeClients,
      pricePerClient: safePrice,
      monthlyRevenue,
      basicTotal,
      proTotal,
      eliteTotal,
      recommended,
      proSavingsVsBasic,
      eliteSavingsVsPro,
    };
  }, [clients, pricePerClientInput]);

  const proBeatBasic = values.proTotal < values.basicTotal;
  const eliteBeatPro = values.eliteTotal < values.proTotal;

  const dynamicMessage = eliteBeatPro
    ? 'Elite is your most cost-effective plan at this volume'
    : proBeatBasic
      ? 'Pro is already saving you money vs Basic'
      : values.clients >= 8
        ? `Pro breaks even at ~10 clients — you're getting close`
        : 'Track where your pricing flips as your roster grows';

  const cardStyle = (plan) => ({
    border: `1px solid ${values.recommended === plan ? colors.primary : colors.border}`,
    background: values.recommended === plan ? 'rgba(59,130,246,0.12)' : colors.surface1,
    boxShadow: values.recommended === plan ? '0 0 0 1px rgba(59,130,246,0.35), 0 10px 30px rgba(59,130,246,0.20)' : 'none',
    borderRadius: 14,
    padding: 14,
  });

  const earnSegment = (key, label, amount) => (
    <span key={key}>
      <span style={{ color: colors.muted }}>{label}</span>{' '}
      <span style={{ color: values.recommended === key ? colors.primary : colors.text, fontWeight: 700 }}>
        {formatMoney(amount)}
      </span>
    </span>
  );

  if (embed) {
    return (
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: colors.border, background: colors.surface1 }}
      >
        <h3 className="text-[15px] font-semibold mb-3" style={{ color: colors.text }}>
          Earnings calculator
        </h3>
        <div className="grid gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: colors.muted }}>
              Clients ({values.clients})
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={values.clients}
              onChange={(e) => setClients(e.target.valueAsNumber)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: colors.muted }}>
              Price per client (£)
            </label>
            <input
              type="number"
              min={1}
              value={pricePerClientInput}
              onChange={(e) => setPricePerClientInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-xl px-3 py-3 text-[16px] border-none"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: colors.text,
              }}
            />
          </div>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: colors.textSecondary }}>
          {earnSegment('revenue', 'You earn:', values.monthlyRevenue)}
          <span style={{ color: colors.muted }}> · </span>
          {earnSegment('basic', 'Basic cost:', values.basicTotal)}
          <span style={{ color: colors.muted }}> · </span>
          {earnSegment('pro', 'Pro cost:', values.proTotal)}
          <span style={{ color: colors.muted }}> · </span>
          {earnSegment('elite', 'Elite cost:', values.eliteTotal)}
        </p>
        <p className="text-[12px] mt-2 font-medium" style={{ color: colors.accent }}>
          {values.recommended === 'basic' && 'Basic is cheapest at these inputs.'}
          {values.recommended === 'pro' && 'Pro is cheapest at these inputs.'}
          {values.recommended === 'elite' && 'Elite is cheapest at these inputs.'}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border p-5 sm:p-6" style={{ borderColor: colors.border, background: colors.surface }}>
      <h3 className="text-xl font-bold mb-2" style={{ color: colors.text }}>
        Earnings calculator
      </h3>
      <p className="text-sm mb-5" style={{ color: colors.muted }}>
        Adjust client count and monthly price to see what you keep on each plan.
      </p>

      <div className="grid gap-4 md:grid-cols-2 mb-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Clients ({values.clients})
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={values.clients}
            onChange={(e) => setClients(e.target.valueAsNumber)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Price per client
          </label>
          <input
            type="number"
            min={1}
            value={pricePerClientInput}
            onChange={(e) => setPricePerClientInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: colors.surface1,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div style={{ ...cardStyle('revenue') }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.muted }}>You earn</p>
          <p className="text-xl font-bold" style={{ color: colors.text }}>{formatMoney(values.monthlyRevenue)}</p>
        </div>
        <div style={cardStyle('basic')}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Basic cost</p>
          <p className="text-xl font-bold" style={{ color: colors.text }}>{formatMoney(values.basicTotal)}</p>
        </div>
        <div style={cardStyle('pro')}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Pro cost</p>
          <p className="text-xl font-bold" style={{ color: colors.text }}>{formatMoney(values.proTotal)}</p>
        </div>
        <div style={cardStyle('elite')}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Elite cost</p>
          <p className="text-xl font-bold" style={{ color: colors.text }}>{formatMoney(values.eliteTotal)}</p>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold space-y-1"
        style={{
          background: 'rgba(34,197,94,0.14)',
          border: '1px solid rgba(34,197,94,0.35)',
          color: '#86efac',
        }}
      >
        <p>
          You save {formatMoney(values.proSavingsVsBasic)}/month with Pro
          {values.recommended === 'elite' && values.eliteSavingsVsPro > 0
            ? ` · Elite saves ${formatMoney(values.eliteSavingsVsPro)}/month vs Pro`
            : ''}
        </p>
        {values.recommended === 'elite' && values.eliteSavingsVsPro > 0 ? (
          <p className="text-xs font-medium opacity-95">
            Plus: white-label, 0% commission, priority support
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-medium" style={{ color: colors.accent }}>
        {dynamicMessage}
      </p>
    </section>
  );
}
