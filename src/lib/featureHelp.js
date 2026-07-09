/**
 * In-app "Learn more" copy for coach creation screens (AJB tester feedback #7:
 * features like Methodology Packages were confusing with no explanation).
 *
 * BASELINE COPY — Derek to review/replace. One entry per feature; keep each
 * paragraph short and outcome-first. Rendered by <FeatureHelpButton feature="…">.
 */

export const FEATURE_HELP = {
  'methodology-packages': {
    title: 'Methodology packages',
    paragraphs: [
      'A methodology package is your coaching system saved as a reusable bundle — programme structure, nutrition approach, check-in cadence, and supplement protocol in one place.',
      'Build it once from a client setup that already works, name it after the outcome it delivers (e.g. “12-week transformation”), and deploy it to a new client in a couple of taps instead of rebuilding each piece.',
    ],
  },
  programs: {
    title: 'Programs',
    paragraphs: [
      'Programs are the training plans you build and assign to clients — days, exercises, sets, and progression.',
      'A client sees their assigned program in Today and the workout player; what they log flows back to you on the dashboard and in Review Center.',
    ],
  },
  'checkin-templates': {
    title: 'Check-in templates',
    paragraphs: [
      'A check-in template defines what a client submits and when — questions, photos, weight, and the day it lands each week.',
      'Design it once per coaching style; every client on that template gets the same structured check-in, so reviews stay fast and comparable.',
    ],
  },
  'supplement-stacks': {
    title: 'Supplement stacks',
    paragraphs: [
      'A supplement stack is the protocol you assign to a client — products, doses, and timing windows.',
      'Clients see their stack with reminders in the app; you update it in one place when the protocol changes.',
    ],
  },
  'nutrition-plans': {
    title: 'Nutrition plans',
    paragraphs: [
      'Per-client nutrition targets — calories and macros, set per day or per phase.',
      'Clients log against these targets and their adherence shows up in your dashboard and check-in reviews.',
    ],
  },
  services: {
    title: 'Services',
    paragraphs: [
      'Services are the offers you sell — coaching packages with a name, price, and billing cycle.',
      'They power your marketplace listing and client checkout: when someone joins through your link, they pick from these.',
    ],
  },
};

/**
 * @param {string} feature
 * @returns {{ title: string, paragraphs: string[] } | null}
 */
export function getFeatureHelp(feature) {
  return FEATURE_HELP[feature] ?? null;
}
