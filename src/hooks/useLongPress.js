import { useRef, useCallback } from 'react';

const DEFAULT_DURATION_MS = 350;

async function lightHaptic() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (Capacitor.isNativePlatform?.()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

/**
 * Returns pointer-event handlers for long-press. Calls onLongPress after durationMs (default 350ms).
 * Clears timer on pointerUp, pointerCancel, pointerLeave. Fires light haptic on long-press.
 * Use only on the bubble/element that should trigger the action (do not preventDefault globally).
 */
export function useLongPress({
  onLongPress,
  durationMs = DEFAULT_DURATION_MS,
}) {
  const timerRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0 && e.button !== undefined) return;
      clear();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lightHaptic();
        onLongPress?.(e);
      }, durationMs);
    },
    [durationMs, onLongPress, clear]
  );

  const handlePointerUp = useCallback(() => clear(), [clear]);
  const handlePointerCancel = useCallback(() => clear(), [clear]);
  const handlePointerLeave = useCallback(() => clear(), [clear]);

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerLeave,
  };
}
