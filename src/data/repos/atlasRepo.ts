/**
 * Atlas data repo: single source for trainer-critical data.
 * - When isDemoMode: uses demo mocks only (mockData, programsStore seed, inviteCodeStore seed).
 * - When !isDemoMode and VITE_SUPABASE_URL set: fetches from Supabase Edge Functions (functions/v1/*).
 * - No localStorage-as-database except for demo or cached UI prefs.
 */
import type { Client, ReviewItem, Program, CheckIn, PaymentStatus } from '@/data/models';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import { getCoach as getCoachApi } from '@/lib/supabaseStripeApi';
import { SUPABASE_ENABLED } from '@/lib/config';
import { getSupabase } from '@/lib/supabaseClient';
import { buildSegmentedInbox } from '@/lib/inboxService';
import { listClients as supabaseListClients, getClientById as supabaseGetClientById } from '@/data/supabaseClientsRepo';
import { listForTrainer as supabaseListCheckinsForTrainer, listByClient as supabaseListCheckinsByClient } from '@/data/supabaseCheckinsRepo';
import { clients as mockClients, checkIns as mockCheckIns, payments as mockPayments, threads as mockThreads } from '@/data/mockData';
import { getStubClients } from '@/lib/clientStubStore';
import { getSeedClients, getSeedCheckIns } from '@/lib/seedClientStore';
import { getPrograms as getProgramsFromStore } from '@/lib/programsStore';
import { getOrCreateInviteCode, getPendingInvites } from '@/lib/inviteCodeStore';
import { logError } from '@/services/errorLogger';

/** @deprecated Use SUPABASE_ENABLED from @/lib/config */
function isSupabaseConfigured(): boolean {
  return SUPABASE_ENABLED;
}

function mapSupabaseClientRowToClient(row: Record<string, unknown>, fallbackTrainerId: string): Client {
  const tid = String(row.trainer_id ?? row.coach_id ?? fallbackTrainerId ?? '').trim();
  const nameRaw = String(row.name ?? row.full_name ?? '').trim();
  return {
    ...row,
    id: String(row.id ?? ''),
    trainer_id: tid,
    full_name: nameRaw || 'Client',
    email: row.email as string | undefined,
    subscription_status: (row.billing_status ?? row.subscription_status) as Client['subscription_status'],
    created_date: (row.created_at ?? row.created_date) as string | undefined,
  } as Client;
}

/** Clients for a trainer. Demo or sandbox (fake-trainer): mock + stub + seed filtered by trainer_id. Live: Supabase `clients`. */
export async function getClients(trainerId: string, isDemoMode: boolean): Promise<Client[]> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const list = [...mockClients, ...getStubClients(), ...getSeedClients()];
    return list.filter((c: { trainer_id?: string }) => c.trainer_id === trainerId) as Client[];
  }
  if (!SUPABASE_ENABLED) return [];
  try {
    const rows = await supabaseListClients(trainerId);
    return (Array.isArray(rows) ? rows : []).map((r) => mapSupabaseClientRowToClient(r as Record<string, unknown>, trainerId));
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { action: 'atlasRepo.getClients', trainerId });
    return [];
  }
}

/** Single client by id. Demo or sandbox: from getClients find. Live: Supabase `clients` (scoped to coach when trainerId is set). */
export async function getClientById(clientId: string, isDemoMode: boolean, trainerId?: string): Promise<Client | null> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const list = [...mockClients, ...getStubClients(), ...getSeedClients()];
    const c = list.find((x: { id: string }) => x.id === clientId);
    return (c as Client) ?? null;
  }
  if (!SUPABASE_ENABLED) return null;
  try {
    if (trainerId) {
      const row = await supabaseGetClientById(trainerId, clientId);
      return row ? mapSupabaseClientRowToClient(row as Record<string, unknown>, trainerId) : null;
    }
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    if (error || !data) return null;
    return mapSupabaseClientRowToClient(data as Record<string, unknown>, trainerId ?? '');
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { action: 'atlasRepo.getClientById', clientId, trainerId });
    return null;
  }
}

/** Programs (templates + assignments) for trainer. Demo + live: programsStore until program_blocks list is wired here. */
export async function getPrograms(trainerId: string, isDemoMode: boolean): Promise<Program[]> {
  void trainerId;
  void isDemoMode;
  return getProgramsFromStore() as unknown as Program[];
}

