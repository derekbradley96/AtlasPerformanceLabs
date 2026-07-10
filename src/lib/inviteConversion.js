import { invokeSupabaseFunction, normalizeInviteCode } from '@/lib/supabaseApi';
import { isPersonal, normalizeRole } from '@/lib/roles';
import { resolveCoachLinkId } from '@/lib/coachLink';

const CLIENT_SELECT_FULL = 'id, user_id, coach_id, trainer_id, billing_status, client_type, name';
const CLIENT_SELECT_LEGACY = 'id, user_id, coach_id, trainer_id, client_type, name';

function isMissingColumnError(error) {
  const msg = String(error?.message || '');
  return /column|does not exist|schema cache|PGRST204/i.test(msg);
}

function isPermissionError(error) {
  const msg = String(error?.message || '');
  return error?.code === '42501' || /permission denied|row-level security|not allowed/i.test(msg);
}

function isDuplicateClientLinkError(error) {
  const msg = String(error?.message || '');
  return error?.code === '23505' || /duplicate key|unique constraint/i.test(msg);
}

function humanizeInviteJoinError(error) {
  if (isPermissionError(error)) {
    return new Error('Could not connect coach link yet. Please complete sign-in and try invite again.');
  }
  return new Error(error?.message || 'Could not apply invite code');
}

async function readExistingClientLink(supabase, userId) {
  let result = await supabase
    .from('clients')
    .select(CLIENT_SELECT_FULL)
    .eq('user_id', userId)
    .maybeSingle();
  if (!result.error) return result.data ?? null;
  if (!isMissingColumnError(result.error)) throw result.error;
  result = await supabase
    .from('clients')
    .select(CLIENT_SELECT_LEGACY)
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ?? null;
}

async function insertClientLink(supabase, userId, coachId, name) {
  // clients.name is NOT NULL, so the self-join insert must supply one (the
  // coach-add path always had a name; invite-join did not — the insert 23502'd).
  const safeName = String(name || '').trim() || 'New client';
  const payloads = [
    {
      user_id: userId,
      coach_id: coachId,
      trainer_id: coachId,
      billing_status: 'active',
      client_type: 'transformation',
      name: safeName,
    },
    {
      user_id: userId,
      coach_id: coachId,
      trainer_id: coachId,
      client_type: 'transformation',
      name: safeName,
    },
    {
      user_id: userId,
      coach_id: coachId,
      trainer_id: coachId,
      name: safeName,
    },
  ];
  let lastError = null;
  for (const payload of payloads) {
    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select(CLIENT_SELECT_FULL)
      .maybeSingle();
    if (!error) return data ?? null;
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }
  throw lastError ?? new Error('Could not create client link');
}

