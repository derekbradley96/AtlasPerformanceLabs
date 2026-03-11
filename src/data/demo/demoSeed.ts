/**
 * Demo seed: realistic trainer account data for sandbox mode.
 * Used when no persisted demo state exists; matches DemoState shape from demoStore.
 */

const DEMO_TRAINER_ID = 'demo-trainer';

export interface DemoSeedCoach {
  id: string;
  name: string;
  email: string;
  plan_tier: string;
  stripe_connected: boolean;
}

export interface DemoSeedClient {
  id: string;
  name: string;
  goal: 'bulk' | 'cut' | 'maintain';
  phase: string;
  show_date?: string | null;
  federation?: string | null;
  gym_equipment?: string[];
  start_date: string;
  [key: string]: unknown;
}

export interface DemoSeedCheckIn {
  id: string;
  client_id: string;
  trainer_id: string;
  status: 'pending' | 'submitted';
  created_date: string;
  submitted_at?: string | null;
  weight?: number | null;
  steps_avg?: number | null;
  sleep_avg?: number | null;
  adherence?: number | null;
  digestion?: number | null;
  pumps?: number | null;
  stress?: number | null;
  mood?: number | null;
  [key: string]: unknown;
}

export interface DemoSeedMessage {
  id: string;
  client_id: string;
  sender: 'trainer' | 'client';
  body: string;
  created_date: string;
  delivered?: boolean;
  read?: boolean;
  [key: string]: unknown;
}

export interface DemoSeedProgram {
  id: string;
  trainer_id: string;
  client_id?: string | null;
  name: string;
  goal?: string;
  is_template?: boolean;
  duration_weeks?: number;
  days_per_week?: number;
  days?: Array<{ id: string; dayName: string; exercises: Array<{ id: string; name: string; sets?: number; reps?: number; rir?: number }> }>;
  created_date?: string;
  updated_date?: string;
  next_workout_title?: string | null;
  [key: string]: unknown;
}

import type { DemoState, DemoCheckIn, DemoMessage, DemoThread, DemoProgram } from './demoStore';

