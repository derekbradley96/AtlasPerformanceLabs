#!/usr/bin/env node
/**
 * Generate the same seed test clients + check-ins used by the in-app "Add Test Clients" button.
 * Usage: node scripts/seedTestClients.mjs [trainerId] [output.json]
 * Default trainerId: demo-trainer
 * If output.json is provided, writes there; otherwise prints JSON to stdout.
 */

const trainerId = process.argv[2] || 'demo-trainer';
const outPath = process.argv[3];

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = (d) => d.toISOString().slice(0, 19).replace('T', 'T');

const in14 = new Date(now);
in14.setDate(in14.getDate() + 14);
const in18 = new Date(now);
in18.setDate(in18.getDate() + 18);
const in4 = new Date(now);
in4.setDate(in4.getDate() + 4);

const clients = [
  { id: 'seed-prep-1', user_id: 'seed-user-1', trainer_id: trainerId, full_name: 'Jamie Prep', email: 'jamie.prep@test.example', subscription_status: 'active', status: 'on_track', payment_overdue: false, last_check_in_at: iso(now), phase: 'Prep', phaseStartedAt: dateStr(now), baselineWeight: 68, baselineStrength: { squat: 90, bench: 50, deadlift: 110 }, created_date: iso(now), federation: 'NPC', division: 'Bikini', prepPhase: 'prep', showDate: dateStr(in14), step_target: 10000, cardio_target_mins: 30 },
  { id: 'seed-prep-2', user_id: 'seed-user-2', trainer_id: trainerId, full_name: 'Morgan Prep', email: 'morgan.prep@test.example', subscription_status: 'active', status: 'needs_review', payment_overdue: false, last_check_in_at: iso(now), phase: 'Prep', phaseStartedAt: dateStr(now), baselineWeight: 72, baselineStrength: { squat: 85, bench: 45, deadlift: 100 }, created_date: iso(now), federation: 'NPC', division: "Men's Physique", prepPhase: 'prep', showDate: dateStr(in18), step_target: 12000, cardio_target_mins: 45 },
  { id: 'seed-peak-1', user_id: 'seed-user-3', trainer_id: trainerId, full_name: 'Sam Peak', email: 'sam.peak@test.example', subscription_status: 'active', status: 'on_track', payment_overdue: false, last_check_in_at: iso(now), phase: 'Peak Week', phaseStartedAt: dateStr(now), baselineWeight: 65, baselineStrength: { squat: 80, bench: 40, deadlift: 95 }, created_date: iso(now), federation: 'IFBB', division: 'Bikini', prepPhase: 'peak_week', showDate: dateStr(in4), step_target: 8000, cardio_target_mins: 20 },
  { id: 'seed-offseason-1', user_id: 'seed-user-4', trainer_id: trainerId, full_name: 'Alex Offseason', email: 'alex.off@test.example', subscription_status: 'active', status: 'on_track', payment_overdue: false, last_check_in_at: null, phase: 'Offseason', phaseStartedAt: dateStr(now), baselineWeight: 78, baselineStrength: { squat: 120, bench: 70, deadlift: 140 }, created_date: iso(now), federation: null, division: null, prepPhase: 'off_season', showDate: null, step_target: 8000, cardio_target_mins: 25 },
  { id: 'seed-general-1', user_id: 'seed-user-5', trainer_id: trainerId, full_name: 'Jordan General', email: 'jordan.general@test.example', subscription_status: 'active', status: 'on_track', payment_overdue: false, last_check_in_at: iso(now), phase: 'General', phaseStartedAt: dateStr(now), baselineWeight: 70, baselineStrength: { squat: 95, bench: 55, deadlift: 115 }, created_date: iso(now), federation: null, division: null, prepPhase: null, showDate: null, step_target: 10000, cardio_target_mins: 30 },
];

const checkIns = [];
const clientIds = clients.map((c) => c.id);
for (let i = 0; i < 14; i++) {
  const d = new Date(now);
  d.setDate(d.getDate() - (14 - i));
  const weekStart = dateStr(d);
  const isoDate = iso(d);
  clientIds.forEach((clientId, idx) => {
    const weightBase = [68, 72, 65, 78, 70][idx];
    const trend = idx <= 2 ? -0.15 * (14 - i) : idx === 3 ? 0.05 * i : 0;
    checkIns.push({
      id: `seed-checkin-${clientId}-${i}`,
      client_id: clientId,
      trainer_id: trainerId,
      status: 'submitted',
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

const out = { clients, checkIns };
if (outPath) {
  const fs = await import('fs');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.error(`Wrote ${outPath} (${clients.length} clients, ${checkIns.length} check-ins).`);
} else {
  console.log(JSON.stringify(out, null, 2));
}
