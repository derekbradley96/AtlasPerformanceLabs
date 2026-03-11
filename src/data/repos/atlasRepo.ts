/**
 * Atlas data repo: single source for trainer-critical data.
 * - When isDemoMode: uses demo mocks only (mockData, programsStore seed, inviteCodeStore seed, earningsMock).
 * - When !isDemoMode and VITE_SUPABASE_URL set: fetches from Supabase Edge Functions (functions/v1/*).
 * - No localStorage-as-database except for demo or cached UI prefs.
 */
import type { Client, ReviewItem, Program, CheckIn, PaymentStatus } from '@/data/models';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import { getCoach as getCoachApi } from '@/lib/supabaseStripeApi';
import { SUPABASE_ENABLED } from '@/lib/config';
import { clients as mockClients, checkIns as mockCheckIns, payments as mockPayments, threads as mockThreads } from '@/data/mockData';
import { getStubClients } from '@/lib/clientStubStore';
import { getSeedClients, getSeedCheckIns } from '@/lib/seedClientStore';
import { getPrograms as getProgramsFromStore } from '@/lib/programsStore';
import { getOrCreateInviteCode, getPendingInvites } from '@/lib/inviteCodeStore';
import { buildSegmentedInbox } from '@/lib/inboxService';
import { getEarningsForPeriod } from '@/lib/earningsMock';
import { getEarningsSummary } from '@/lib/earningsService';

/** @deprecated Use SUPABASE_ENABLED from @/lib/config */
function isSupabaseConfigured(): boolean {
  return SUPABASE_ENABLED;
}

/** Clients for a trainer. Demo or sandbox (fake-trainer): mock + stub + seed filtered by trainer_id. Live: Edge Function atlas-clients-list. */
export async function getClients(trainerId: string, isDemoMode: boolean): Promise<Client[]> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const list = [...mockClients, ...getStubClients(), ...getSeedClients()];
    return list.filter((c: { trainer_id?: string }) => c.trainer_id === trainerId) as Client[];
  }
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await invokeSupabaseFunction('atlas-clients-list', { trainer_id: trainerId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.clients ?? data) ?? [];
  return Array.isArray(arr) ? (arr as Client[]) : [];
}

/** Single client by id. Demo or sandbox: from getClients find. Live: Edge Function atlas-client-by-id. */
export async function getClientById(clientId: string, isDemoMode: boolean, trainerId?: string): Promise<Client | null> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const list = [...mockClients, ...getStubClients(), ...getSeedClients()];
    const c = list.find((x: { id: string }) => x.id === clientId);
    return (c as Client) ?? null;
  }
  if (!SUPABASE_ENABLED) return null;
  const { data, error } = await invokeSupabaseFunction('atlas-client-by-id', { client_id: clientId });
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return (d?.client ?? data) as Client | null;
}

