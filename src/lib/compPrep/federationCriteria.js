/**
 * Federation judging focus for competition prep.
 * When viewing a client, display their federation's criteria.
 */

export const federationCriteria = {
  NPC: {
    name: 'NPC',
    focus: [
      'Symmetry and proportion',
      'Muscle mass and conditioning',
      'Presentation and stage presence',
      'Posing execution and transitions',
      'Overall balance between size and leanness',
    ],
  },
  IFBB: {
    name: 'IFBB',
    focus: [
      'Conditioning and dryness',
      'Muscle maturity and density',
      'Symmetry and shape',
      'Posing and flow',
      'Stage presentation',
    ],
  },
  NANBF: {
    name: 'NANBF',
    focus: [
      'Natural physique development',
      'Symmetry and proportion',
      'Conditioning without extreme depletion',
      'Presentation',
    ],
  },
  OCB: {
    name: 'OCB',
    focus: [
      'Natural muscle development',
      'Symmetry and balance',
      'Conditioning and clarity',
      'Posing and presentation',
    ],
  },
};

/**
 * @param {string} [federation] - e.g. 'NPC', 'IFBB'
 * @returns {{ name: string; focus: string[] } | null}
 */
export function getFederationCriteria(federation) {
  if (!federation || typeof federation !== 'string') return null;
  const key = federation.trim().toUpperCase();
  return federationCriteria[key] ?? null;
}
