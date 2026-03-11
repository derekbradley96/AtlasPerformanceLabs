/**
 * Pressable card: scale(0.98) on pointer down, 120ms ease, haptic on click.
 * Accessible: role="button", tabIndex=0, Enter/Space trigger click.
 */
import React, { useState, useCallback } from 'react';
import { hapticLight } from '@/lib/haptics';

const TRANSITION = 'transform 120ms ease';

export default function PressableCard({ onClick, children, className = '', style = {}, ...rest }) {
  const [pressed, setPressed] = useState(false);

  const handlePointerDown = useCallback(() => setPressed(true), []);
  const handlePointerUp = useCallback(() => setPressed(false), []);
  const handlePointerCancel = useCallback(() => setPressed(false), []);
  const handlePointerLeave = useCallback(() => setPressed(false), []);

  const handleClick = useCallback(
    (e) => {
      hapticLight();
      onClick?.(e);
    },
    [onClick]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        hapticLight();
        onClick?.(e);
      }
    },
    [onClick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      className={className}
      style={{
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: TRANSITION,
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