async function updateClientLink(supabase, clientId, coachId) {
  const { data, error } = await supabase
    .from('clients')
    .update({ coach_id: coachId, trainer_id: coachId })
    .eq('id', clientId)
    .select(CLIENT_SELECT_FULL)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function validateInviteCodeDirect(supabase, rawCode) {
  const code = normalizeInviteCode(rawCode);
  if (!code) return { valid: false, message: 'No code provided' };

  const edgeResult = await invokeSupabaseFunction('validateInviteCode', { code });
  if (!edgeResult?.error && edgeResult?.data && typeof edgeResult.data === 'object' && edgeResult.data.valid) {
    const coachId = edgeResult.data.coach_id ?? edgeResult.data.trainer_id ?? edgeResult.data?.trainer?.id ?? null;
    if (coachId) return { valid: true, coachId };
  }

  if (typeof supabase?.rpc === 'function') {
    const { data: rpcData, error: rpcError } = await supabase.rpc('validate_invite_code', {
      p_code: code,
    });
    if (!rpcError && rpcData && typeof rpcData === 'object') {
      const coachId = rpcData.coach_id ?? rpcData.trainer_id ?? rpcData.id ?? null;
      if (coachId) return { valid: true, coachId };
    }
  }

  const { data: coachProfile, error } = await supabase
    .from('profiles')
    .select('id, role, referral_code')
    .eq('referral_code', code)
    .in('role', ['coach', 'trainer'])
    .maybeSingle();
  if (error || !coachProfile?.id) {
    return { valid: false, message: 'Invalid invite code' };
  }
  return { valid: true, coachId: coachProfile.id };
}

export async function applyInviteCodeForUser({ supabase, user, inviteCode }) {
  if (!supabase) throw new Error('No connection');
  const userId = user?.id;
  if (!userId) throw new Error('Please sign in first');

  const validation = await validateInviteCodeDirect(supabase, inviteCode);
  if (!validation.valid) throw new Error(validation.message || 'Invalid invite code');

  const coachId = validation.coachId;
  if (coachId === userId) {
    throw new Error('You cannot use your own invite code');
  }
  const joinDisplayName = String(
    user?.full_name ?? user?.user_metadata?.full_name ?? user?.display_name ?? ''
  ).trim();
  const joinEmail = String(user?.email ?? user?.user_metadata?.email ?? '').trim();
  const joinName = joinDisplayName || joinEmail;

  const existing = await readExistingClientLink(supabase, userId);
  let clientProfile = null;
  try {
    if (existing?.id) {
      clientProfile = (await updateClientLink(supabase, existing.id, coachId)) ?? { ...existing, coach_id: coachId, trainer_id: coachId };
    } else {
      try {
        clientProfile = await insertClientLink(supabase, userId, coachId, joinName);
      } catch (insertError) {
        if (!isDuplicateClientLinkError(insertError)) throw insertError;
        const racedExisting = await readExistingClientLink(supabase, userId);
        if (!racedExisting?.id) throw insertError;
        clientProfile =
          (await updateClientLink(supabase, racedExisting.id, coachId))
          ?? { ...racedExisting, coach_id: coachId, trainer_id: coachId };
      }
    }
  } catch (error) {
    throw humanizeInviteJoinError(error);
  }

  const wasPersonal = isPersonal(user?.user_type ?? user?.role);

  if (normalizeRole(user?.role ?? user?.user_type) !== 'client') {
    // Stamp linked_from_personal_at on the personal→client flip so the client
    // dashboard can show the "welcome across from personal" migration state
    // (it reads profile.linked_from_personal_at, which nothing set before).
    const profilePatch = wasPersonal
      ? { role: 'client', linked_from_personal_at: new Date().toISOString() }
      : { role: 'client' };
    const { error } = await supabase
      .from('profiles')
      .update(profilePatch)
      .eq('id', userId);
    if (error) throw humanizeInviteJoinError(error);
  }

  // Roster rows created here have no name — without this the coach's client
  // list shows a permanent 'Client' for everyone who joined by invite code.
  const existingName = String(clientProfile?.name ?? '').trim();
  if (clientProfile?.id && !existingName) {
    const displayName = String(
      user?.full_name ?? user?.user_metadata?.full_name ?? user?.display_name ?? ''
    ).trim();
    const email = String(user?.email ?? user?.user_metadata?.email ?? '').trim();
    const fallbackName = displayName || email;
    if (fallbackName) {
      try {
        await supabase
          .from('clients')
          .update({ name: fallbackName, full_name: displayName || null, email: email || null })
          .eq('id', clientProfile.id);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[inviteConversion] roster name sync failed', e);
      }
    }
  }

  // Transfer personal program blocks to the new coach so they can see the client's
  // full workout history. Personal blocks have owner_profile_id = userId and
  // coach_id = userId. A direct UPDATE is blocked by program_blocks' RLS WITH CHECK
  // (which requires coach_id = auth.uid()), so this goes through a SECURITY DEFINER
  // RPC scoped to the caller's own blocks and their linked coach.
  if (wasPersonal && coachId && userId) {
    try {
      const { error } = await supabase.rpc('handoff_personal_blocks_to_coach', { p_coach_id: coachId });
      if (error) throw error;
    } catch (e) {
      // Non-fatal: coach can still coach this client, just won't see historical blocks
      if (import.meta.env.DEV) console.warn('[inviteConversion] personal blocks handoff failed', e);
    }
  }

  return {
    clientProfile,
    coach_id: resolveCoachLinkId(clientProfile) ?? coachId,
    was_personal: wasPersonal,
  };
}

