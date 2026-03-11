import { z } from 'zod';
import type { Federation } from './compPrep';

/** Stable pose IDs (snake_case) */
export const poseIdSchema = z.string();
export type PoseId = z.infer<typeof poseIdSchema>;

/** Sex (for pose applicability) */
export const sexEnum = z.enum(['MALE', 'FEMALE']);
export type Sex = z.infer<typeof sexEnum>;

/** Male divisions */
export const divisionMaleEnum = z.enum(['BODYBUILDING', 'CLASSIC', 'PHYSIQUE']);
/** Female divisions */
export const divisionFemaleEnum = z.enum(['BIKINI', 'FIGURE', 'WELLNESS']);
export const divisionEnum = z.union([divisionMaleEnum, divisionFemaleEnum]);
export type Division = z.infer<typeof divisionEnum>;

/** Hotspot shape */
export const hotspotShapeEnum = z.enum(['rect', 'circle', 'poly']);
export type HotspotShape = z.infer<typeof hotspotShapeEnum>;

/** Coords: rect [x,y,w,h], circle [cx,cy,r], poly [x1,y1,x2,y2,...] (percent 0-100) */
export const hotspotCoordsSchema = z.array(z.number());

/** Hotspot for SVG overlay */
export const hotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  shape: hotspotShapeEnum,
  coords: hotspotCoordsSchema,
  cueTitle: z.string(),
  cueBody: z.string(),
});
export type Hotspot = z.infer<typeof hotspotSchema>;

/** Judge notes per federation */
export const judgeNotesEntrySchema = z.object({
  federation: z.enum(['PCA', '2BROS', 'OTHER']),
  bullets: z.array(z.string()),
});
export type JudgeNotesEntry = z.infer<typeof judgeNotesEntrySchema>;

/** Pose */
export const poseSchema = z.object({
  id: poseIdSchema,
  name: z.string(),
  sex: sexEnum,
  divisions: z.array(divisionEnum),
  isMandatory: z.boolean(),
  svgAssetPath: z.string(),
  description: z.string().optional(),
  hotspots: z.array(hotspotSchema),
  judgeNotes: z.array(judgeNotesEntrySchema),
  commonMistakes: z.array(z.string()),
  tips: z.array(z.string()),
});
export type Pose = z.infer<typeof poseSchema>;
