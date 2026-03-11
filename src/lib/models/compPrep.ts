import { z } from 'zod';

/** UK-first federations */
export const federationEnum = z.enum(['PCA', '2BROS', 'OTHER']);
export type Federation = z.infer<typeof federationEnum>;

/** Sex */
export const sexEnum = z.enum(['MALE', 'FEMALE']);
export type Sex = z.infer<typeof sexEnum>;

/** Male divisions (UK-first) */
export const divisionMaleEnum = z.enum(['BODYBUILDING', 'CLASSIC', 'PHYSIQUE']);
export type DivisionMale = z.infer<typeof divisionMaleEnum>;

/** Female divisions */
export const divisionFemaleEnum = z.enum(['BIKINI', 'FIGURE', 'WELLNESS']);
export type DivisionFemale = z.infer<typeof divisionFemaleEnum>;

/** Division (union) */
export const divisionEnum = z.union([divisionMaleEnum, divisionFemaleEnum]);
export type Division = z.infer<typeof divisionEnum>;

/** Prep phase */
export const prepPhaseEnum = z.enum([
  'OFFSEASON',
  'PREP',
  'PEAK_WEEK',
  'SHOW_DAY',
  'POST_SHOW',
]);
export type PrepPhase = z.infer<typeof prepPhaseEnum>;

/** Client comp profile */
export const clientCompProfileSchema = z.object({
  clientId: z.string(),
  federation: federationEnum,
  sex: sexEnum,
  division: divisionEnum,
  prepPhase: prepPhaseEnum,
  showDate: z.string().optional(),
  coachNotes: z.string().optional(),
  updatedAt: z.string(),
});
export type ClientCompProfile = z.infer<typeof clientCompProfileSchema>;

/** Media type */
export const mediaTypeEnum = z.enum(['photo', 'video']);
export type MediaType = z.infer<typeof mediaTypeEnum>;

/** Media category */
export const mediaCategoryEnum = z.enum(['posing', 'progress', 'checkin']);
export type MediaCategory = z.infer<typeof mediaCategoryEnum>;

/** Comp media log */
export const compMediaLogSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  mediaType: mediaTypeEnum,
  category: mediaCategoryEnum,
  poseId: z.string().optional(),
  uri: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
  trainerComment: z.string().optional(),
});
export type CompMediaLog = z.infer<typeof compMediaLogSchema>;

/** Photo guide "understood" per client + phase */
export const photoGuideUnderstoodSchema = z.object({
  clientId: z.string(),
  phase: prepPhaseEnum.nullable(),
  understoodAt: z.string(),
});
export type PhotoGuideUnderstood = z.infer<typeof photoGuideUnderstoodSchema>;
