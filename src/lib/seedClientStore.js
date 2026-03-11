/**
 * Seed test clients for demo/local testing. Stored in localStorage under atlas_seed_clients_v1 and atlas_seed_checkins_v1.
 * Used when SUPABASE_ENABLED is false; merged with mock + stub in getClients.
 */

const CLIENTS_KEY = 'atlas_seed_clients_v1';
const CHECKINS_KEY = 'atlas_seed_checkins_v1';

function loadJson(key, defaultVal = []) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function saveJson(key, data) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

/** @returns {Array<{ id: string; trainer_id: string; full_name: string; [key: string]: unknown }>} */
export function getSeedClients() {
  return loadJson(CLIENTS_KEY, []);
}

/** @param {Array<Record<string, unknown>>} list */
export function setSeedClients(list) {
  saveJson(CLIENTS_KEY, Array.isArray(list) ? list : []);
}

/** @returns {Array<{ id: string; client_id: string; trainer_id: string; [key: string]: unknown }>} */
export function getSeedCheckIns() {
  return loadJson(CHECKINS_KEY, []);
}

/** @param {Array<Record<string, unknown>>} list */
export function setSeedCheckIns(list) {
  saveJson(CHECKINS_KEY, Array.isArray(list) ? list : []);
}

/**
 * Generate realistic seed clients and check-ins for a trainer.
 * Seed set: 2 Prep (daysOut < 21), 1 Peak (daysOut < 7), 1 Offseason, 1 General.
 * @param {string} trainerId
 * @returns {{ clients: Array<Record<string, unknown>>; checkIns: Array<Record<string, unknown>> }}
 */