/** Programs (templates + assignments) for trainer. Demo: programsStore (localStorage seed allowed for demo). Live: Edge Function atlas-programs-list. */
export async function getPrograms(trainerId: string, isDemoMode: boolean): Promise<Program[]> {
  if (isDemoMode) {
    return getProgramsFromStore() as unknown as Program[];
  }
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await invokeSupabaseFunction('atlas-programs-list', { trainer_id: trainerId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.programs ?? data) ?? [];
  return Array.isArray(arr) ? (arr as Program[]) : [];
}

/** Check-ins for a client. Demo or sandbox: mockData.checkIns + seed. Live: Edge Function atlas-checkins-list. */
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
  const { data, error } = await invokeSupabaseFunction('atlas-checkins-list', { client_id: clientId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.check_ins ?? data) ?? [];
  return Array.isArray(arr) ? (arr as CheckIn[]) : [];
}

/** Check-ins for a trainer (all clients). Demo or sandbox: mockData.checkIns + seed. Live: Edge Function atlas-checkins-list. */
export async function getCheckInsForTrainer(trainerId: string, isDemoMode: boolean): Promise<CheckIn[]> {
  const useLocalData = isDemoMode || trainerId === 'fake-trainer';
  if (useLocalData) {
    const mock = mockCheckIns.filter((c: { trainer_id: string }) => c.trainer_id === trainerId);
    const seed = getSeedCheckIns().filter((c) => c.trainer_id === trainerId);
    return [...mock, ...seed] as CheckIn[];
  }
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await invokeSupabaseFunction('atlas-checkins-list', { trainer_id: trainerId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.check_ins ?? data) ?? [];
  return Array.isArray(arr) ? (arr as CheckIn[]) : [];
}

/** Inbox items (segmented). Demo: buildSegmentedInbox. Live: Edge Function atlas-inbox-items or empty. */
export async function getInboxItems(
  trainerId: string,
  isDemoMode: boolean
): Promise<{ active: ReviewItem[]; waiting: ReviewItem[]; done: ReviewItem[] }> {
  if (isDemoMode) {
    const segmented = buildSegmentedInbox(trainerId);
    return {
      active: (segmented.active ?? []) as ReviewItem[],
      waiting: (segmented.waiting ?? []) as ReviewItem[],
      done: (segmented.done ?? []) as ReviewItem[],
    };
  }
  if (!isSupabaseConfigured()) return { active: [], waiting: [], done: [] };
  const { data, error } = await invokeSupabaseFunction('atlas-inbox-items', { trainer_id: trainerId });
  if (error || !data) return { active: [], waiting: [], done: [] };
  const d = data as Record<string, unknown>;
  return {
    active: (d?.active ?? []) as ReviewItem[],
    waiting: (d?.waiting ?? []) as ReviewItem[],
    done: (d?.done ?? []) as ReviewItem[],
  };
}

/** Invite code for trainer. Demo: inviteCodeStore (localStorage allowed for demo). Live: Edge Function atlas-invite-code. */
export async function getInviteCode(trainerId: string, isDemoMode: boolean): Promise<string> {
  if (isDemoMode) return getOrCreateInviteCode(trainerId);
  if (!isSupabaseConfigured()) return '';
  const { data, error } = await invokeSupabaseFunction('atlas-invite-code', { trainer_id: trainerId });
  if (error || !data) return '';
  const d = data as Record<string, unknown>;
  return (d?.code ?? '') as string;
}

/** Pending invites for trainer. Demo: inviteCodeStore. Live: Edge Function atlas-invite-code. */
export async function getPendingInvitesList(
  trainerId: string,
  isDemoMode: boolean
): Promise<Array<{ id: string; code: string; created_date: string; status: string }>> {
  if (isDemoMode) return getPendingInvites();
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await invokeSupabaseFunction('atlas-invite-code', { trainer_id: trainerId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.pending_invites ?? data) ?? [];
  return Array.isArray(arr) ? arr : [];
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

/** Earnings summary for period. Demo: earningsService.getEarningsSummary. Live: Edge Function atlas-earnings-summary or stub. */
export async function getEarningsSummaryForPeriod(
  trainerId: string,
  period: string,
  isDemoMode: boolean
): Promise<{
  totals: { grossRevenue: number; netRevenue: number; pending: number; overdue: number };
  transactions: PaymentStatus[];
  series?: Array<{ date: string; value: number }>;
}> {
  if (isDemoMode) {
    const summary = getEarningsSummary(period) as { totals?: { grossRevenue: number; netRevenue: number; pending: number; overdue: number } } | undefined;
    const periodData = getEarningsForPeriod(period) as unknown as { totals?: { grossRevenue: number; netRevenue: number; pending: number; overdue: number }; transactions?: PaymentStatus[]; series?: Array<{ date: string; value: number }> } | undefined;
    return {
      totals: summary?.totals ?? periodData?.totals ?? { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 },
      transactions: (periodData?.transactions ?? []) as PaymentStatus[],
      series: periodData?.series,
    };
  }
  if (!isSupabaseConfigured()) {
    return {
      totals: { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 },
      transactions: [],
      series: [],
    };
  }
  const { data, error } = await invokeSupabaseFunction('atlas-earnings-summary', {
    trainer_id: trainerId,
    period,
  });
  if (error || !data) {
    return {
      totals: { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 },
      transactions: [],
      series: [],
    };
  }
  const d = data as Record<string, unknown>;
  return {
    totals: (d?.totals ?? { grossRevenue: 0, netRevenue: 0, pending: 0, overdue: 0 }) as {
      grossRevenue: number;
      netRevenue: number;
      pending: number;
      overdue: number;
    },
    transactions: (d?.transactions ?? []) as PaymentStatus[],
    series: d?.series as Array<{ date: string; value: number }> | undefined,
  };
}

/** Threads for trainer (for unread counts on client list). Demo: mockData.threads. Live: Edge Function atlas-threads-list. */
export async function getThreadsForTrainer(
  trainerId: string,
  isDemoMode: boolean
): Promise<Array<{ id: string; client_id: string; trainer_id: string; unread_count?: number; last_message_at?: string }>> {
  if (isDemoMode) {
    return mockThreads.filter((t: { trainer_id: string }) => t.trainer_id === trainerId);
  }
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await invokeSupabaseFunction('atlas-threads-list', { trainer_id: trainerId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.threads ?? data) ?? [];
  return Array.isArray(arr) ? arr : [];
}

/** Payments for a client (for Earnings at-risk). Demo: mockData.payments. Live: from earnings or atlas-payments. */
export async function getPaymentsForClient(
  clientId: string,
  isDemoMode: boolean
): Promise<PaymentStatus[]> {
  if (isDemoMode) {
    return mockPayments.filter((p: { client_id: string }) => p.client_id === clientId) as PaymentStatus[];
  }
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await invokeSupabaseFunction('atlas-payments-list', { client_id: clientId });
  if (error || !data) return [];
  const d = data as Record<string, unknown>;
  const arr = (d?.payments ?? data) ?? [];
  return Array.isArray(arr) ? (arr as PaymentStatus[]) : [];
}

export { isSupabaseConfigured };
