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

  const { error } = await supabase
    .from('clients')
    .update({
      coach_id: null,
      trainer_id: null,
      billing_status: 'paused',
    })
    .eq('id', clientId)
    .eq('coach_id', coachId);

  if (error) throw error;

  if (clientProfile?.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      profile_id: clientProfile.user_id,
      type: 'coach_removed_client',
      title: 'Your coaching relationship has ended',
      message: 'Your coach has ended your coaching relationship on Atlas. Your training history is preserved.',
      category: 'coaching',
      is_read: false,
    });
    if (notificationError) throw notificationError;
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

  const { error: notificationError } = await supabase.from('notifications').insert({
    profile_id: resolvedCoachId,
    type: 'client_left_coaching',
    title: 'A client has left your coaching',
    message: 'One of your clients has ended their coaching relationship with you on Atlas.',
    category: 'coaching',
    is_read: false,
  });
  if (notificationError) throw notificationError;

  return { ok: true };
}
