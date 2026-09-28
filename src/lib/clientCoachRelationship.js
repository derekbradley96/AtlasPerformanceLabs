import { insertNotificationForRecipient } from '@/lib/notifications';

export async function removeClientFromRoster({
  supabase,
  clientId,
  coachId,
  reason,
  reasonDetail,
}) {
  if (!supabase || !clientId || !coachId || !reason) {
    throw new Error('Missing required relationship-removal fields.');
  }

  const { error: removalInsertError } = await supabase.from('client_coach_removals').insert({
    client_id: clientId,
    coach_id: coachId,
    initiated_by: 'coach',
    reason,
    reason_detail: reasonDetail || null,
  });
  if (removalInsertError) throw removalInsertError;

  const { data: clientProfile, error: clientProfileError } = await supabase
    .from('clients')
    .select('user_id')
    .eq('id', clientId)
    .single();

  if (clientProfileError) throw clientProfileError;

  // Legacy rows carry trainer_id only — a bare coach_id filter matched zero
  // rows and the "removed" client silently stayed on the roster.
  const { error } = await supabase
    .from('clients')
    .update({
      coach_id: null,
      trainer_id: null,
      billing_status: 'paused',
    })
    .eq('id', clientId)
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);

  if (error) throw error;

  if (clientProfile?.user_id) {
    // Best-effort, AFTER the removal: the old direct insert violated the
    // notifications RLS (profile_id must equal auth.uid()) and used a type
    // outside notifications_type_check, so it threw every time — the coach
    // saw a raw error and retried an already-completed removal forever.
    // insertNotificationForRecipient goes through the SECURITY DEFINER RPC
    // with an allowed type and never throws.
    await insertNotificationForRecipient(
      clientProfile.user_id,
      'automation',
      'Your coaching relationship has ended',
      'Your coach has ended your coaching relationship on Atlas. Your training history is preserved.',
      {},
      clientId,
      { dedupeKey: `coach_removed:${clientId}` },
    );
  }

  return { ok: true };
}

export async function leaveCoach({
  supabase,
  clientId,
  coachId,
  reason,
  reasonDetail,
}) {
  if (!supabase || !clientId || !reason) {
    throw new Error('Missing required fields for leaveCoach.');
  }

  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('coach_id, trainer_id')
    .eq('id', clientId)
    .maybeSingle();
  if (clientErr) throw clientErr;
  const resolvedCoachId = coachId || clientRow?.coach_id || clientRow?.trainer_id || null;
  if (!resolvedCoachId) {
    throw new Error('No active coach relationship found for this client.');
  }

  const { error: removalInsertError } = await supabase.from('client_coach_removals').insert({
    client_id: clientId,
    coach_id: resolvedCoachId,
    initiated_by: 'client',
    reason,
    reason_detail: reasonDetail || null,
  });
  if (removalInsertError) throw removalInsertError;

  let updateQuery = supabase
    .from('clients')
    .update({
      coach_id: null,
      trainer_id: null,
      billing_status: 'paused',
    })
    .eq('id', clientId);
  if (resolvedCoachId) {
    updateQuery = updateQuery.or(`coach_id.eq.${resolvedCoachId},trainer_id.eq.${resolvedCoachId}`);
  }
  const { error } = await updateQuery;

  if (error) throw error;

  // Best-effort via the cross-user RPC — the direct insert failed RLS +
  // type CHECK identically to the coach→client direction above.
  await insertNotificationForRecipient(
    resolvedCoachId,
    'automation',
    'A client has left your coaching',
    'One of your clients has ended their coaching relationship with you on Atlas.',
    {},
    clientId,
    { dedupeKey: `client_left:${clientId}` },
  );

  return { ok: true };
}
