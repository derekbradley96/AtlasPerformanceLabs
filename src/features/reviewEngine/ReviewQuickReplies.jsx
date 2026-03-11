import React from 'react';
import { colors } from '@/ui/tokens';

/** Default chips for check-in; posing can use same or override via props. */
export const DEFAULT_QUICK_REPLY_CHIPS = [
  'Great work this week',
  "Let's adjust volume",
  'Push steps to 8k',
  'Diet adherence focus',
  'Great progress this week!',
  "Let's focus on sleep next week.",
  'Keep it up!',
];

/** Posing-specific quick replies. */
export const POSING_QUICK_REPLY_CHIPS = [
  'Great angle this week',
  'Relax the shoulder slightly',
  'Hold that pose a bit longer next time',
  'Good progress on this pose',
  'Try bringing the elbow forward a touch',
  'Strong line – keep it consistent',
  'Nice improvement',
];

/**
 * @param {{ chips?: string[], onInsert: (text: string) => void }} props
 */
export default function ReviewQuickReplies({ chips = DEFAULT_QUICK_REPLY_CHIPS, onInsert }) {
  return (
    <>
      <p className="text-[11px] font-medium mt-3 mb-2" style={{ color: colors.muted }}>Quick reply</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onInsert(text)}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors active:opacity-90"
            style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.06)', color: colors.text }}
          >
            {text.length > 28 ? text.slice(0, 26) + '…' : text}
          </button>
        ))}
      </div>
    </>
  );
}
