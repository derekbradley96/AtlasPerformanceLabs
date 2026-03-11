/**
 * DB query wrappers. All outputs validated with Zod; parse errors logged.
 * Uses mock data + adapters when Supabase not in use.
 */
import { clients, checkIns, threads } from '../../data/mockData';
import { getLeadsForTrainer, createLead } from '../leadsStore';
import { getEarningsForPeriod } from '../earningsMock';
import { setClientPhase } from '../clientPhaseStore';
import {
  clientSchema,
  checkinSchema,
  messageThreadSchema,
  leadSchema,
  paymentInvoiceSchema,
} from '../models';
import {
  adaptClientFromMock,
  adaptCheckinFromMock,
  adaptMessageThreadFromMock,
  adaptLeadFromMock,
  adaptInvoiceFromMock,
} from '../models/adapters';

const LOG = (msg: string, err?: unknown) => {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[db/queries]', msg, err ?? '');
  }
};

function parseArray<T>(items: unknown[], parseOne: (r: Record<string, unknown>) => { success: boolean; data?: T }, label: string): T[] {
  const out: T[] = [];
  for (const row of items) {
    const result = parseOne(row as Record<string, unknown>);
    if (result.success && result.data != null) out.push(result.data);
    else LOG(`${label} parse failed`, result);
  }
  return out;
}

/** getClientsByTrainer(trainerId) – validated Client[] */
export function getClientsByTrainer(trainerId: string) {
  const raw = (clients as Record<string, unknown>[]).filter((c) => c.trainer_id === trainerId);
  return parseArray(raw, (r) => adaptClientFromMock(r), 'Client');
}

/** getClientDetail(clientId) – single Client or null */
export function getClientDetail(clientId: string) {
  const raw = (clients as Record<string, unknown>[]).find((c) => c.id === clientId);
  if (!raw) return null;
  const result = adaptClientFromMock(raw);
  if (!result.success) {
    LOG('getClientDetail parse failed', result);
    return null;
  }
  return result.data ?? null;
}

/** getCheckins(clientId, limit) – validated CheckIn[] */
export function getCheckins(clientId: string, limit = 50) {
  const raw = (checkIns as Record<string, unknown>[]).filter((c) => c.client_id === clientId);
  const sorted = raw.sort((a, b) => {
    const da = (a.created_date ?? a.created_at) as string;
    const db = (b.created_date ?? b.created_at) as string;
    return new Date(db).getTime() - new Date(da).getTime();
  });
  const slice = sorted.slice(0, limit);
  return parseArray(slice, (r) => adaptCheckinFromMock(r), 'CheckIn');
}

/** getInvoices(trainerId, range) – range optional { from, to } date strings. Validated PaymentInvoice[] */
export function getInvoices(trainerId: string, range?: { from: string; to: string }) {
  const mockInvoices = buildMockInvoicesFromEarnings(trainerId);
  let list = mockInvoices;
  if (range?.from && range?.to) {
    list = list.filter((i) => i.due_date >= range.from && i.due_date <= range.to);
  }
  const out: ReturnType<typeof paymentInvoiceSchema.parse>[] = [];
  for (const row of list) {
    const result = adaptInvoiceFromMock(row as Record<string, unknown>);
    if (result.success && result.data) out.push(result.data);
    else LOG('Invoice parse failed', result);
  }
  return out;
}

function buildMockInvoicesFromEarnings(trainerId: string): Record<string, unknown>[] {
  const period = getEarningsForPeriod('this_month');
  const txs = period.transactions ?? [];
  const clientsList = clients as Record<string, unknown>[];
  return txs.map((t: Record<string, unknown>, i: number) => ({
    id: (t as { id?: string }).id ?? `inv-${i}`,
    trainer_id: trainerId,
    client_id: clientsList[0]?.id ?? 'client-1',
    amount: t.amount,
    currency: 'GBP',
    status: t.status,
    due_date: t.date,
    paid_at: t.status === 'paid' ? t.date : null,
    stripe_payment_intent_id: null,
  }));
}

/** getLeads(trainerId, status?) – validated Lead[] */
export function getLeads(trainerId: string, status?: string) {
  const raw = getLeadsForTrainer(trainerId) as Record<string, unknown>[];
  let list = raw;
  if (status) list = raw.filter((r) => r.status === status);
  return parseArray(list, (r) => adaptLeadFromMock(r), 'Lead');
}

const PHASE_DISPLAY: Record<string, string> = { bulk: 'Bulk', cut: 'Cut', maintenance: 'Maintenance' };

/** upsertClientPhase(clientId, phase) – updates phase in store; for real DB would be update. */
export function upsertClientPhase(clientId: string, phase: 'bulk' | 'cut' | 'maintenance') {
  const payload = { id: clientId, trainer_id: '', name: '', phase, created_at: new Date().toISOString() };
  const result = clientSchema.safeParse(payload);
  if (!result.success) {
    LOG('upsertClientPhase validation failed', result.error);
    return null;
  }
  setClientPhase(clientId, PHASE_DISPLAY[phase] ?? 'Maintenance');
  return result.data;
}

/** createLeadFromFunnel(payload) – validate and persist lead. */
export function createLeadFromFunnel(payload: {
  trainer_id?: string;
  trainerSlug?: string;
  name?: string;
  email?: string;
  source?: string;
  goal?: string;
  phase?: string;
  gymName?: string;
  availability?: string;
  notes?: string;
}) {
  const leadPayload = {
    id: `lead-${Date.now()}`,
    trainer_id: payload.trainer_id ?? '',
    status: 'new' as const,
    source: payload.source ?? 'join_link',
    name: payload.name ?? null,
    email: payload.email ?? null,
    phone: null,
    instagram: null,
    goals_json: payload.goal ? { goal: payload.goal } : null,
    created_at: new Date().toISOString(),
  };
  const result = leadSchema.safeParse(leadPayload);
  if (!result.success) {
    LOG('createLeadFromFunnel validation failed', result.error);
    return null;
  }
  createLead({
    trainerId: payload.trainer_id ?? null,
    trainerSlug: payload.trainerSlug ?? '',
    name: payload.name ?? '',
    email: payload.email ?? '',
    goal: payload.goal ?? '',
    phase: payload.phase ?? '',
    gymName: payload.gymName ?? '',
    availability: payload.availability ?? '',
    notes: payload.notes ?? '',
    source: payload.source ?? 'join_link',
  });
  return result.data;
}

/** getMessageThreadsForTrainer(trainerId) – validated MessageThread[] */
export function getMessageThreadsForTrainer(trainerId: string) {
  const raw = (threads as Record<string, unknown>[]).filter((t) => t.trainer_id === trainerId);
  return parseArray(raw, (r) => adaptMessageThreadFromMock(r), 'MessageThread');
}
