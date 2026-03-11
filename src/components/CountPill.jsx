/**
 * Animated count pill: value slides/fades on change (old up/out, new in from below). Pure CSS + React state.
 */
import React, { useState, useEffect, useRef } from 'react';
import { colors, radii } from '@/ui/tokens';

const TONE_STYLES = {
  primary: {
    bg: colors.primarySubtle,
    border: `1px solid ${colors.borderActive}`,
    valueColor: colors.primary,
  },
  neutral: {
    bg: 'rgba(255,255,255,0.06)',
    border: `1px solid ${colors.border}`,
    valueColor: colors.text,
  },
  danger: {
    bg: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    valueColor: colors.danger,
  },
  success: {
    bg: colors.successSubtle,
    border: '1px solid rgba(34,197,94,0.3)',
    valueColor: colors.success,
  },
};

const ANIM_DURATION_MS = 160;

export default function CountPill({ label, value, tone = 'neutral', showLabel = true, className = '' }) {
  const [previousValue, setPreviousValue] = useState(value);
  const [animating, setAnimating] = useState(false);
  const [transitionActive, setTransitionActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const next = value != null ? String(value) : '';
    const prev = previousValue != null ? String(previousValue) : '';
    if (next === prev) return;

    setAnimating(true);
    setTransitionActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    const raf = requestAnimationFrame(() => setTransitionActive(true));
    timerRef.current = setTimeout(() => {
      setPreviousValue(value);
      setAnimating(false);
      setTransitionActive(false);
      timerRef.current = null;
    }, ANIM_DURATION_MS);

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const style = TONE_STYLES[tone] || TONE_STYLES.neutral;
  const displayValue = value != null ? String(value) : '—';
  const displayPrevious = previousValue != null ? String(previousValue) : '—';

  return (
    <div
      className={`count-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm ${className}`}
      style={{
        background: style.bg,
        border: style.border,
        borderRadius: radii.pill,
      }}
    >
      {showLabel && label && (
        <span className="count-pill-label shrink-0" style={{ color: colors.muted }}>
          {label}
        </span>
      )}
      <span className="count-pill-value-wrap relative inline-flex min-w-[1.25rem] justify-end overflow-hidden" style={{ height: '1.25em' }}>
        {animating && (
          <span
            className={`count-pill-value count-pill-value-exit absolute inset-0 flex items-center justify-end ${transitionActive ? 'count-pill-exit-active' : ''}`}
            style={{ color: style.valueColor }}
          >
            {displayPrevious}
          </span>
        )}
        <span
          className={`count-pill-value count-pill-value-enter ${animating ? 'absolute inset-0 flex items-center justify-end ' + (transitionActive ? 'count-pill-enter-active' : '') : 'count-pill-value-idle'}`}
          style={{ color: style.valueColor }}
        >
          {displayValue}
        </span>
      </span>
    </div>
  );
}
