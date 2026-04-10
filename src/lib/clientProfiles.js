import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/**
 * Get the most relevant `clients` row for this auth user (coach’s client record).
 * Returns null when there is no `clients.user_id` match — normal for Personal/coach accounts.
 * Callers should use `enabled: isClient(effectiveRole)` on queries so Personal never hits this.
 */
export async function getMyClientProfile(userId) {
  if (!userId || !hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const selectWithDelivery =
    'id, user_id, coach_id, trainer_id, name, created_at, client_type, delivery_context, selected_service_id, billing_status';
  const selectLegacy =
    'id, user_id, coach_id, trainer_id, name, created_at, client_type, selected_service_id, billing_status';

  const loadClients = async () => {
    let { data, error } = await supabase
      .from('clients')
      .select(selectWithDelivery)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const msg = String(error?.message || '');
    if (error && /delivery_context|billing_status|schema cache|PGRST204/i.test(msg)) {
      const retry = await supabase
        .from('clients')
        .select(selectLegacy)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }
    return { data, error };
  };

  let { data: rows, error } = await loadClients();
  if ((error || !Array.isArray(rows) || rows.length === 0)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const retry = await loadClients();
    rows = retry.data;
    error = retry.error;
  }
  if (error || !Array.isArray(rows) || rows.length === 0) return null;

  const clientIds = rows.map((r) => r.id).filter(Boolean);
  let assignedIds = new Set();
  if (clientIds.length > 0) {
    const { data: assignedRows } = await supabase
      .from('program_block_assignments')
      .select('client_id')
      .in('client_id', clientIds)
      .eq('is_active', true);
    assignedIds = new Set((assignedRows || []).map((r) => r.client_id).filter(Boolean));
  }

  const sorted = [...rows].sort((a, b) => {
    const aAssigned = assignedIds.has(a.id) ? 1 : 0;
    const bAssigned = assignedIds.has(b.id) ? 1 : 0;
    if (aAssigned !== bAssigned) return bAssigned - aAssigned;
    return 0;
  });

  const top = sorted[0];
  if (!top) return null;
  const billing = String(top.billing_status ?? 'active').toLowerCase();
  return {
    ...top,
    full_name: top.name ?? null,
    subscription_status: billing === 'overdue' ? 'past_due' : billing === 'pending_payment' ? 'pending' : 'active',
  };
}
