/**
 * Notification preferences (public.notification_preferences).
 * One row per profile: checkins, messages, habits, peak_week, payments (all boolean, default true).
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const DEFAULTS = {
  checkins: true,
  messages: true,
  habits: true,
  peak_week: true,
  payments: true,
};

/**
 * Get notification preferences for a profile. Inserts default row if none exists.
 * @param {string} profileId - profiles.id (auth user)
 * @returns {Promise<{ checkins: boolean, messages: boolean, habits: boolean, peak_week: boolean, payments: boolean } | null>}
 */
export async function getNotificationPreferences(profileId) {
  if (!hasSupabase || !profileId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: row, error: selectError } = await supabase
    .from('notification_preferences')
    .select('checkins, messages, habits, peak_week, payments')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (selectError) {
    if (import.meta.env?.DEV) console.error('[notificationPreferences] get', selectError.message);
    return null;
  }

  if (row) {
    return {
      checkins: !!row.checkins,
      messages: !!row.messages,
      habits: !!row.habits,
      peak_week: !!row.peak_week,
      payments: !!row.payments,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('notification_preferences')
    .insert({ profile_id: profileId, ...DEFAULTS })
    .select('checkins, messages, habits, peak_week, payments')
    .single();

  if (insertError) {
    if (import.meta.env?.DEV) console.error('[notificationPreferences] insert defaults', insertError.message);
    return { ...DEFAULTS };
  }

  return inserted
    ? {
        checkins: !!inserted.checkins,
        messages: !!inserted.messages,
        habits: !!inserted.habits,
        peak_week: !!inserted.peak_week,
        payments: !!inserted.payments,
      }
    : { ...DEFAULTS };
}

/**
 * Update a single preference. Upserts so the row exists.
 * @param {string} profileId - profiles.id
 * @param {string} key - One of: checkins, messages, habits, peak_week, payments
 * @param {boolean} value
 * @returns {Promise<boolean>} true if update succeeded
 */
export async function updateNotificationPreference(profileId, key, value) {
  if (!hasSupabase || !profileId || !key) return false;
  const allowed = ['checkins', 'messages', 'habits', 'peak_week', 'payments'];
  if (!allowed.includes(key)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        profile_id: profileId,
        [key]: !!value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );

  if (error) {
    if (import.meta.env?.DEV) console.error('[notificationPreferences] update', error.message);
    return false;
  }
  return true;
}

/**
 * Update multiple preferences at once.
 * @param {string} profileId - profiles.id
 * @param {Partial<Record<'checkins'|'messages'|'habits'|'peak_week'|'payments', boolean>>} prefs
 * @returns {Promise<boolean>}
 */
export async function updateNotificationPreferences(profileId, prefs) {
  if (!hasSupabase || !profileId || !prefs || typeof prefs !== 'object') return false;
  const supabase = getSupabase();
  if (!supabase) return false;

  const allowed = ['checkins', 'messages', 'habits', 'peak_week', 'payments'];
  const payload = { profile_id: profileId, updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in prefs && typeof prefs[k] === 'boolean') payload[k] = prefs[k];
  }
  if (Object.keys(payload).length <= 2) return true;

  const { error } = await supabase.from('notification_preferences').upsert(payload, { onConflict: 'profile_id' });
  if (error) {
    if (import.meta.env?.DEV) console.error('[notificationPreferences] updatePreferences', error.message);
    return false;
  }
  return true;
}
