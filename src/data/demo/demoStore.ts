/**
 * Demo mode sandbox: persisted dataset (localStorage) for a realistic coach experience.
 * Key: atlas_demo_dataset_v1
 * Uses safe storage helpers so invalid JSON never crashes the app; auto-resets to seed.
 */

import { safeGetJson, safeSetJson } from '@/lib/storageSafe';
import { createDemoSeed } from './demoSeed';

const DEMO_STORAGE_KEY = 'atlas_demo_dataset_v1';
const DEMO_TRAINER_ID = 'demo-trainer';

export interface DemoClient {
  id: string;
  user_id?: string;
  trainer_id: string;
  full_name: string;
  email?: string;
  subscription_status?: string;
  status?: 'on_track' | 'needs_review' | 'attention';
  payment_overdue?: boolean;
  last_check_in_at?: string | null;
  phase?: string;
  phaseStartedAt?: string;
  baselineWeight?: number;
  baselineStrength?: Record<string, number>;
  created_date?: string;
  federation?: string | null;
  division?: string | null;
  prepPhase?: string | null;
  showDate?: string | null;
  [key: string]: unknown;
}

export interface DemoCheckIn {
  id: string;
  client_id: string;
  trainer_id: string;
  status: 'pending' | 'submitted';
  created_date: string;
  submitted_at?: string | null;
  week_start?: string;
  weight_kg?: number | null;
  notes?: string | null;
  steps?: number | null;
  adherence_pct?: number | null;
  sleep_hours?: number | null;
  flags?: string[];
  [key: string]: unknown;
}

export interface DemoMessage {
  id: string;
  client_id: string;
  sender: 'trainer' | 'client';
  body: string;
  created_date: string;
  read_at?: string | null;
  [key: string]: unknown;
}

export interface DemoThread {
  id: string;
  client_id: string;
  trainer_id: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_count: number;
  [key: string]: unknown;
}

export interface DemoProgram {
  id: string;
  baseId?: string;
  trainer_id?: string;
  client_id?: string | null;
  name: string;
  goal?: string;
  duration_weeks?: number;
  difficulty?: string;
  is_template?: boolean;
  created_date?: string;
  updated_date?: string;
  days_per_week?: number;
  next_workout_title?: string | null;
  [key: string]: unknown;
}

export interface DemoCompPrepProfile {
  clientId: string;
  federation?: string | null;
  division?: string | null;
  prepPhase?: string | null;
  showDate?: string | null;
  [key: string]: unknown;
}

export interface DemoPosingSubmission {
  id: string;
  client_id: string;
  media_id?: string;
  pose_type?: string;
  status?: string;
  submitted_at?: string;
  created_date?: string;
  [key: string]: unknown;
}

export interface DemoState {
  coach: { id: string; full_name: string; trainer_id: string };
  clients: DemoClient[];
  checkIns: DemoCheckIn[];
  messages: DemoMessage[];
  threads: DemoThread[];
  programs: DemoProgram[];
  compPrepProfiles: DemoCompPrepProfile[];
  posingSubmissions: DemoPosingSubmission[];
  payments: Array<{ id: string; client_id: string; trainer_id: string; status: string; amount: number; due_date?: string; paid_at?: string | null }>;
  /** Check-in IDs or item keys marked reviewed/done in this session */
  reviewCompleted: string[];
  /** Thread IDs (client_id) marked read */
  threadReadAt: Record<string, string>;
}

/** Return true if value looks like a valid DemoState (has clients array). */
function isValidDemoState(value: unknown): value is DemoState {
  return value != null && typeof value === 'object' && Array.isArray((value as DemoState).clients);
}

/** Clear persisted demo dataset (e.g. before reseed or exit demo). Dispatches atlas-demo-dataset-updated so UI refetches fresh seed. */
export function resetDemoState(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(DEMO_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('atlas-demo-dataset-updated'));
    }
  } catch {}
}

/** Load demo state from localStorage; returns seed when none or invalid. Persists fresh seed when invalid. */
export function loadDemoState(): DemoState {
  return getDemoState();
}

