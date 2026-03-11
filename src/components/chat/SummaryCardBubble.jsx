/**
 * Renders a "Weekly Summary" message as a card. Tappable to expand/collapse.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { formatRelativeDate } from '@/lib/format';

export default function SummaryCardBubble({ message, isOutgoing }) {
  const [expanded, setExpanded] = useState(false);
  const payload = message?.summaryPayload ?? message?.payload;
  const title = payload?.title ?? 'Weekly Summary';
  const wins = Array.isArray(payload?.wins) ? payload.wins : [];
  const slips = Array.isArray(payload?.slips) ? payload.slips : [];
  const nextSteps = Array.isArray(payload?.nextSteps) ? payload.nextSteps : [];
  const createdDate = message?.created_date;

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: 10 }}>
      <div
        className="rounded-[20px] overflow-hidden border max-w-[85%]"
        style={{
          background: isOutgoing ? colors.primary : colors.surface1,
          borderColor: isOutgoing ? 'transparent' : colors.border,
          color: isOutgoing ? '#fff' : colors.text,
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
        >
          <span className="text-[15px] font-semibold">{title}</span>
          {expanded ? (
            <ChevronUp size={18} style={{ opacity: 0.8 }} />
          ) : (
            <ChevronDown size={18} style={{ opacity: 0.8 }} />
          )}
        </button>
        {expanded && (
          <div className="px-4 pb-4 pt-0 space-y-3" style={{ borderTop: `1px solid ${colors.border}` }}>
            {wins.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ opacity: 0.85 }}>Wins</p>
                <ul className="text-[13px] space-y-0.5">
                  {wins.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {slips.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ opacity: 0.85 }}>Slips</p>
                <ul className="text-[13px] space-y-0.5">
                  {slips.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {nextSteps.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ opacity: 0.85 }}>Next steps</p>
                <ul className="text-[13px] space-y-0.5">
                  {nextSteps.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {createdDate && (
          <p className="px-4 pb-2 text-[11px]" style={{ opacity: 0.75 }}>
            {formatRelativeDate(createdDate)}
          </p>
        )}
      </div>
    </div>
  );
}
