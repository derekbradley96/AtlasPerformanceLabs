/**
 * Evidence-based prep templates for solo competition users (protocol-backed prep).
 */

/** @typedef {{ name: string, weeks: string, calorieAdjustment: number|string, proteinMultiplier: number, refeedFrequency: string, cardioMinutes: number, cardioSessions: number, trainingFocus: string }} PrepProtocolPhase */

/**
 * Normalise week range strings (supports hyphen and en-dash).
 * @param {string} raw
 * @returns {{ start: number, end: number } | null}
 */
export function parsePhaseWeekRange(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.replace(/–/g, '-').trim();
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return { start: Number(m[1]), end: Number(m[2]) };
  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = Number(single[1]);
    return { start: n, end: n };
  }
  return null;
}

/** @param {typeof PREP_PROTOCOLS['20_week_cut']} protocol */
export function getProtocolTotalWeeks(protocol) {
  if (!protocol?.phases?.length) return 0;
  let max = 0;
  for (const ph of protocol.phases) {
    const r = parsePhaseWeekRange(ph.weeks);
    if (r) max = Math.max(max, r.end);
  }
  return max;
}

/**
 * Current calendar week index within prep (1-based), from prep start date.
 * @param {string} prepStartedAt - YYYY-MM-DD
 * @param {string} [todayIso] - YYYY-MM-DD
 */
export function getCurrentPrepWeekIndex(prepStartedAt, todayIso) {
  const start = parseLocalDate(prepStartedAt);
  const today = todayIso ? parseLocalDate(todayIso) : new Date();
  if (!start || !today) return 1;
  const ms = today.getTime() - start.getTime();
  const days = Math.floor(ms / 86400000);
  const week = Math.floor(days / 7) + 1;
  return Math.max(1, week);
}

function parseLocalDate(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * @param {typeof PREP_PROTOCOLS['20_week_cut']} protocol
 * @param {number} weekIndex 1-based
 * @returns {PrepProtocolPhase | null}
 */
export function getPhaseForPrepWeek(protocol, weekIndex) {
  if (!protocol?.phases) return null;
  const w = Math.max(1, Number(weekIndex) || 1);
  for (const ph of protocol.phases) {
    const r = parsePhaseWeekRange(ph.weeks);
    if (r && w >= r.start && w <= r.end) return ph;
  }
  return protocol.phases[protocol.phases.length - 1] || null;
}

/**
 * @param {{ show_date: string, prep_started_at: string }} prep
 * @param {string} [todayYmd]
 */
export function getWeeksOutFromShow(prep, todayYmd) {
  const showRaw = prep?.show_date != null ? String(prep.show_date).slice(0, 10) : '';
  const show = parseLocalDate(showRaw);
  const today = todayYmd ? parseLocalDate(String(todayYmd).slice(0, 10)) : new Date();
  if (!show || !today) return null;
  const ms = show.getTime() - today.getTime();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return 0;
  return Math.max(0, Math.ceil(days / 7));
}

/** @param {PrepProtocolPhase | null} phase */
export function buildDailyInstructionLines(phase) {
  if (!phase) return [];
  const lines = [];
  lines.push(phase.trainingFocus);
  if (typeof phase.calorieAdjustment === 'number') {
    lines.push(`Calorie target: maintenance minus ${Math.abs(phase.calorieAdjustment)} kcal (relative guide).`);
  } else if (phase.calorieAdjustment) {
    lines.push(`Calories: ${phase.calorieAdjustment}.`);
  }
  lines.push(`Protein guide: ~${phase.proteinMultiplier} g per kg bodyweight.`);
  lines.push(`Refeeds: ${phase.refeedFrequency}.`);
  if (Number(phase.cardioSessions) > 0) {
    lines.push(`Cardio: ${phase.cardioSessions} sessions × ~${phase.cardioMinutes} minutes.`);
  } else {
    lines.push('Cardio: as per peak week — follow depletion / rest guidance.');
  }
  return lines;
}

/**
 * Map full days until show (0 = show day) to peakWeekGuide keys day1..day7.
 * @param {number} daysUntilShow
 * @param {Record<string, string>} peakWeekGuide
 */
export function getPeakWeekDayKey(daysUntilShow, peakWeekGuide) {
  if (!peakWeekGuide) return null;
  const d = Math.max(0, Number(daysUntilShow) || 0);
  const idx = Math.min(7, Math.max(1, d + 1));
  const key = `day${idx}`;
  return peakWeekGuide[key] ? key : null;
}

export const PREP_PROTOCOLS = {
  '20_week_cut': {
    name: '20-week competition prep',
    description:
      'Standard competition prep for first-time competitors. Conservative deficit with planned refeeds.',
    suitableFor: ['bikini', 'mens_physique', 'figure'],
    phases: [
      {
        name: 'Base phase',
        weeks: '1–8',
        calorieAdjustment: -250,
        proteinMultiplier: 2.4,
        refeedFrequency: 'none',
        cardioMinutes: 30,
        cardioSessions: 3,
        trainingFocus: 'Maintain strength. Slight volume reduction from offseason.',
      },
      {
        name: 'Prep phase',
        weeks: '9–16',
        calorieAdjustment: -400,
        proteinMultiplier: 2.6,
        refeedFrequency: '1 per week',
        cardioMinutes: 45,
        cardioSessions: 4,
        trainingFocus: 'Maintain muscle. Volume reduction begins. Posing practice 3x/week.',
      },
      {
        name: 'Peak phase',
        weeks: '17–19',
        calorieAdjustment: -500,
        proteinMultiplier: 2.8,
        refeedFrequency: '2 per week',
        cardioMinutes: 60,
        cardioSessions: 5,
        trainingFocus: 'Minimal volume. Focus on conditioning and posing.',
      },
      {
        name: 'Peak week',
        weeks: '20',
        calorieAdjustment: 'variable — see peak week guide',
        proteinMultiplier: 2.4,
        refeedFrequency: 'structured loading',
        cardioMinutes: 0,
        cardioSessions: 0,
        trainingFocus: 'Depletion sessions only. Full rest 2 days before show.',
      },
    ],
    peakWeekGuide: {
      day7: 'Depletion — very low carbs (<50g), high protein, 2h fasted cardio',
      day6: 'Depletion — same as day 7',
      day5: 'Depletion — add one refeed meal (100g carbs) in evening',
      day4: 'Loading begins — moderate carbs (150g), reduce sodium',
      day3: 'Loading — high carbs (250g+), normal protein, restrict sodium',
      day2: 'Full loading — max carbs, no cardio, rest',
      day1: 'Show day — morning carbs only, minimal water',
    },
  },
};

export function getPrepProtocol(protocolId) {
  return PREP_PROTOCOLS[protocolId] || null;
}
