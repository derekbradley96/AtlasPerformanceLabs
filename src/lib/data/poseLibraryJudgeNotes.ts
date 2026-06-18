/**
 * Federation judge-note lines for pose library (UK / US / international / other natural orgs).
 * Used to attach consistent `judgeNotes` arrays to every pose.
 */

export const FEDERATIONS_POSE_LIBRARY = [
  'PCA',
  'UKBFF',
  'NABBA',
  'Pure Elite',
  'NPC',
  'IFBB Pro League',
  'WBFF',
  'Ben Weider',
  'IFBB',
  'NANBF',
  'OCB',
  'WNBF',
  'INBF',
  'IPE',
  'Natural Physique Association',
  '2BROS',
  'OTHER',
] as const;

export type PoseLibraryFederation = (typeof FEDERATIONS_POSE_LIBRARY)[number];

type RegionKey = 'uk' | 'us' | 'intl' | 'other';

const REGION_BY_FED: Record<PoseLibraryFederation, RegionKey> = {
  PCA: 'uk',
  UKBFF: 'uk',
  NABBA: 'uk',
  'Pure Elite': 'uk',
  NPC: 'us',
  'IFBB Pro League': 'us',
  WBFF: 'intl',
  'Ben Weider': 'intl',
  IFBB: 'other',
  NANBF: 'other',
  OCB: 'other',
  WNBF: 'other',
  INBF: 'other',
  IPE: 'other',
  'Natural Physique Association': 'other',
  '2BROS': 'other',
  OTHER: 'other',
};

export type JudgeNoteLines = {
  uk: string[];
  us: string[];
  intl: string[];
  other: string[];
};

/** One judgeNotes row per federation; bullets chosen by region bucket. */
export function makeJudgeNotes(lines: JudgeNoteLines): { federation: string; bullets: string[] }[] {
  return FEDERATIONS_POSE_LIBRARY.map((federation) => ({
    federation,
    bullets: lines[REGION_BY_FED[federation]].slice(),
  }));
}
