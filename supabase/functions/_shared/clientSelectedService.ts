/**
 * Validate that a UUID refers to an active atlas_services row owned by the coach's atlas_coaches row.
 * coachAuthUserId = profiles.id / auth user id (atlas_coaches.user_id is stored as text).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ValidateSelectedServiceResult =
  | { ok: true; id: string | null }
  | { ok: false; message: string; status: number };

export async function validateSelectedServiceForCoach(
  supabase: SupabaseClient,
  coachAuthUserId: string,
  raw: unknown,
): Promise<ValidateSelectedServiceResult> {
  if (raw === undefined) return { ok: true, id: null };
  if (raw === null || raw === "") return { ok: true, id: null };

  const sid = String(raw).trim();
  if (!sid) return { ok: true, id: null };

  const { data: ac, error: acErr } = await supabase.from("atlas_coaches").select("id").eq("user_id", coachAuthUserId).maybeSingle();
  if (acErr || !ac?.id) {
    return { ok: false, message: "Coach account is not set up for plans yet", status: 400 };
  }
  const atlasCoachId = (ac as { id: string }).id;

  const { data: svc, error: sErr } = await supabase
    .from("atlas_services")
    .select("id, coach_id, active")
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !svc?.id) {
    return { ok: false, message: "Invalid plan", status: 400 };
  }
  const row = svc as { id: string; coach_id: string; active: boolean };
  if (row.coach_id !== atlasCoachId) {
    return { ok: false, message: "Plan does not belong to this coach", status: 403 };
  }
  if (row.active === false) {
    return { ok: false, message: "This plan is no longer available", status: 400 };
  }
  return { ok: true, id: sid };
}
