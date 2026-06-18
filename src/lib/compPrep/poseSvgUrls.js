/**
 * Pose SVG assets as URLs for img + overlay. Vite resolves at build time.
 * Extended library ids map to the closest bundled asset until dedicated art ships.
 */
import maleFdb from '@/assets/poses/svg/male_fdb.svg';
import maleSideChest from '@/assets/poses/svg/male_side_chest.svg';
import maleBackLat from '@/assets/poses/svg/male_back_lat.svg';
import maleFrontLat from '@/assets/poses/svg/male_front_lat.svg';
import maleSideTriceps from '@/assets/poses/svg/male_side_triceps.svg';
import maleMostMuscular from '@/assets/poses/svg/male_most_muscular.svg';
import femaleBikiniFront from '@/assets/poses/svg/female_bikini_front.svg';
import femaleBikiniBack from '@/assets/poses/svg/female_bikini_back.svg';
import femaleBikiniSide from '@/assets/poses/svg/female_bikini_side.svg';
import femaleFigureFront from '@/assets/poses/svg/female_figure_front.svg';
import femaleWellnessBack from '@/assets/poses/svg/female_wellness_back.svg';
import femaleWellnessFront from '@/assets/poses/svg/female_wellness_front.svg';

const map = {
  male_fdb: maleFdb,
  male_side_chest: maleSideChest,
  male_back_lat: maleBackLat,
  male_front_lat: maleFrontLat,
  male_side_triceps: maleSideTriceps,
  male_most_muscular: maleMostMuscular,
  female_bikini_front: femaleBikiniFront,
  female_bikini_back: femaleBikiniBack,
  female_bikini_side: femaleBikiniSide,
  female_figure_front: femaleFigureFront,
  female_wellness_back: femaleWellnessBack,
  female_wellness_front: femaleWellnessFront,

  // poseLibraryData.extended.ts — explicit nearest bundled SVG (replaces prefix-only fallback)
  male_back_double_bicep: maleBackLat,
  male_abdominal_thigh: maleMostMuscular,
  male_quarter_turn_front: maleFdb,
  male_quarter_turn_right: maleFdb,
  male_quarter_turn_back: maleBackLat,
  male_quarter_turn_left: maleFdb,
  male_physique_front_pose: maleFrontLat,
  male_physique_back_pose: maleBackLat,
  male_wheelchair_front_symmetry: maleFdb,
  male_wheelchair_rear_symmetry: maleBackLat,
  male_wheelchair_side_symmetry: maleSideChest,
  male_wheelchair_most_muscular_seated: maleMostMuscular,

  female_figure_back: femaleWellnessBack,
  female_figure_side: femaleBikiniSide,
  female_wellness_side: femaleBikiniSide,
  female_physique_front: femaleFigureFront,
  female_physique_back: femaleWellnessBack,
  female_bodybuilding_fdb: femaleFigureFront,

  female_fitness_quarter_front: femaleBikiniFront,
  female_fitness_quarter_right: femaleBikiniSide,
  female_fitness_quarter_back: femaleBikiniBack,
  female_fitness_quarter_left: femaleBikiniSide,
  female_fitness_routine: femaleBikiniFront,

  female_womens_bb_quarter_front: femaleFigureFront,
  female_womens_bb_quarter_right: femaleBikiniSide,
  female_womens_bb_quarter_back: femaleWellnessBack,
  female_womens_bb_quarter_left: femaleBikiniSide,
  female_womens_bb_front_lat: femaleFigureFront,
  female_womens_bb_side_chest: femaleBikiniSide,
  female_womens_bb_side_tricep: femaleBikiniSide,
  female_womens_bb_rear_double: femaleWellnessBack,
  female_womens_bb_rear_lat: femaleWellnessBack,
  female_womens_bb_abs_thigh: femaleBikiniFront,
  female_womens_bb_most_muscular: femaleFigureFront,
};

/** Fallback SVG when id is still unknown after map + hyphen normalization. */
const fallbackByPrefix = [
  { prefix: 'male_', asset: maleFdb },
  { prefix: 'female_', asset: femaleBikiniFront },
];

export function getPoseSvgUrl(poseId) {
  if (!poseId) return null;
  if (map[poseId]) return map[poseId];
  if (map[String(poseId).replace(/-/g, '_')]) return map[String(poseId).replace(/-/g, '_')];
  const id = String(poseId);
  for (const { prefix, asset } of fallbackByPrefix) {
    if (id.startsWith(prefix)) return asset;
  }
  return null;
}
