/**
 * Personal → Client transition: product policy + copy (same auth user id).
 * Not a new account — a coach relationship is added; role becomes client for app routing.
 */

/** What stays tied to your user id (immutable history). */
export const PERSONAL_TO_CLIENT_PRESERVED = Object.freeze([
  'Workout logs and completed sessions you already saved',
  'Nutrition logs and targets you set for yourself',
  'Progress metrics and check-ins tied to your profile',
  'Account email, password, and profile details',
]);

/** What changes in the app after you link a coach. */
export const PERSONAL_TO_CLIENT_CHANGES = Object.freeze([
  'Home becomes your coach-connected dashboard (programs and messaging your coach expects)',
  'New training assignments typically come from your coach (your solo plan stays in the background unless you archive it)',
  'Your app role shows as Client so coach tools (messages, program delivery) work correctly',
]);

/**
 * Solo-built program blocks: stored on your profile (owner_program_blocks).
 * Policy: data is retained; coach does not automatically overwrite it.
 * Coach programs attach via the clients row; Today prioritises coach assignment when active.
 */
export const PERSONAL_PLAN_POLICY = Object.freeze({
  summary:
    'Your self-built plan stays in your account as read-only history. Your coach sets up your coached program separately. You can ask them to reuse exercises or weeks from your solo plan — that is a conversation, not an automatic merge.',
  coexistence:
    'Solo blocks remain under your user id. When you train with a coach, follow their program for sessions they assign; your old solo plan is not deleted.',
  archive:
    'If you prefer a clean Today view, you can stop using the solo assignment from My Program — nothing is lost in the database.',
  coachImport:
    'Importing your solo plan into a coach-owned block is not automatic; coaches build from their library and your shared notes.',
});

/** After becoming a client, Personal-only surfaces (solo builder as primary) step aside; some remain reachable. */
export const PERSONAL_TOOLS_AFTER_CLIENT = Object.freeze({
  available:
    'Progress, habits, nutrition logging, and account settings remain. Messaging and workouts centre on your coach relationship.',
  primaryShift:
    'Program Builder as a solo-only primary path is replaced by coach program delivery; ask your coach if you need a hybrid workflow.',
});

export const personalCoachTransitionCopy = Object.freeze({
  pageTitle: 'Work with a coach',
  pageSubtitle:
    'Same Atlas account. You are adding a coaching relationship — not starting over and not losing your history.',

  sectionWhatStays: 'What stays with you',
  sectionWhatChanges: 'What changes',
  sectionPlanPolicy: 'Your solo plan',
  sectionTools: 'After you connect',

  ctaBrowseCoaches: 'Browse coaches',
  ctaBrowseCoachesSub: 'Marketplace — find a fit, then use their invite code or link.',
  ctaEnterCode: 'I have an invite code',
  ctaEnterCodeSub: 'Link your account to the coach who sent you a code.',

  discoveryBannerTitle: 'You are still on your Personal account',
  discoveryBannerBody:
    'When you join a coach, your logins and history stay here. We will switch your home to the client experience so messaging and programs work the way coaches expect.',

  activeClientBannerTitle: 'You trained solo before coaching',
  activeClientBannerBody:
    'Your earlier workouts and nutrition logs are still on this account. Follow your coach’s program for assigned sessions — your solo plan remains available as reference unless you remove it.',

  requestCoachShort: 'Ready to add a coach? Browse the marketplace or enter their invite code from this page.',
});
