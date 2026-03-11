import React, { useCallback, useEffect, useState } from 'react';
import { colors, spacing } from '@/ui/tokens';
import { getStoredTaxRate, setStoredTaxRate } from '@/lib/earningsMock';

const CARD_BG = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function TaxSetAsideCard({ period, netRevenue }) {
  const [rate, setRate] = useState('25');

  useEffect(() => {
    setRate(String(getStoredTaxRate()));
  }, [period]);

  const parsedRate = rate === '' ? 25 : Math.min(100, Math.max(0, Number(rate) || 0));
  const recommended = Math.round((netRevenue * parsedRate) / 100);

  const handlePreset = useCallback((r) => {
    setRate(String(r));
    setStoredTaxRate(r);
  }, []);

  const handleCustomChange = useCallback((val) => {
    if (/^\d*\.?\d*$/.test(val)) setRate(val);
  }, []);

  const handleCustomBlur = useCallback(() => {
    const n = rate === '' ? 25 : Math.min(100, Math.max(0, Number(rate) || 0));
    setRate(String(n));
    setStoredTaxRate(n);
  }, [rate]);

  const isPreset = [20, 25, 30, 35].includes(parsedRate);
  const customInputValue = ['20', '25', '30', '35'].includes(rate) ? '' : rate;

  return (
    <div
      className="rounded-[20px] overflow-hidden border"
      style={{ background: CARD_BG, borderColor: BORDER, padding: spacing[16] }}
    >
      <p className="text-[13px] font-semibold mb-3" style={{ color: colors.muted }}>Tax set-aside</p>
      <p className="text-[15px] mb-1" style={{ color: colors.text }}>Recommended to set aside ({parsedRate}%)</p>
      <p className="text-[22px] font-bold mb-4" style={{ color: colors.accent }}>{formatCurrency(recommended)}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {[20, 25, 30, 35].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handlePreset(r)}
            className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors border-none"
            style={{
              background: parsedRate === r ? colors.accent : 'rgba(255,255,255,0.08)',
              color: parsedRate === r ? '#fff' : colors.muted,
            }}
          >
            {r}%
          </button>
        ))}
        <label className="flex items-center gap-2">
          <span className="text-[13px]" style={{ color: colors.muted }}>Custom</span>
          <input
            type="text"
            inputMode="decimal"
            value={customInputValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            onBlur={handleCustomBlur}
            placeholder="%"
            className="rounded-lg px-3 py-2 w-14 text-right text-[13px] border"
            style={{ background: 'rgba(255,255,255,0.08)', borderColor: BORDER, color: colors.text }}
          />
          <span className="text-[13px]" style={{ color: colors.muted }}>%</span>
        </label>
      </div>
    </div>
  );
}
