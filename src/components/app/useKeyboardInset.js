/**
 * Re-export shared keyboard inset hook. Returns numeric inset for backward compatibility.
 */
import { useKeyboardInset as useKeyboardInsetShared, useKeyboardBottomInset as useKeyboardBottomInsetShared } from '@/hooks/useKeyboardInset';

export function useKeyboardInset() {
  const { keyboardInset } = useKeyboardInsetShared();
  return keyboardInset;
}

export function useKeyboardBottomInset() {
  return useKeyboardBottomInsetShared();
}
