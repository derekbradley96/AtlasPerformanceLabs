/**
 * Canonical list of Supabase Edge Function names deployed for this project.
 * Anything invoked via `invokeSupabaseFunction` that is not in this set is a ghost
 * (see docs/GHOST_FUNCTIONS_AUDIT.md, dev warning in `supabaseStripeApi.js`,
 * `npm run check:ghosts`).
 */
export const DEPLOYED_EDGE_FUNCTIONS = [
  'cancelProPlan',
  'checkin-get',
  'checkin-list',
  'checkin-update',
  'client-coach-checkout-session',
  'client-coach-offer-context',
  'client-list-by-trainer',
  'client-profile-create',
  'client-profile-get',
  'client-profile-list',
  'client-profile-update',
  'coach-workload-briefing',
  'complete-review-item',
  'conversation-get',
  'conversation-update',
  'delete-account',
  'export-my-data',
  'generateInviteCode',
  'get-coach',
  'getTrainerEarnings',
  'health',
  'list-review-items',
  'list-services',
  'message-create',
  'message-list',
  'message-update',
  'program-get',
  'public-coach-profile',
  'retention-alerts',
  'run-client-insights',
  'send-push',
  'send-reminders',
  'send-welcome-email',
  'stripe-checkout-session',
  'stripe-connect-link',
  'stripe-create-plan-checkout',
  'stripe-service-upsert',
  'stripe-webhook',
  'submit-public-enquiry',
  'track-referral-event',
  'trainer-marketplace-list',
  'trainer-profile-get',
  'trainer-profile-list',
  'upgradeToProPlan',
  'validateInviteCode',
];

const DEPLOYED_EDGE_FUNCTION_SET = new Set(DEPLOYED_EDGE_FUNCTIONS);

/** @param {string} name */
export function isDeployedEdgeFunction(name) {
  return typeof name === 'string' && DEPLOYED_EDGE_FUNCTION_SET.has(name);
}
