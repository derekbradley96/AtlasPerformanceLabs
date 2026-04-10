import React, { useMemo, useState } from 'react';
import { colors } from '@/ui/tokens';
import { formatNumber } from '@/lib/format';

function formatMoney(n) {
  return `£${formatNumber(Math.max(0, Number(n) || 0))}`;
}

export default function EarningsCalculator() {
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
    const eliteTotal = 79;

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

  const dynamicMessage =
    values.clients >= 20
      ? 'Elite now becomes the best option'
      : values.clients >= 10
        ? 'Pro is already saving you money'
        : 'Track where your pricing flips as your roster grows';

  const cardStyle = (plan) => ({
    border: `1px solid ${values.recommended === plan ? colors.primary : colors.border}`,
    background: values.recommended === plan ? 'rgba(59,130,246,0.12)' : colors.surface1,
    boxShadow: values.recommended === plan ? '0 0 0 1px rgba(59,130,246,0.35), 0 10px 30px rgba(59,130,246,0.20)' : 'none',
    borderRadius: 14,
    padding: 14,
  });

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
        className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
        style={{
          background: 'rgba(34,197,94,0.14)',
          border: '1px solid rgba(34,197,94,0.35)',
          color: '#86efac',
        }}
      >
        You save {formatMoney(values.proSavingsVsBasic)}/month with Pro
        {values.recommended === 'elite' && values.eliteSavingsVsPro > 0
          ? ` · Elite saves ${formatMoney(values.eliteSavingsVsPro)}/month vs Pro`
          : ''}
      </div>

      <p className="mt-3 text-sm font-medium" style={{ color: colors.accent }}>
        {dynamicMessage}
      </p>
    </section>
  );
}