/** Returns full demo state compatible with demoStore.DemoState. */
export function createDemoSeed(): DemoState {
  const now = new Date().toISOString();
  const coach = {
    id: 'demo-coach',
    full_name: 'Demo Coach',
    trainer_id: DEMO_TRAINER_ID,
    name: 'Demo Coach',
    email: 'demo@atlasperformancelabs.app',
    plan_tier: 'pro',
    stripe_connected: false,
  };

  const clientSpecs: Array<{
    name: string;
    goal: 'bulk' | 'cut' | 'maintain';
    phase: string;
    show_date?: string | null;
    federation?: string | null;
    division?: string | null;
    prepPhase?: string | null;
    gym_equipment?: string[];
    status: 'on_track' | 'needs_review' | 'attention';
    payment_overdue?: boolean;
  }> = [
    { name: 'Alex Morgan', goal: 'maintain', phase: 'Offseason', status: 'on_track', federation: 'NPC', division: 'Mens Physique', gym_equipment: ['Full Gym', 'Barbell'] },
    { name: 'Jordan Lee', goal: 'bulk', phase: 'Prep', show_date: '2025-06-14', federation: 'NPC', prepPhase: 'prep', gym_equipment: ['Full Gym'], status: 'needs_review' },
    { name: 'Sam Taylor', goal: 'cut', phase: 'Cut', status: 'attention', payment_overdue: true, gym_equipment: ['Home', 'Dumbbells'] },
    { name: 'Casey Kim', goal: 'bulk', phase: 'Peak Week', show_date: '2025-03-22', federation: 'IFBB', division: 'Bikini', prepPhase: 'peak', gym_equipment: ['Full Gym', 'Cable'], status: 'on_track' },
    { name: 'Riley Davis', goal: 'maintain', phase: 'Offseason', status: 'attention', gym_equipment: ['Full Gym'] },
    { name: 'Morgan Reed', goal: 'maintain', phase: 'Maintenance', status: 'on_track', gym_equipment: ['Home'] },
    { name: 'Jamie Fox', goal: 'cut', phase: 'Prep', show_date: '2025-05-10', federation: 'NPC', prepPhase: 'prep', status: 'needs_review', gym_equipment: ['Full Gym', 'Kettlebells'] },
    { name: 'Quinn Blake', goal: 'bulk', phase: 'Bulk', status: 'on_track', gym_equipment: ['Full Gym', 'Barbell'] },
    { name: 'Taylor Green', goal: 'cut', phase: 'Peak Week', show_date: '2025-04-05', federation: 'NPC', division: 'Figure', prepPhase: 'peak', status: 'needs_review', gym_equipment: ['Full Gym'] },
    { name: 'Jordan Wright', goal: 'maintain', phase: 'Offseason', status: 'on_track', gym_equipment: ['Full Gym', 'Dumbbells'] },
  ];

  const clients = clientSpecs.map((s, i) => {
    const id = `demo-c${i + 1}`;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (i % 4) - 1);
    return {
      id,
      trainer_id: DEMO_TRAINER_ID,
      full_name: s.name,
      name: s.name,
      email: `${s.name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      goal: s.goal,
      phase: s.phase,
      showDate: s.show_date ?? null,
      federation: s.federation ?? null,
      division: s.division ?? null,
      prepPhase: s.prepPhase ?? (s.show_date ? 'prep' : null),
      status: s.status,
      payment_overdue: s.payment_overdue ?? false,
      last_check_in_at: i % 3 !== 0 ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      created_date: startDate.toISOString(),
      start_date: startDate.toISOString().slice(0, 10),
      gym_equipment: s.gym_equipment ?? [],
    };
  });

  const checkIns: DemoCheckIn[] = [];
  clients.forEach((c, i) => {
    const base = new Date();
    base.setDate(base.getDate() - 7);
    const week2 = base.toISOString();
    base.setDate(base.getDate() - 7);
    const week1 = base.toISOString();
    const w = 70 + (i % 5);
    checkIns.push(
      {
        id: `demo-ch-${c.id}-1`,
        client_id: c.id,
        trainer_id: DEMO_TRAINER_ID,
        status: 'submitted',
        created_date: week2,
        submitted_at: week2,
        weight_kg: w,
        steps: 10000 + i * 500,
        sleep_hours: 7 + (i % 3) * 0.5,
        adherence_pct: 85 + (i % 3) * 5,
        notes: 'Feeling good',
        flags: [],
        metrics: { digestion: 4, pumps: 4, stress: 3, mood: 4 },
      },
      {
        id: `demo-ch-${c.id}-2`,
        client_id: c.id,
        trainer_id: DEMO_TRAINER_ID,
        status: i % 3 === 0 ? 'submitted' : 'pending',
        created_date: week1,
        submitted_at: i % 3 === 0 ? week1 : undefined,
        weight_kg: i % 3 === 0 ? w + 0.3 : null,
        steps: null,
        sleep_hours: null,
        adherence_pct: i % 3 === 0 ? 92 : null,
        notes: null,
        flags: [],
        metrics: i % 3 === 0 ? { digestion: 5, pumps: 4, stress: 2, mood: 5 } : undefined,
      }
    );
  });

  const messages: DemoMessage[] = [];
  const messageBodies: [string, string][] = [
    ['When is our next check-in?', 'How about Friday?'],
    ['Quick question about the program', 'Sure, what’s up?'],
    ['Payment failed – can you retry?', 'I’ll send a new link.'],
    ['All good this week', 'Keep it up.'],
    ['Thanks for the program update!', 'Anytime.'],
    ['Should I deload this week?', 'Yes, take 70% for 3 days.'],
    ['Posing photos uploaded', 'I’ll review by tomorrow.'],
    ['Ready for peak week', 'Stick to the plan.'],
  ];
  clients.forEach((c, idx) => {
    const t = new Date();
    t.setMinutes(t.getMinutes() - idx * 25);
    const iso = t.toISOString();
    const [q, a] = messageBodies[idx % messageBodies.length];
    messages.push(
      { id: `demo-msg-${c.id}-1`, client_id: c.id, sender: 'client', body: q, created_date: iso, read_at: iso },
      { id: `demo-msg-${c.id}-2`, client_id: c.id, sender: 'trainer', body: a, created_date: iso, read_at: idx % 2 === 0 ? iso : null }
    );
  });

  const threads: DemoThread[] = clients.map((c, i) => {
    const lastMsg = messages.filter((m) => m.client_id === c.id).sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
    const unread = i < 6 ? (i % 2 === 0 ? 2 : 1) : 0;
    return {
      id: `thread-${c.id}`,
      client_id: c.id,
      trainer_id: DEMO_TRAINER_ID,
      last_message_at: lastMsg?.created_date ?? null,
      last_message_preview: lastMsg?.body?.slice(0, 40) ?? '',
      unread_count: unread,
    };
  });

  const programTemplates: DemoProgram[] = [
    {
      id: 'demo-prog-t1',
      trainer_id: DEMO_TRAINER_ID,
      client_id: null,
      name: 'Strength Foundation',
      goal: 'strength',
      is_template: true,
      duration_weeks: 8,
      days_per_week: 4,
      created_date: now,
      updated_date: now,
      days: [
        { id: 'd1', dayName: 'Day A', exercises: [{ id: 'e1', name: 'Squat', sets: 4, reps: 6 }] },
        { id: 'd2', dayName: 'Day B', exercises: [{ id: 'e2', name: 'Bench Press', sets: 4, reps: 6 }] },
      ],
    },
    {
      id: 'demo-prog-t2',
      trainer_id: DEMO_TRAINER_ID,
      client_id: null,
      name: 'Hypertrophy Block',
      goal: 'hypertrophy',
      is_template: true,
      duration_weeks: 12,
      days_per_week: 5,
      created_date: now,
      updated_date: now,
      days: [
        { id: 'd3', dayName: 'Upper', exercises: [{ id: 'e3', name: 'DB Press', sets: 3, reps: 10 }] },
        { id: 'd4', dayName: 'Lower', exercises: [{ id: 'e4', name: 'Leg Press', sets: 3, reps: 12 }] },
      ],
    },
  ];
  const programs: DemoProgram[] = [...programTemplates];
  clients.forEach((c, i) => {
    const t = programTemplates[i % 2];
    programs.push({
      ...t,
      id: `demo-prog-${c.id}`,
      client_id: c.id,
      is_template: false,
      created_date: now,
      updated_date: now,
      next_workout_title: 'Upper Push',
    });
  });

  const compPrepProfiles = clients
    .filter((c) => c.showDate || c.federation)
    .map((c) => ({ clientId: c.id, federation: c.federation ?? null, division: null, prepPhase: c.prepPhase ?? null, showDate: c.showDate ?? null }));

  const posingSubmissions: DemoState['posingSubmissions'] = [
    { id: 'demo-pose-1', client_id: clients[1].id, pose_type: 'front_relaxed', status: 'pending', submitted_at: now, created_date: now },
    { id: 'demo-pose-2', client_id: clients[3].id, pose_type: 'side_chest', status: 'pending', submitted_at: now, created_date: now },
  ];

  const payments = clients.map((c, i) => ({
    id: `demo-pay-${c.id}`,
    client_id: c.id,
    trainer_id: DEMO_TRAINER_ID,
    status: c.payment_overdue ? 'overdue' : (i % 5 === 0 ? 'pending' : 'paid'),
    amount: 120,
    due_date: new Date().toISOString().slice(0, 10),
    paid_at: c.payment_overdue ? null : new Date().toISOString().slice(0, 10),
  }));

  return {
    coach,
    clients,
    checkIns,
    messages,
    threads,
    programs,
    compPrepProfiles,
    posingSubmissions,
    payments,
    reviewCompleted: [],
    threadReadAt: {},
  };
}
