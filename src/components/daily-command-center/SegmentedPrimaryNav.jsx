import React from 'react';
import { colors, spacing, radii } from '@/ui/tokens';

export default function SegmentedPrimaryNav({ items = [], activeKey, onSelect }) {
  if (!items.length) return null;
  const idx = Math.max(0, items.findIndex((i) => i.key === activeKey));
  const width = `${100 / items.length}%`;
  return (
    <div style={{ position: 'relative', borderRadius: radii.full, border: `1px solid ${colors.border}`, background: colors.surface1, padding: 4, display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: spacing[4] }}>
      <div aria-hidden style={{ position: 'absolute', top: 4, left: 4, width: `calc(${width} - 8px)`, height: 'calc(100% - 8px)', borderRadius: radii.full, background: colors.primarySubtle, transform: `translateX(${idx * 100}%)`, transition: 'transform 220ms ease' }} />
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onSelect?.(it)}
          style={{ position: 'relative', zIndex: 1, minHeight: 40, borderRadius: radii.full, border: 'none', background: 'transparent', color: it.key === activeKey ? colors.text : colors.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

