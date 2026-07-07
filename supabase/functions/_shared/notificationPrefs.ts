/**
 * Server-side notification preference gating (public.notification_preferences).
 * Opt-out model, matching src/lib/notificationPreferences.js: a missing row or
 * NULL column means the category is ALLOWED. Only an explicit false blocks.
 */

// deno-lint-ignore-file no-explicit-any

export type NotificationPrefKey =
  | "checkins"
  | "messages"
  | "habits"
  | "peak_week"
  | "payments"
  | "workouts"
  | "nutrition"
  | "progress_reminders";

/** send-reminders trigger_type → preference column. Unmapped triggers are always allowed. */
export const TRIGGER_PREF_KEY: Record<string, NotificationPrefKey> = {
  workout_due_today: "workouts",
  workout_still_waiting: "workouts",
  checkin_due: "checkins",
  prep_pose_check_due: "checkins",
  habit_due: "habits",
  habit_checkin: "habits",
  billing_due: "payments",
  supplement_morning_reminder: "nutrition",
  supplement_evening_reminder: "nutrition",
  supplement_missed_reminder: "nutrition",
  peak_week_update: "peak_week",
  coach_review_prompt: "progress_reminders",
  review_prompt_4_weeks: "progress_reminders",
};

export type PrefsMap = Map<string, Record<string, unknown>>;

/** Load preference rows for a set of profile ids. Failure → empty map (allow all). */
export async function loadNotificationPrefs(supabase: any, profileIds: string[]): Promise<PrefsMap> {
  const map: PrefsMap = new Map();
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("profile_id, checkins, messages, habits, peak_week, payments, workouts, nutrition, progress_reminders")
      .in("profile_id", ids);
    if (error) {
      console.error("[notificationPrefs] load failed", error);
      return map;
    }
    for (const row of data ?? []) {
      if (row?.profile_id) map.set(String(row.profile_id), row);
    }
  } catch (err) {
    console.error("[notificationPrefs] load threw", err);
  }
  return map;
}

/** True unless the profile's row explicitly sets the key to false. */
export function isNotificationAllowed(prefs: PrefsMap, profileId: string, key: NotificationPrefKey | null | undefined): boolean {
  if (!key) return true;
  const row = prefs.get(String(profileId));
  if (!row) return true;
  const value = row[key];
  return value !== false;
}
