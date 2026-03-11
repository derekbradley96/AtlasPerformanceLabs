/**
 * Toast API – use for success, error, info. Wraps sonner.
 */
import { toast as sonnerToast } from 'sonner';

export function useToast() {
  return {
    success: (message) => sonnerToast.success(message),
    error: (message, opts) => sonnerToast.error(message, opts),
    info: (message) => sonnerToast.info(message),
    promise: (promise, messages) => sonnerToast.promise(promise, messages),
  };
}

export { sonnerToast as toast };
