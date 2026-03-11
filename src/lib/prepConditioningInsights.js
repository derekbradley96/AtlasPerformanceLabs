/**
 * Simple conditioning summary for prep clients, based on coach tags (pose_conditioning_notes).
 * No AI; rule-based only.
 *
 * @typedef {Array<{ week_out?: number, pose_key?: string, tags: string[] }>} PoseTimeline
 *   Entries from progression + conditioning notes (tags per pose/week).
 */

const LOWER_BODY_TAGS = ['glutes_not_in', 'hamstring_detail'];
const RECENT_WEEKS_THRESHOLD = 12; // consider "recent" if week_out <= 12
const MIN_IMPROVING_COUNT = 2;

/**
 * Generate a short conditioning summary from a pose timeline with coach tags.
 * @param {PoseTimeline} poseTimeline - Array of { week_out?, pose_key?, tags } (tags from pose_conditioning_notes).
 * @returns {{ summary: string, level: 'positive' | 'warning' | 'info' }}
 */
export function generateConditioningSummary(poseTimeline) {
  if (!Array.isArray(poseTimeline) || poseTimeline.length === 0) {
    return { summary: 'No conditioning data yet.', level: 'info' };
  }

  const withTags = poseTimeline.filter((e) => Array.isArray(e.tags) && e.tags.length > 0);
  if (withTags.length === 0) {
    return { summary: 'No conditioning tags yet. Add tags on pose review to see a summary.', level: 'info' };
  }

  const recent = withTags.filter(
    (e) => e.week_out != null && Number(e.week_out) <= RECENT_WEEKS_THRESHOLD
  );
  const usePool = recent.length >= 2 ? recent : withTags;

  const allTags = usePool.flatMap((e) => e.tags || []);
  const conditioningImproved = allTags.filter((t) => t === 'conditioning_improved').length;
  const fullnessDrop = allTags.filter((t) => t === 'fullness_drop').length;
  const lowerBodyConcern = allTags.filter((t) => LOWER_BODY_TAGS.includes(t)).length;
  const backDensity = allTags.filter((t) => t === 'back_density').length;

  if (conditioningImproved >= MIN_IMPROVING_COUNT && conditioningImproved >= lowerBodyConcern && fullnessDrop === 0) {
    return {
      summary: 'Conditioning improving across last 3 weeks.',
      level: 'positive',
    };
  }

  if (lowerBodyConcern > 0 && conditioningImproved < lowerBodyConcern) {
    return {
      summary: 'Lower body conditioning lagging.',
      level: 'warning',
    };
  }

  if (fullnessDrop > 0) {
    return {
      summary: 'Fullness drop noted in recent weeks.',
      level: 'warning',
    };
  }

  if (backDensity > 0 && conditioningImproved === 0) {
    return {
      summary: 'Back density noted; keep monitoring conditioning.',
      level: 'info',
    };
  }

  if (conditioningImproved > 0) {
    return {
      summary: 'Some conditioning improvements tagged.',
      level: 'positive',
    };
  }

  return {
    summary: 'Conditioning notes present. Add more tags over time for a clearer summary.',
    level: 'info',
  };
}