export function getDemoState(): DemoState {
  const fallback = createDemoSeed();
  const stored = safeGetJson<DemoState | null>(DEMO_STORAGE_KEY, null);
  if (!stored || !isValidDemoState(stored)) {
    saveDemoState(fallback);
    return fallback;
  }
  return {
    coach: stored.coach && typeof stored.coach === 'object' ? stored.coach : fallback.coach,
    clients: Array.isArray(stored.clients) ? stored.clients : fallback.clients,
    checkIns: Array.isArray(stored.checkIns) ? stored.checkIns : fallback.checkIns,
    messages: Array.isArray(stored.messages) ? stored.messages : fallback.messages,
    threads: Array.isArray(stored.threads) ? stored.threads : fallback.threads,
    programs: Array.isArray(stored.programs) ? stored.programs : fallback.programs,
    compPrepProfiles: Array.isArray(stored.compPrepProfiles) ? stored.compPrepProfiles : fallback.compPrepProfiles,
    posingSubmissions: Array.isArray(stored.posingSubmissions) ? stored.posingSubmissions : fallback.posingSubmissions,
    payments: Array.isArray(stored.payments) ? stored.payments : fallback.payments,
    reviewCompleted: Array.isArray(stored.reviewCompleted) ? stored.reviewCompleted : fallback.reviewCompleted,
    threadReadAt: stored.threadReadAt && typeof stored.threadReadAt === 'object' ? stored.threadReadAt : fallback.threadReadAt,
  };
}

export function saveDemoState(state: DemoState): void {
  safeSetJson(DEMO_STORAGE_KEY, state);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('atlas-demo-dataset-updated'));
}

