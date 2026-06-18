/** @typedef {{ full_name: string, country: string, website: string, drug_tested: boolean, divisions: string[], what_to_bring: string[], what_to_expect: string[], banned_items?: string[], bikini_suit_rules?: string, judging_format: string }} FederationGuide */

/** @type {Record<string, FederationGuide>} */
export const FEDERATION_GUIDES = {
  PCA: {
    full_name: 'Professional Choice Awards',
    country: 'UK',
    website: 'pcashows.co.uk',
    drug_tested: false,
    divisions: ['Bikini', 'Figure', 'Fitness Model', 'Physique', 'Bodybuilding', 'Classic', 'Wellness'],
    what_to_bring: [
      'Photo ID (passport or driving licence)',
      'Completed entry form (usually pre-submitted online)',
      'Payment confirmation email',
      'Bikini/posing suit — must comply with division rules',
      'Posing oil or Pro Tan — dark colour for stage',
      'Pump-up equipment (resistance bands)',
      'Show day food: rice cakes, rice, white bread, banana',
      'Water and electrolytes',
    ],
    what_to_expect: [
      'Arrive 1–2 hours before registration closes',
      'Registration desk — check-in, collect number',
      'Backstage pump area — use resistance bands only',
      'Oil up and check tan coverage before going on stage',
      'Prejudging: mandatory comparisons in your class',
      'Evening show: finals and awards',
    ],
    banned_items: [
      'Jewellery that distracts (federation specific)',
      'Painted-on tan at many shows — must use spray tan',
    ],
    bikini_suit_rules:
      'Must be two-piece. Fabric triangle minimum coverage. No excessive embellishment.',
    judging_format: 'Class by height/weight. Top 5 from each class go to overall.',
  },
  UKBFF: {
    full_name: 'UK Bodybuilding and Fitness Federation',
    country: 'UK',
    drug_tested: false,
    divisions: ['Bikini Fitness', 'Body Fitness', 'Physique', 'Bodybuilding', 'Classic Bodybuilding'],
    what_to_bring: ['UKBFF membership card', 'Show entry confirmation', 'Posing suit to UKBFF specification'],
    what_to_expect: [
      'Check-in and verification of membership',
      'Height/weight check for relevant classes',
      'Backstage call system — listen for your number',
    ],
    judging_format: 'Placement system. Overall for best in show.',
  },
};

export const FEDERATION_KEYS = Object.keys(FEDERATION_GUIDES);
