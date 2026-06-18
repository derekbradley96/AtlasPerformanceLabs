/**
 * Posing practice logs — weekly volume for prep clients (Supabase).
 */

export function weekStartMondayIso(d = new Date()) {
  const x = d instanceof Date ? new Date(d) : new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(x);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function logPosingSession({
  supabase,
  clientId,
  profileId,
  durationMinutes,
  posespracticed,
  notes,
}) {
  if (!supabase || !clientId || !profileId) return { data: null, error: new Error('Missing supabase, clientId, or profileId') };
  return supabase.from('posing_practice_logs').insert({
    client_id: clientId,
    profile_id: profileId,
    duration_minutes: durationMinutes,
    poses_practiced: posespracticed || [],
    notes: notes || null,
    logged_at: new Date().toISOString(),
  });
}

export async function getWeeklyPosingMinutes({ supabase, clientId, weekStart }) {
  if (!supabase || !clientId || !weekStart) return 0;
  const { data, error } = await supabase
    .from('posing_practice_logs')
    .select('duration_minutes')
    .eq('client_id', clientId)
    .gte('logged_at', weekStart);
  if (error) return 0;
  return (data || []).reduce((sum, r) => sum + (Number(r.duration_minutes) || 0), 0);
}

export async function getTodayPosingMinutes({ supabase, clientId, dayStartIso }) {
  if (!supabase || !clientId || !dayStartIso) return 0;
  const end = new Date(dayStartIso);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from('posing_practice_logs')
    .select('duration_minutes')
    .eq('client_id', clientId)
    .gte('logged_at', dayStartIso)
    .lt('logged_at', end.toISOString());
  if (error) return 0;
  return (data || []).reduce((sum, r) => sum + (Number(r.duration_minutes) || 0), 0);
}
