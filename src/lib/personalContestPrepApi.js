import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

export async function fetchActivePersonalContestPrep(profileId) {
  if (!hasSupabase || !profileId) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('personal_contest_preps')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

/**
 * Deactivate any active prep row, then insert a new active prep.
 */
export async function startPersonalContestPrepRow({
  profileId,
  protocolId,
  showDate,
  prepStartedAt,
  division,
  federation,
  showName,
}) {
  if (!hasSupabase || !profileId) return { ok: false, error: 'no_supabase' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  await sb.from('personal_contest_preps').update({ is_active: false }).eq('profile_id', profileId).eq('is_active', true);
  const { data, error } = await sb
    .from('personal_contest_preps')
    .insert({
      profile_id: profileId,
      protocol_id: protocolId,
      show_date: showDate,
      prep_started_at: prepStartedAt || showDate,
      division: division || null,
      federation: federation || null,
      show_name: showName || null,
      is_active: true,
      protocol_meta: {},
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data };
}

export async function updatePersonalContestPrepFederation({ profileId, federation }) {
  if (!hasSupabase || !profileId) return { ok: false };
  const sb = getSupabase();
  if (!sb) return { ok: false };
  const { data: active } = await sb
    .from('personal_contest_preps')
    .select('id')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .maybeSingle();
  if (!active?.id) return { ok: false, reason: 'no_active_prep' };
  const { error } = await sb.from('personal_contest_preps').update({ federation }).eq('id', active.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
