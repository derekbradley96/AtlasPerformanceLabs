/**
 * Coach session booking — Supabase reads/writes for SessionBookingModal.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

export async function fetchCoachClientsForBooking() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, name')
    .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`)
    .order('full_name');
  if (error) return [];
  return (data || []).map((c) => ({
    id: c.id,
    name: c.full_name || c.name || 'Client',
  }));
}

/**
 * @param {{ coachId: string; clientId: string; sessionDate: Date; durationMinutes: number | null; location: string | null; notes: string | null }} p
 */
export async function insertCoachSessionBooking(p) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No supabase');
  const { coachId, clientId, sessionDate, durationMinutes, location, notes } = p;
  if (!coachId || !clientId) throw new Error('Missing coach or client');
  const payload = {
    coach_id: coachId,
    client_id: clientId,
    session_type: 'in_person',
    session_date: sessionDate.toISOString(),
    duration_minutes: Number.isNaN(durationMinutes) ? null : durationMinutes,
    location: location?.trim() ? location.trim() : null,
    notes: notes?.trim() ? notes.trim() : null,
    status: 'scheduled',
  };
  const { error } = await supabase.from('coach_sessions').insert(payload);
  if (error) throw error;
}
