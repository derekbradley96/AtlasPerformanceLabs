/**
 * Division-specific judging criteria for pose check review (coach reference).
 */

export const JUDGING_CRITERIA = {
  bikini: {
    front: [
      'Overall balance and symmetry front-on',
      'Muscle tone without excessive mass',
      'T-shaped physique — shoulder to waist ratio',
      'Glute shape and conditioning visible at front',
      'Stage presence, confidence, poise',
    ],
    back: [
      'Glute shape — roundness and separation',
      'Lower back and waist conditioning',
      'Overall back symmetry',
      'No visible cellulite or excessive softness',
    ],
    common_mistakes: [
      'Locking knees (should be soft)',
      'Not engaging lats (arms too close to body)',
      'Poor facial expression — smile should be natural',
      'Uneven weight distribution between legs',
    ],
    peak_conditioning: '10–14% body fat for stage',
  },
  figure: {
    front: [
      'Muscular symmetry and balance',
      'V-taper from shoulder to waist',
      'Quad sweep visible from front',
      'Abdominal conditioning without excessive striation',
      'Overall muscle shape not just size',
    ],
    back: [
      'Back width — lat spread',
      'Glute-hamstring tie-in',
      'Overall back muscle detail',
      'Symmetry of both sides',
    ],
    common_mistakes: [
      'Too much mass for the division',
      'Poor conditioning (not lean enough)',
      'Flat glutes from the back',
    ],
    peak_conditioning: '8–12% body fat for stage',
  },
  mens_physique: {
    front: [
      'X-frame symmetry (shoulder width vs waist)',
      'Upper body development — chest, shoulders, arms',
      'Board shorts fit and presentation',
      'Overall conditioning without extreme striation',
      'Stage presence and personality',
    ],
    back: [
      'Back width and V-taper',
      'Conditioning through upper back',
      'Board shorts coverage',
    ],
    common_mistakes: [
      'Over-conditioned (judges penalise for this)',
      'Poor posture and presentation',
      'Wrong board shorts choice',
    ],
    peak_conditioning: '6–10% body fat for stage',
  },
  classic_physique: {
    front: [
      'Classic proportions — waist-to-shoulder ratio',
      'Muscle fullness and roundness',
      'Overall symmetry and balance',
      'Conditioning with fullness — not flat',
    ],
    back: [
      'Back width and thickness combined',
      'Christmas tree lower back',
      'Glute and hamstring tie-in',
    ],
    common_mistakes: [
      'Too modern/mass-monster look for the division',
      'Flat conditioning — not full enough',
    ],
    peak_conditioning: '4–7% body fat for stage',
  },
  bodybuilding: {
    front: [
      'Overall muscle mass and density',
      'Conditioning — separation, striations visible',
      'Symmetry across all muscle groups',
      'No weak body parts',
    ],
    back: [
      'Overall back development',
      'Spinal erectors — Christmas tree',
      'Glute conditioning',
      'No imbalances between left and right',
    ],
    common_mistakes: [
      'Not conditioned enough — soft look',
      'Imbalances not addressed',
    ],
    peak_conditioning: '3–5% body fat for stage',
  },
};

const DIVISION_ALIASES = {
  mensphysique: 'mens_physique',
  men_s_physique: 'mens_physique',
  classic: 'classic_physique',
  classicphysique: 'classic_physique',
  mens_open_bodybuilding: 'bodybuilding',
  womens_bodybuilding: 'bodybuilding',
  womens_physique: 'figure',
  wellness: 'figure',
  fitness: 'figure',
};

/**
 * @param {string | null | undefined} division - display name or division_key
 * @returns {typeof JUDGING_CRITERIA[string] | null}
 */
export function getCriteriaForDivision(division) {
  const key = division?.toLowerCase()
    .replace(/[^a-z]/g, '_')
    .replace(/_+/g, '_');
  if (!key) return null;
  const mapped = DIVISION_ALIASES[key] || key;
  return JUDGING_CRITERIA[mapped] || JUDGING_CRITERIA[key] || null;
}
