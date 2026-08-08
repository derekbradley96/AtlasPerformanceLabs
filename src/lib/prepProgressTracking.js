/**
 * Compare actual weight change vs linear pace from prep start to stage target.
 */
import { formatAbsWeightDeltaFromKg } from '@/lib/bodyMeasurementUnits';

export function calculatePrepProgress({
  startWeight,
  targetWeight,
  currentWeight,
  startDate,
  showDate,
  viewerWeightUnit = 'kg',
}) {
  const sw = Number(startWeight);
  const tw = Number(targetWeight);
  const cw = Number(currentWeight);
  if (!Number.isFinite(sw) || !Number.isFinite(tw) || !Number.isFinite(cw)) return null;

  const show = new Date(showDate);
  const start = new Date(startDate);
  if (Number.isNaN(show.getTime()) || Number.isNaN(start.getTime())) return null;

  const totalWeeks = Math.max(
    1,
    Math.ceil((show - start) / (7 * 24 * 60 * 60 * 1000)),
  );
  const weeksElapsed = Math.max(
    0,
    Math.ceil((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );

  const totalChange = tw - sw;
  const expectedChange = (totalChange / totalWeeks) * weeksElapsed;
  const actualChange = cw - sw;

  const pctComplete = Math.min(100, Math.round((weeksElapsed / totalWeeks) * 100));

  const onTrackDelta = actualChange - expectedChange;

  const status =
    Math.abs(onTrackDelta) < 0.3 ? 'on_track' :
      onTrackDelta > 0 ? 'ahead' :
        'behind';

  const statusLabel =
    status === 'on_track' ? 'On track for your show' :
      status === 'ahead'
        ? `${formatAbsWeightDeltaFromKg(onTrackDelta, viewerWeightUnit)} ahead of target pace`
        : `${formatAbsWeightDeltaFromKg(onTrackDelta, viewerWeightUnit)} behind target pace`;

  return {
    pctComplete,
    weeksElapsed,
    totalWeeks,
    status,
    statusLabel,
    onTrackDelta,
    expectedProgressRatio: totalWeeks > 0 ? weeksElapsed / totalWeeks : 0,
    /** Where linear pace expects weight to be now (kg). */
    expectedWeightNow: sw + expectedChange,
  };
}
