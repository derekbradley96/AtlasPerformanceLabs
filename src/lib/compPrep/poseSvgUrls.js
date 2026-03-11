/**
 * Pose SVG assets as URLs for img + overlay. Vite resolves at build time.
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
};

export function getPoseSvgUrl(poseId) {
  return map[poseId] || null;
}
