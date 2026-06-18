/** Fetch coach's clients (coach_id or trainer_id = userId). */
export async function fetchCoachClients(supabase, userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, user_id')
    .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('name');
  if (error) return [];
  return (data || []).map((c) => ({ id: c.id, name: c.name || 'Client', user_id: c.user_id || null }));
}

/** Fetch block by id — returns Supabase error separately from "no row" (RLS / missing). */
export async function fetchBlock(supabase, blockId) {
  if (!supabase || !blockId) return { data: null, error: null };
  const { data, error } = await supabase.from('program_blocks').select('*').eq('id', blockId).maybeSingle();
  return { data: data ?? null, error: error ?? null };
}

/** Fetch weeks for block. */
export async function fetchWeeks(supabase, blockId) {
  if (!supabase || !blockId) return [];
  const { data, error } = await supabase
    .from('program_weeks')
    .select('*')
    .eq('block_id', blockId)
    .order('week_number');
  return error ? [] : (data || []);
}

/** Fetch days for a week. */
export async function fetchDays(supabase, weekId) {
  if (!supabase || !weekId) return [];
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('week_id', weekId)
    .order('day_number');
  return error ? [] : (data || []);
}

/** Fetch exercises for a day. */
export async function fetchExercises(supabase, dayId) {
  if (!supabase || !dayId) return [];
  const { data, error } = await supabase
    .from('program_exercises')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  return error ? [] : (data || []);
}

/** Next free `day_number` for UNIQUE(week_id, day_number) — never trust local `days` (race / week switch). */
export async function fetchNextDayNumberForWeek(supabase, weekId) {
  if (!supabase || !weekId) return 1;
  const { data, error } = await supabase.from('program_days').select('day_number').eq('week_id', weekId);
  if (error) throw error;
  const used = (data || [])
    .map((r) => Number(r.day_number))
    .filter((n) => Number.isFinite(n) && n >= 1);
  return used.length ? Math.max(...used) + 1 : 1;
}