export function addDemoClient(client: Omit<DemoClient, 'id' | 'trainer_id' | 'created_date'>): DemoClient {
  const state = getDemoState();
  const id = `demo-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const newClient: DemoClient = {
    id,
    trainer_id: DEMO_TRAINER_ID,
    created_date: now,
    full_name: (client.full_name ?? 'New Client') as string,
    email: typeof client.email === 'string' ? client.email : undefined,
    status: 'on_track',
    payment_overdue: false,
    phase: (client.phase ?? 'Maintenance') as string,
    showDate: client.showDate != null ? String(client.showDate) : null,
    federation: client.federation != null ? String(client.federation) : null,
    division: client.division != null ? String(client.division) : null,
    prepPhase: client.prepPhase != null ? String(client.prepPhase) : null,
    ...client,
  };
  state.clients = [...state.clients, newClient];
  state.threads = [...state.threads, { id: `thread-${id}`, client_id: id, trainer_id: DEMO_TRAINER_ID, last_message_at: null, last_message_preview: '', unread_count: 0 }];
  saveDemoState(state);
  return newClient;
}

export function updateDemoClient(id: string, patch: Partial<DemoClient>): DemoClient | null {
  const state = getDemoState();
  const idx = state.clients.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...state.clients[idx], ...patch };
  state.clients = [...state.clients];
  state.clients[idx] = updated;
  saveDemoState(state);
  return updated;
}

export function removeDemoClient(id: string): void {
  const state = getDemoState();
  state.clients = state.clients.filter((c) => c.id !== id);
  state.checkIns = state.checkIns.filter((c) => c.client_id !== id);
  state.messages = state.messages.filter((m) => m.client_id !== id);
  state.threads = state.threads.filter((t) => t.client_id !== id);
  state.programs = state.programs.filter((p) => p.client_id !== id);
  state.compPrepProfiles = state.compPrepProfiles.filter((p) => p.clientId !== id);
  state.posingSubmissions = state.posingSubmissions.filter((p) => p.client_id !== id);
  state.payments = state.payments.filter((p) => p.client_id !== id);
  saveDemoState(state);
}

export function addDemoMessage(threadIdOrClientId: string, message: { sender: 'trainer' | 'client'; body: string }): DemoMessage {
  const state = getDemoState();
  const clientId = state.threads.some((t) => t.id === threadIdOrClientId) ? state.threads.find((t) => t.id === threadIdOrClientId)!.client_id : threadIdOrClientId;
  const id = `demo-msg-${clientId}-${Date.now()}`;
  const now = new Date().toISOString();
  const newMsg: DemoMessage = { id, client_id: clientId, sender: message.sender, body: message.body, created_date: now };
  state.messages = [...state.messages, newMsg];
  const thread = state.threads.find((t) => t.client_id === clientId);
  if (thread) {
    thread.last_message_at = now;
    thread.last_message_preview = message.body.slice(0, 50);
    if (message.sender === 'client') thread.unread_count = (thread.unread_count ?? 0) + 1;
  }
  saveDemoState(state);
  return newMsg;
}

export function markThreadRead(threadIdOrClientId: string): void {
  const state = getDemoState();
  const thread = state.threads.find((t) => t.id === threadIdOrClientId || t.client_id === threadIdOrClientId);
  if (thread) {
    thread.unread_count = 0;
    state.threadReadAt = { ...state.threadReadAt, [thread.client_id]: new Date().toISOString() };
    saveDemoState(state);
  }
}

/** Mark every thread as read. Dispatches atlas-demo-dataset-updated so UI refreshes. */
export function markAllThreadsRead(): void {
  const state = getDemoState();
  const now = new Date().toISOString();
  state.threads.forEach((t) => {
    t.unread_count = 0;
    if (t.client_id) state.threadReadAt = { ...state.threadReadAt, [t.client_id]: now };
  });
  saveDemoState(state);
}

export function addDemoCheckIn(clientId: string, checkIn: Omit<DemoCheckIn, 'id' | 'client_id' | 'trainer_id'>): DemoCheckIn {
  const state = getDemoState();
  const id = `demo-ch-${clientId}-${Date.now()}`;
  const newCh: DemoCheckIn = {
    id,
    client_id: clientId,
    trainer_id: DEMO_TRAINER_ID,
    status: checkIn.status ?? 'submitted',
    created_date: checkIn.created_date ?? new Date().toISOString(),
    ...checkIn,
  };
  state.checkIns = [...state.checkIns, newCh];
  const client = state.clients.find((c) => c.id === clientId);
  if (client) {
    const val = checkIn.submitted_at ?? checkIn.created_date;
    client.last_check_in_at = typeof val === 'string' ? val : undefined;
  }
  saveDemoState(state);
  return newCh;
}

export function markReviewItemComplete(id: string): void {
  const state = getDemoState();
  if (!state.reviewCompleted.includes(id)) {
    state.reviewCompleted = [...state.reviewCompleted, id];
    saveDemoState(state);
  }
}

/** Alias for markReviewItemComplete for useData API. */
export function completeReviewItem(id: string): void {
  markReviewItemComplete(id);
}

export function assignProgramToClient(clientId: string, programId: string): void {
  const state = getDemoState();
  const prog = state.programs.find((p) => p.id === programId);
  const template = state.programs.find((p) => p.id === programId && p.is_template);
  const now = new Date().toISOString();
  if (template) {
    state.programs = [...state.programs, { ...template, id: `demo-prog-${clientId}-${Date.now()}`, client_id: clientId, is_template: false, created_date: now, updated_date: now }];
  } else if (prog) {
    const idx = state.programs.findIndex((p) => p.id === programId);
    state.programs = [...state.programs];
    state.programs[idx] = { ...state.programs[idx], client_id: clientId };
  }
  saveDemoState(state);
}

/** Review items for Inbox: check-ins needing review, overdue payments, unread threads, posing submissions. One consolidated comp prep card. */
export interface DemoReviewItem {
  id: string;
  type: string;
  clientId: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: string };
  priorityScore: number;
  primaryAction?: { label: string; type: string; checkinId?: string; clientId?: string };
  createdAt?: string;
  [key: string]: unknown;
}

export function getDemoInboxItems(): { active: DemoReviewItem[]; waiting: DemoReviewItem[]; done: DemoReviewItem[] } {
  const state = getDemoState();
  const active: DemoReviewItem[] = [];
  const done: DemoReviewItem[] = [];

  const itemKey = (type: string, id: string) => `${type}_${id}`;
  const needsReviewCheckIns = state.checkIns.filter((c) => c.status === 'submitted' && !state.reviewCompleted.includes(c.id));
  needsReviewCheckIns.forEach((c) => {
    const client = state.clients.find((cl) => cl.id === c.client_id);
    active.push({
      id: c.id,
      itemKey: itemKey('CHECKIN_REVIEW', c.id),
      type: 'CHECKIN_REVIEW',
      clientId: c.client_id,
      title: client?.full_name ?? 'Check-in',
      subtitle: `Weight ${c.weight_kg ?? '—'} kg · Needs review`,
      badge: { label: 'Review', tone: 'warning' },
      priorityScore: 75,
      primaryAction: { label: 'Review', type: 'review_checkin', checkinId: c.id },
      createdAt: c.submitted_at ?? c.created_date,
    });
  });

  state.clients.filter((c) => c.payment_overdue).forEach((c) => {
    const id = `payment-${c.id}`;
    active.push({
      id,
      itemKey: itemKey('PAYMENT_OVERDUE', id),
      type: 'PAYMENT_OVERDUE',
      clientId: c.id,
      title: c.full_name,
      subtitle: 'Payment overdue',
      badge: { label: 'Payment', tone: 'danger' },
      priorityScore: 85,
      primaryAction: { label: 'Send reminder', type: 'open_messages', clientId: c.id },
      createdAt: c.last_check_in_at ?? c.created_date,
    });
  });

  state.threads.filter((t) => (t.unread_count ?? 0) > 0).forEach((t) => {
    const client = state.clients.find((c) => c.id === t.client_id);
    active.push({
      id: t.id,
      itemKey: itemKey('UNREAD_MESSAGE', t.id),
      type: 'UNREAD_MESSAGE',
      clientId: t.client_id,
      title: client?.full_name ?? 'Message',
      subtitle: (t.last_message_preview ?? '').slice(0, 50),
      badge: { label: `${t.unread_count} unread`, tone: 'info' },
      priorityScore: 40,
      primaryAction: { label: 'Open', type: 'open_messages', clientId: t.client_id },
      createdAt: t.last_message_at ?? undefined,
    });
  });

  const pendingPosing = state.posingSubmissions.filter((p) => p.status === 'pending');
  if (pendingPosing.length > 0) {
    const clientIds = [...new Set(pendingPosing.map((p) => p.client_id))];
    const names = clientIds.map((cid) => state.clients.find((c) => c.id === cid)?.full_name ?? 'Client').join(', ');
    active.push({
      id: 'demo-posing-review',
      itemKey: itemKey('POSING_SUBMISSION_REVIEW', 'demo-posing-review'),
      type: 'POSING_SUBMISSION_REVIEW',
      clientId: clientIds[0],
      title: 'Posing submissions',
      subtitle: `${pendingPosing.length} from ${names}`,
      badge: { label: 'Comp Prep', tone: 'warning' },
      priorityScore: 70,
      primaryAction: { label: 'Review', type: 'open_client', clientId: clientIds[0] },
      createdAt: pendingPosing[0].submitted_at ?? pendingPosing[0].created_date,
    });
  }

  const compWithShow = state.clients.filter((c) => c.showDate);
  if (compWithShow.length > 0) {
    const daysOut = compWithShow.map((c) => {
      const d = c.showDate ? Math.ceil((new Date(c.showDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
      return { name: c.full_name, days: d };
    });
    const next = daysOut.filter((d) => d.days != null && d.days >= 0).sort((a, b) => (a.days ?? 999) - (b.days ?? 999))[0];
    active.push({
      id: 'demo-comp-prep-card',
      itemKey: itemKey('PEAK_WEEK_DUE', 'demo-comp-prep-card'),
      type: 'PEAK_WEEK_DUE',
      clientId: compWithShow[0].id,
      title: 'Comp Prep',
      subtitle: next ? `${next.name}: ${next.days} days out` : 'Show dates set',
      badge: { label: 'Comp Prep', tone: 'warning' },
      priorityScore: 65,
      primaryAction: { label: 'View', type: 'open_client', clientId: compWithShow[0].id },
      createdAt: compWithShow[0].showDate ?? undefined,
    });
  }

  active.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  return { active, waiting: [], done };
}

export { DEMO_STORAGE_KEY };
