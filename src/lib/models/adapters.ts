/**
 * Map existing mock/API shapes to canonical models. Use for backward compatibility.
 */
import { clientSchema } from './client';
import { checkinSchema } from './checkin';
import { messageThreadSchema } from './messageThread';
import { leadSchema } from './lead';
import { paymentInvoiceSchema } from './invoice';

const PHASE_MAP: Record<string, 'bulk' | 'cut' | 'maintenance'> = {
  bulk: 'bulk',
  cut: 'cut',
  maintenance: 'maintenance',
  'lean bulk': 'bulk',
  leanbulk: 'bulk',
  recomp: 'maintenance',
};

function toPhase(phase: unknown): 'bulk' | 'cut' | 'maintenance' {
  if (!phase || typeof phase !== 'string') return 'maintenance';
  const key = String(phase).toLowerCase().replace(/\s/g, '');
  return PHASE_MAP[key] ?? 'maintenance';
}

/** Mock client row -> Client */
export function adaptClientFromMock(row: Record<string, unknown>) {
  const payload = {
    id: row.id,
    trainer_id: row.trainer_id ?? '',
    name: row.full_name ?? row.name ?? '',
    phase: toPhase(row.phase),
    phase_started_at: row.phaseStartedAt ?? row.phase_started_at ?? null,
    baseline_weight: row.baselineWeight ?? row.baseline_weight ?? null,
    gym_name: row.gym_name ?? null,
    gym_equipment_json: row.gym_equipment_json ?? null,
    created_at: row.created_date ?? row.created_at ?? new Date().toISOString(),
  };
  return clientSchema.safeParse(payload);
}

/** Mock checkin row -> CheckIn (canonical type from @/data/models). */
export function adaptCheckinFromMock(row: Record<string, unknown>) {
  const payload = {
    id: row.id,
    client_id: row.client_id,
    created_at: row.created_date ?? row.created_at ?? new Date().toISOString(),
    weight_avg: row.weight_kg ?? row.weight_avg ?? null,
    adherence_pct: row.adherence_pct ?? null,
    steps_avg: row.steps ?? row.steps_avg ?? null,
    sleep_avg: row.sleep_hours ?? row.sleep_avg ?? null,
    notes: row.notes ?? null,
  };
  return checkinSchema.safeParse(payload);
}

/** Mock thread -> MessageThread */
export function adaptMessageThreadFromMock(row: Record<string, unknown>) {
  const payload = {
    id: row.id ?? row.client_id,
    client_id: row.client_id,
    trainer_id: row.trainer_id ?? undefined,
    unread_count: typeof row.unread_count === 'number' ? row.unread_count : 0,
  };
  return messageThreadSchema.safeParse(payload);
}

/** Mock/leadsStore lead -> Lead */
export function adaptLeadFromMock(row: Record<string, unknown>) {
  const status = row.status ?? 'new';
  const validStatus = ['new', 'contacted', 'booked', 'converted', 'lost'].includes(String(status))
    ? status
    : 'new';
  const payload = {
    id: row.id,
    trainer_id: row.trainerId ?? row.trainer_id ?? '',
    status: validStatus,
    source: row.source ?? 'join_link',
    name: row.name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    instagram: row.instagram ?? null,
    goals_json: row.goal ? { goal: row.goal } : null,
    created_at: row.created_date ?? row.created_at ?? new Date().toISOString(),
  };
  return leadSchema.safeParse(payload);
}

/** Build PaymentInvoice from mock/API row */
export function adaptInvoiceFromMock(row: Record<string, unknown>) {
  const status = row.status ?? 'pending';
  const validStatus = ['draft', 'pending', 'paid', 'overdue'].includes(String(status))
    ? status
    : 'pending';
  const payload = {
    id: row.id,
    trainer_id: row.trainer_id ?? '',
    client_id: row.client_id ?? '',
    amount: Number(row.amount) || 0,
    currency: row.currency ?? 'GBP',
    status: validStatus,
    due_date: row.due_date ?? row.dueDate ?? new Date().toISOString().slice(0, 10),
    paid_at: row.paid_at ?? row.paidAt ?? null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
  };
  return paymentInvoiceSchema.safeParse(payload);
}
