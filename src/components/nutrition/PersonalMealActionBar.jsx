import React from 'react';
import { Plus, ScanBarcode, Zap } from 'lucide-react';
import { colors, shell, touchTargetMin } from '@/ui/tokens';

/**
 * Fixed bottom action row for personal Nutrition: primary add, scan, jump to quick adds.
 */
export default function PersonalMealActionBar({ onAddMeal, onScan, onQuickAdd, disabled }) {
  const btnBase = {
    flex: 1,
    minHeight: Math.max(touchTargetMin + 4, 52),
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        padding: `10px max(12px, env(safe-area-inset-left)) 10px max(12px, env(safe-area-inset-right))`,
        background: `linear-gradient(180deg, transparent 0%, ${colors.bg} 18%)`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 560,
          margin: '0 auto',
          display: 'flex',
          gap: 10,
          alignItems: 'stretch',
          padding: '8px 10px',
          borderRadius: 16,
          border: `1px solid ${shell.cardBorder}`,
          background: colors.surface1,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onAddMeal}
          style={{
            ...btnBase,
            background: colors.primary,
            color: '#fff',
            boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          }}
        >
          <Plus size={20} strokeWidth={2.5} aria-hidden />
          Add meal
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onScan}
          style={{
            ...btnBase,
            background: colors.surface2,
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          <ScanBarcode size={20} strokeWidth={2} aria-hidden />
          Scan
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onQuickAdd}
          style={{
            ...btnBase,
            background: colors.surface2,
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Zap size={20} strokeWidth={2} aria-hidden />
          Quick add
        </button>
      </div>
    </div>
  );
}
