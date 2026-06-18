export const CALL_ACTIVE_STATUSES = ['ringing', 'accepted', 'in_progress'];

export function resolveTerminalCallStatus(connectionState) {
  return connectionState === 'connected' ? 'completed' : 'cancelled';
}

export async function insertOutgoingVideoCall({
  supabase,
  coachId,
  clientId,
  callerName,
}) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('checkin_call_requests')
    .insert({
      checkin_id: null,
      coach_id: coachId,
      client_id: clientId,
      call_type: 'video',
      proposed_at: nowIso,
      duration_minutes: 30,
      status: 'ringing',
      caller_role: 'coach',
      caller_name: callerName || 'Coach',
      updated_at: nowIso,
    })
    .select('id, status, caller_role')
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function acceptIncomingVideoCall({ supabase, callRequestId }) {
  const { error } = await supabase
    .from('checkin_call_requests')
    .update({
      status: 'accepted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', callRequestId)
    .in('status', ['ringing']);
  if (error) throw error;
}

export async function markCallInProgress({ supabase, callRequestId }) {
  const { error } = await supabase
    .from('checkin_call_requests')
    .update({
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', callRequestId)
    .in('status', CALL_ACTIVE_STATUSES);
  if (error) throw error;
}

export async function finalizeCallOnHangup({
  supabase,
  callRequestId,
  connectionState,
}) {
  const terminalStatus = resolveTerminalCallStatus(connectionState);
  const { error } = await supabase
    .from('checkin_call_requests')
    .update({
      status: terminalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', callRequestId)
    .in('status', CALL_ACTIVE_STATUSES);
  if (error) throw error;
}

