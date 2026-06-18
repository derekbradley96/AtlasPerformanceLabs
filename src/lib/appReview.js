export const REVIEW_STORAGE_KEY = 'atlas_app_review_prompted_v1';
export const REVIEW_THRESHOLD_KEY = 'atlas_review_action_count_v1';

export function incrementReviewActionCount() {
  try {
    const current = Number(
      localStorage.getItem(REVIEW_THRESHOLD_KEY) || '0'
    );
    localStorage.setItem(
      REVIEW_THRESHOLD_KEY,
      String(current + 1)
    );
    return current + 1;
  } catch { return 0; }
}

export function hasAlreadyPrompted() {
  try {
    return localStorage.getItem(REVIEW_STORAGE_KEY) === '1';
  } catch { return false; }
}

export function markPrompted() {
  try {
    localStorage.setItem(REVIEW_STORAGE_KEY, '1');
  } catch {}
}

export async function requestInAppReview() {
  if (hasAlreadyPrompted()) return;
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform?.()) return;

  try {
    const reviewModule = await import(
      '@capacitor-community/in-app-review'
    );
    const plugin = reviewModule.AppReview || reviewModule.InAppReview;
    if (!plugin?.requestReview) return;
    markPrompted();
    await plugin.requestReview();
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[appReview] requestReview failed:', e);
    }
  }
}

// Trigger after N qualifying actions
export async function maybeRequestReview(actionCount) {
  // Prompt after 10 meaningful actions (workouts, check-ins, reviews)
  if (actionCount >= 10 && !hasAlreadyPrompted()) {
    // Small delay so it doesn't interrupt the success moment
    setTimeout(() => requestInAppReview(), 2000);
  }
}
