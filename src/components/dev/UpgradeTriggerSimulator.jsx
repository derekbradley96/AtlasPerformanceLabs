import React, { useMemo, useState } from 'react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import UpgradePrompt from '@/components/UpgradePrompt';
import {
  evaluateUpgradeTriggers,
  selectUpgradePrompt,
  canShowMajorPrompt,
  resetUpgradePromptFrequencyGuards,
} from '@/utils/upgradeTriggers';

function money(n) {
  return `£${Math.round(Number(n) || 0)}`;
}

export default function UpgradeTriggerSimulator() {
  const [clientCount, setClientCount] = useState(10);
  const [monthlyRevenueInput, setMonthlyRevenueInput] = useState('1200');
  const [lastPaymentAmountInput, setLastPaymentAmountInput] = useState('180');
  const [currentPlan, setCurrentPlan] = useState('basic');

  const result = useMemo(
    () => evaluateUpgradeTriggers({
      clientCount,
      monthlyRevenue: Number(monthlyRevenueInput) || 0,
      lastPaymentAmount: Number(lastPaymentAmountInput) || 0,
      currentPlan,
    }),
    [clientCount, monthlyRevenueInput, lastPaymentAmountInput, currentPlan]
  );

  const selected = useMemo(() => selectUpgradePrompt(result.prompts, { allowMajor: true }), [result.prompts]);

  if (!import.meta.env.DEV) return null;

  return (
    <Card style={{ padding: spacing[12], border: `1px dashed ${colors.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.accent }}>
          Dev upgrade simulator
        </p>
        <button
          type="button"
          className="text-xs font-medium"
          style={{ color: colors.primary, background: 'none', border: 'none' }}
          onClick={resetUpgradePromptFrequencyGuards}
        >
          Reset cooldown
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-xs" style={{ color: colors.muted }}>
          Clients
          <div className="flex gap-1 mt-1">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setClientCount(n)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: clientCount === n ? colors.primary : colors.surface2,
                  color: clientCount === n ? '#fff' : colors.text,
                  border: 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </label>

        <label className="text-xs" style={{ color: colors.muted }}>
          Plan
          <select
            className="w-full mt-1 rounded px-2 py-1 text-xs"
            style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
            value={currentPlan}
            onChange={(e) => setCurrentPlan(e.target.value)}
          >
            <option value="basic">basic</option>
            <option value="pro">pro</option>
            <option value="elite">elite</option>
          </select>
        </label>

        <label className="text-xs" style={{ color: colors.muted }}>
          Monthly revenue
          <input
            type="number"
            min={0}
            value={monthlyRevenueInput}
            onChange={(e) => setMonthlyRevenueInput(e.target.value)}
            className="w-full mt-1 rounded px-2 py-1 text-xs"
            style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
          />
        </label>

        <label className="text-xs" style={{ color: colors.muted }}>
          Last payment
          <input
            type="number"
            min={0}
            value={lastPaymentAmountInput}
            onChange={(e) => setLastPaymentAmountInput(e.target.value)}
            className="w-full mt-1 rounded px-2 py-1 text-xs"
            style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
          />
        </label>
      </div>

      <p className="text-xs mb-2" style={{ color: colors.muted }}>
        Major allowed now: <span style={{ color: colors.text }}>{canShowMajorPrompt() ? 'yes' : 'no'}</span>
        {' · '}
        Lost vs Pro: <span style={{ color: colors.text }}>{money(result.estimates.lostMonthlyVsPro)}/mo</span>
        {' · '}
        Weekly lost: <span style={{ color: colors.text }}>{money(result.estimates.weeklyLostVsPro)}</span>
      </p>

      {selected ? (
        <UpgradePrompt prompt={selected} variant={selected.variant || 'inline'} onDismiss={() => {}} onUpgrade={() => {}} />
      ) : (
        <p className="text-xs" style={{ color: colors.muted }}>No prompt for current values.</p>
      )}
    </Card>
  );
}