/** Check-ins for a client. Demo or sandbox: mockData.checkIns + seed. Live: Supabase `checkins`. */
export async function getCheckInsForClient(clientId: string, isDemoMode: boolean, trainerId?: string): Promise<CheckIn[]> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const mock = mockCheckIns.filter((c: { client_id: string }) => c.client_id === clientId);
    const seed = getSeedCheckIns().filter((c) => c.client_id === clientId);
    return [...mock, ...seed].sort(
      (a, b) => new Date((b.created_date || b.submitted_at) || 0).getTime() - new Date((a.created_date || a.submitted_at) || 0).getTime()
    ) as CheckIn[];
  }
  if (!SUPABASE_ENABLED) return [];
  try {
    let tid = trainerId;
    if (!tid) {
      const sb = getSupabase();
      if (!sb) return [];
      const { data: crow } = await sb.from('clients').select('trainer_id, coach_id').eq('id', clientId).maybeSingle();
      const r = crow as { trainer_id?: string; coach_id?: string } | null;
      tid = (r?.trainer_id || r?.coach_id || '') as string;
    }
    if (!tid) return [];
    const list = await supabaseListCheckinsByClient(tid, clientId);
    return list as CheckIn[];
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { action: 'atlasRepo.getCheckInsForClient', clientId });
    return [];
  }
}

/** Check-ins for a trainer (all clients). Demo or sandbox: mockData.checkIns + seed. Live: Supabase `checkins`. */
export async function getCheckInsForTrainer(trainerId: string, isDemoMode: boolean): Promise<CheckIn[]> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const mock = mockCheckIns.filter((c: { trainer_id: string }) => c.trainer_id === trainerId);
    const seed = getSeedCheckIns().filter((c) => c.trainer_id === trainerId);
    return [...mock, ...seed] as CheckIn[];
  }
  if (!SUPABASE_ENABLED) return [];
  try {
    const list = await supabaseListCheckinsForTrainer(trainerId);
    return list as CheckIn[];
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { action: 'atlasRepo.getCheckInsForTrainer', trainerId });
    return [];
  }
}

/** Inbox items (segmented). Demo + live: buildSegmentedInbox (local + Supabase-backed sources). */
export async function getInboxItems(
  trainerId: string,
  isDemoMode: boolean
): Promise<{ active: ReviewItem[]; waiting: ReviewItem[]; done: ReviewItem[] }> {
  if (isDemoMode) {
    const segmented = buildSegmentedInbox(trainerId);
    return {
      active: (segmented.active ?? []) as unknown as ReviewItem[],
      waiting: (segmented.waiting ?? []) as unknown as ReviewItem[],
      done: (segmented.done ?? []) as unknown as ReviewItem[],
    };
  }
  if (!isSupabaseConfigured()) return { active: [], waiting: [], done: [] };
  const segmented = buildSegmentedInbox(trainerId);
  return {
    active: (segmented.active ?? []) as unknown as ReviewItem[],
    waiting: (segmented.waiting ?? []) as unknown as ReviewItem[],
    done: (segmented.done ?? []) as unknown as ReviewItem[],
  };
}

/** Invite code for coach = profiles.referral_code so client can enter the same code. Demo: inviteCodeStore. Live: generateInviteCode (uses JWT). */
export async function getInviteCode(trainerId: string, isDemoMode: boolean): Promise<string> {
  if (isDemoMode) return getOrCreateInviteCode(trainerId);
  if (!isSupabaseConfigured()) return '';
  const { data, error } = await invokeSupabaseFunction('generateInviteCode', {});
  if (error) {
    const errUnknown = error as unknown;
    logError(errUnknown instanceof Error ? errUnknown : new Error(String((errUnknown as { message?: string })?.message || 'generateInviteCode failed')), {
      action: 'getInviteCode',
      trainerId,
    });
    return '';
  }
  if (!data) return '';
  const d = data as Record<string, unknown>;
  const code = (d?.code ?? '') as string;
  return typeof code === 'string' ? code.trim() : '';
}

const ENSURE_INVITE_DEFAULT_RETRIES = 5;
const ENSURE_INVITE_BASE_DELAY_MS = 350;

/**
 * Ensures a coach invite code exists (idempotent). Retries on transient failures / empty responses.
 */
export async function ensureCoachInviteCode(
  trainerId: string,
  isDemoMode: boolean,
  options?: { retries?: number },
): Promise<string> {
  const retries = Math.max(1, options?.retries ?? ENSURE_INVITE_DEFAULT_RETRIES);
  let last = '';
  for (let i = 0; i < retries; i++) {
    try {
      const code = await getInviteCode(trainerId, isDemoMode);
      last = (code ?? '').toString().trim();
      if (last) return last;
    } catch (e) {
      logError(e, { action: 'ensureCoachInviteCode', trainerId, attempt: i + 1 });
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, ENSURE_INVITE_BASE_DELAY_MS * (i + 1)));
    }
  }
  if (last === '' && !isDemoMode && isSupabaseConfigured()) {
    logError(new Error('ensureCoachInviteCode exhausted retries without code'), { action: 'ensureCoachInviteCode', trainerId, retries });
  }
  return last;
}