export function generateSeedClients(trainerId) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const iso = (d) => d.toISOString().slice(0, 19).replace('T', 'T');

  // Show dates: 2 prep (e.g. 14 and 18 days out), 1 peak (4 days out), 1 offseason (no show), 1 general (no show)
  const in14 = new Date(now);
  in14.setDate(in14.getDate() + 14);
  const in18 = new Date(now);
  in18.setDate(in18.getDate() + 18);
  const in4 = new Date(now);
  in4.setDate(in4.getDate() + 4);

  const clients = [
    {
      id: 'seed-prep-1',
      user_id: 'seed-user-1',
      trainer_id: trainerId,
      full_name: 'Jamie Prep',
      email: 'jamie.prep@test.example',
      subscription_status: 'active',
      status: 'on_track',
      payment_overdue: false,
      last_check_in_at: iso(now),
      phase: 'Prep',
      phaseStartedAt: dateStr(now),
      baselineWeight: 68,
      baselineStrength: { squat: 90, bench: 50, deadlift: 110 },
      created_date: iso(now),
      federation: 'NPC',
      division: 'Bikini',
      prepPhase: 'prep',
      showDate: dateStr(in14),
      step_target: 10000,
      cardio_target_mins: 30,
    },
    {
      id: 'seed-prep-2',
      user_id: 'seed-user-2',
      trainer_id: trainerId,
      full_name: 'Morgan Prep',
      email: 'morgan.prep@test.example',
      subscription_status: 'active',
      status: 'needs_review',
      payment_overdue: false,
      last_check_in_at: iso(now),
      phase: 'Prep',
      phaseStartedAt: dateStr(now),
      baselineWeight: 72,
      baselineStrength: { squat: 85, bench: 45, deadlift: 100 },
      created_date: iso(now),
      federation: 'NPC',
      division: "Men's Physique",
      prepPhase: 'prep',
      showDate: dateStr(in18),
      step_target: 12000,
      cardio_target_mins: 45,
    },
    {
      id: 'seed-peak-1',
      user_id: 'seed-user-3',
      trainer_id: trainerId,
      full_name: 'Sam Peak',
      email: 'sam.peak@test.example',
      subscription_status: 'active',
      status: 'on_track',
      payment_overdue: false,
      last_check_in_at: iso(now),
      phase: 'Peak Week',
      phaseStartedAt: dateStr(now),
      baselineWeight: 65,
      baselineStrength: { squat: 80, bench: 40, deadlift: 95 },
      created_date: iso(now),
      federation: 'IFBB',
      division: 'Bikini',
      prepPhase: 'peak_week',
      showDate: dateStr(in4),
      step_target: 8000,
      cardio_target_mins: 20,
    },
    {
      id: 'seed-offseason-1',
      user_id: 'seed-user-4',
      trainer_id: trainerId,
      full_name: 'Alex Offseason',
      email: 'alex.off@test.example',
      subscription_status: 'active',
      status: 'on_track',
      payment_overdue: false,
      last_check_in_at: null,
      phase: 'Offseason',
      phaseStartedAt: dateStr(now),
      baselineWeight: 78,
      baselineStrength: { squat: 120, bench: 70, deadlift: 140 },
      created_date: iso(now),
      federation: null,
      division: null,
      prepPhase: 'off_season',
      showDate: null,
      step_target: 8000,
      cardio_target_mins: 25,
    },
    {
      id: 'seed-general-1',
      user_id: 'seed-user-5',
      trainer_id: trainerId,
      full_name: 'Jordan General',
      email: 'jordan.general@test.example',
      subscription_status: 'active',
      status: 'on_track',
      payment_overdue: false,
      last_check_in_at: iso(now),
      phase: 'General',
      phaseStartedAt: dateStr(now),
      baselineWeight: 70,
      baselineStrength: { squat: 95, bench: 55, deadlift: 115 },
      created_date: iso(now),
      federation: null,
      division: null,
      prepPhase: null,
      showDate: null,
      step_target: 10000,
      cardio_target_mins: 30,
    },
  ];

  const checkIns = [];
  const clientIds = clients.map((c) => c.id);
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (14 - i));
    const weekStart = dateStr(d);
    const isoDate = iso(d);
    clientIds.forEach((clientId, idx) => {
      const phaseIdx = idx; // 0,1 prep; 2 peak; 3 off; 4 general
      const weightBase = [68, 72, 65, 78, 70][idx];
      const trend = phaseIdx <= 2 ? -0.15 * (14 - i) : phaseIdx === 3 ? 0.05 * i : 0;
      checkIns.push({
        id: `seed-checkin-${clientId}-${i}`,
        client_id: clientId,
        trainer_id: trainerId,
        status: i >= 10 ? 'submitted' : 'submitted',
        created_date: isoDate,
        submitted_at: isoDate,
        week_start: weekStart,
        weight_kg: Math.round((weightBase + trend) * 10) / 10,
        notes: i === 13 ? 'End of seed range' : null,
        steps: 8000 + Math.floor(Math.random() * 5000),
        adherence_pct: 75 + Math.floor(Math.random() * 25),
        sleep_hours: 6 + Math.random() * 2,
        flags: [],
      });
    });
  }

  return { clients, checkIns };
}

/**
 * Add test clients to the seed store for the given trainer (local only).
 * Merges with existing seed clients by id to avoid duplicates; new clients are appended.
 * @param {string} trainerId
 * @returns {number} count of clients now in seed store (after merge)
 */
export function addSeedTestClients(trainerId) {
  const existing = getSeedClients();
  const existingIds = new Set(existing.map((c) => c.id));
  const { clients: newClients, checkIns: newCheckIns } = generateSeedClients(trainerId);
  const toAdd = newClients.filter((c) => !existingIds.has(c.id));
  toAdd.forEach((c) => existingIds.add(c.id));
  const mergedClients = [...existing];
  toAdd.forEach((c) => {
    mergedClients.push(c);
  });
  const existingCheckIns = getSeedCheckIns();
  const existingCheckInIds = new Set(existingCheckIns.map((c) => c.id));
  const mergedCheckIns = [...existingCheckIns];
  newCheckIns.forEach((c) => {
    if (!existingCheckInIds.has(c.id)) {
      mergedCheckIns.push(c);
      existingCheckInIds.add(c.id);
    }
  });
  setSeedClients(mergedClients);
  setSeedCheckIns(mergedCheckIns);
  return mergedClients.length;
}

/**
 * Clear all seed clients and check-ins from localStorage.
 */
export function clearSeedClients() {
  setSeedClients([]);
  setSeedCheckIns([]);
}
