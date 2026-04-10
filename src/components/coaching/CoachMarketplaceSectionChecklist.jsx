import React from 'react';
import { Check, Circle } from 'lucide-react';
import { colors, shell } from '@/ui/tokens';
import { space, cardRhythm } from '@/ui/rhythm';

/**
 * Section rows with completion + impact labels (why it matters for clients).
 */
export default function CoachMarketplaceSectionChecklist({ sections, onSectionNavigate }) {
  const pad = cardRhythm.standard.padding;

  return (
    <div
      style={{
        padding: pad,
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        background: colors.surface1,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
        What clients see
      </p>
      <p className="text-xs mt-1 mb-3" style={{ color: colors.textSecondary, lineHeight: 1.45 }}>
        Each block supports discovery quality — nothing here is required to stay listed.
      </p>
      <ul className="list-none p-0 m-0 flex flex-col gap-0">
        {sections.map((s) => (
          <li
            key={s.id}
            style={{
              borderTop: `1px solid ${colors.border}`,
              paddingTop: space[3],
              paddingBottom: space[3],
            }}
          >
            <button
              type="button"
              className="w-full text-left flex gap-3 items-start"
              style={{ background: 'none', border: 'none', cursor: onSectionNavigate ? 'pointer' : 'default', padding: 0 }}
              onClick={() => onSectionNavigate?.(s.anchorId)}
            >
              <span className="shrink-0 mt-0.5" style={{ color: s.complete ? colors.success : colors.muted }}>
                {s.complete ? <Check size={18} strokeWidth={2.5} /> : <Circle size={18} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="block text-sm font-semibold" style={{ color: colors.text }}>
                  {s.label}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: colors.muted, lineHeight: 1.45 }}>
                  {s.impactLabel}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