/** Pending invites for trainer. Demo: inviteCodeStore. Live: no list API; return empty. */
export async function getPendingInvitesList(
  trainerId: string,
  isDemoMode: boolean
): Promise<Array<{ id: string; code: string; created_date: string; status: string }>> {
  if (isDemoMode) return getPendingInvites();
  if (!SUPABASE_ENABLED) return [];
  return [];
}

/** Coach (Stripe, plan tier). Demo: stub. Live: getCoach from supabaseStripeApi. */
export async function getCoach(
  userId: string,
  isDemoMode: boolean
): Promise<{ coach?: { id?: string; plan_tier?: string }; connected?: boolean; error?: string }> {
  if (isDemoMode) {
    return { coach: { plan_tier: 'pro' }, connected: true };
  }
  return getCoachApi(userId);
}

/** Earnings summary for period. Demo: mockData.payments aggregate. Live: stub until coach revenue RPC is wired here. */
export async function getEarningsSummaryForPeriod(
  trainerId: string,
  period: string,
  isDemoMode: boolean
): Promise<{
  totals: { grossRevenue: number; netRevenue: number; pending: number; overdue: number };
  transactions: PaymentStatus[];
  series?: Array<{ date: string; value: number }>;
}> {
  void period;
  if (isDemoMode) {
    const periodData = (mockPayments ?? [])
      .filter((p) => p.trainer_id === trainerId)
      .map((p) => ({
        id: p.id,
        amount: Number(p.amount) || 0,
        status: p.status,
        date: p.due_date,
      })) as PaymentStatus[];
    const totals = periodData.reduce(
      (acc, row) => {
        if (row.status === 'paid') {
          acc.grossRevenue += Number(row.amount) || 0;
          acc.netRevenue += Number(row.amount) || 0;
        } else if (row.status === 'pending') {
          acc.pending += Number(row.amount) || 0;
        } else if (row.status === 'overdue') {
          acc.overdue += Number(row.amount) || 0;
        }
        return acc;
      },
      { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 }
    );
    return {
      totals,
      transactions: periodData,
      series: [],
    };
  }
  void trainerId;
  if (!isSupabaseConfigured()) {
    return {
      totals: { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 },
      transactions: [],
      series: [],
    };
  }
  return {
    totals: { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 },
    transactions: [],
    series: [],
  };
}

/** Threads for trainer (for unread counts on client list). Demo: mockData.threads. Live: message_threads. */
export async function getThreadsForTrainer(
  trainerId: string,
  isDemoMode: boolean
): Promise<Array<{ id: string; client_id: string; trainer_id: string; unread_count?: number; last_message_at?: string }>> {
  if (isDemoMode) {
    return mockThreads.filter((t: { trainer_id: string }) => t.trainer_id === trainerId);
  }
  if (!SUPABASE_ENABLED) return [];
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('message_threads')
      .select('id, client_id, coach_id, updated_at, coach_last_read_at')
      .eq('coach_id', trainerId)
      .is('deleted_at', null);
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => {
      const updated = row.updated_at ? new Date(String(row.updated_at)).getTime() : 0;
      const readAt = row.coach_last_read_at ? new Date(String(row.coach_last_read_at)).getTime() : 0;
      const unread = updated > 0 && updated > readAt ? 1 : 0;
      return {
        id: String(row.id ?? ''),
        client_id: String(row.client_id ?? ''),
        trainer_id: String(row.coach_id ?? trainerId),
        unread_count: unread,
        last_message_at: row.updated_at != null ? String(row.updated_at) : undefined,
      };
    });
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { action: 'atlasRepo.getThreadsForTrainer', trainerId });
    return [];
  }
}

/** Payments for a client (for Earnings at-risk). Demo: mockData.payments. Live: client_payments. */
export async function getPaymentsForClient(
  clientId: string,
  isDemoMode: boolean
): Promise<PaymentStatus[]> {
  if (isDemoMode) {
    return mockPayments.filter((p: { client_id: string }) => p.client_id === clientId) as PaymentStatus[];
  }
  if (!SUPABASE_ENABLED) return [];
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('client_payments')
      .select('id, client_id, coach_id, amount, status, paid_at, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => {
      const st = String(row.status ?? 'pending');
      const status: PaymentStatus['status'] =
        st === 'paid' ? 'paid' : st === 'pending' ? 'pending' : 'pending';
      return {
        id: String(row.id ?? ''),
        client_id: String(row.client_id ?? clientId),
        trainer_id: String(row.coach_id ?? ''),
        status,
        amount: Number(row.amount) || 0,
        paid_at: row.paid_at != null ? String(row.paid_at) : null,
        date: row.created_at != null ? String(row.created_at) : undefined,
      } as PaymentStatus;
    });
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { action: 'atlasRepo.getPaymentsForClient', clientId });
    return [];
  }
}

export { isSupabaseConfigured };
