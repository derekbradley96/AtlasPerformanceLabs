import { supabase } from '@/lib/supabaseClient';

/** Columns for profiles select; split so we can retry if DB is behind migrations (e.g. plan_tier). */
const PROFILE_SELECT_FULL_LEGACY =
  'id, role, full_name, display_name, coach_type, coach_focus, goal, plan_tier, personal_plan_tier, personal_training_equipment, personal_training_confidence, onboarding_plan_status, is_beta_user, beta_group, is_admin, onboarding_complete, referral_code, coaching_style, niche_tags, created_at, linked_from_personal_at, height_unit, bodyweight_unit, load_unit, food_quantity_unit, nutrition_label_display, water_unit, sodium_unit, taking_clients, brand_name, brand_logo_url, brand_accent_colour, onboarding_headline, onboarding_message, onboarding_bullets, coach_discovery_prompt_seen_at, coach_upsell_seen_at';
const PROFILE_SELECT_FULL = `${PROFILE_SELECT_FULL_LEGACY}, avatar_url`;
const PROFILE_SELECT_WITHOUT_PLAN_TIER_LEGACY =
  'id, role, full_name, display_name, coach_type, coach_focus, goal, onboarding_plan_status, is_beta_user, beta_group, is_admin, onboarding_complete, referral_code, coaching_style, niche_tags, created_at, linked_from_personal_at, height_unit, bodyweight_unit, load_unit, food_quantity_unit, nutrition_label_display, water_unit, sodium_unit';
const PROFILE_SELECT_WITHOUT_PLAN_TIER = `${PROFILE_SELECT_WITHOUT_PLAN_TIER_LEGACY}, avatar_url`;
/** When nutrition columns are not migrated yet */
const PROFILE_SELECT_BODY_AND_LOAD_LEGACY =
  'id, role, full_name, display_name, coach_type, coach_focus, plan_tier, personal_plan_tier, personal_training_equipment, personal_training_confidence, onboarding_plan_status, is_beta_user, beta_group, is_admin, onboarding_complete, referral_code, coaching_style, niche_tags, created_at, linked_from_personal_at, height_unit, bodyweight_unit, load_unit';
const PROFILE_SELECT_BODY_AND_LOAD = `${PROFILE_SELECT_BODY_AND_LOAD_LEGACY}, avatar_url`;
const PROFILE_SELECT_BODY_AND_LOAD_NO_PLAN_LEGACY =
  'id, role, full_name, display_name, coach_type, coach_focus, onboarding_plan_status, is_beta_user, beta_group, is_admin, onboarding_complete, referral_code, coaching_style, niche_tags, created_at, linked_from_personal_at, height_unit, bodyweight_unit, load_unit';
const PROFILE_SELECT_BODY_AND_LOAD_NO_PLAN = `${PROFILE_SELECT_BODY_AND_LOAD_NO_PLAN_LEGACY}, avatar_url`;
/** DBs before bodyweight_unit / load_unit split (still have weight_unit). */
const PROFILE_SELECT_LEGACY_BODY_LEGACY =
  'id, role, full_name, display_name, coach_type, coach_focus, plan_tier, personal_plan_tier, personal_training_equipment, personal_training_confidence, onboarding_plan_status, is_beta_user, beta_group, is_admin, onboarding_complete, referral_code, coaching_style, niche_tags, created_at, linked_from_personal_at, height_unit, weight_unit';
const PROFILE_SELECT_LEGACY_BODY = `${PROFILE_SELECT_LEGACY_BODY_LEGACY}, avatar_url`;
const PROFILE_SELECT_LEGACY_BODY_NO_PLAN_LEGACY =
  'id, role, full_name, display_name, coach_type, coach_focus, onboarding_plan_status, is_beta_user, beta_group, is_admin, onboarding_complete, referral_code, coaching_style, niche_tags, created_at, linked_from_personal_at, height_unit, weight_unit';
const PROFILE_SELECT_LEGACY_BODY_NO_PLAN = `${PROFILE_SELECT_LEGACY_BODY_NO_PLAN_LEGACY}, avatar_url`;

/** Map legacy profiles.weight_unit onto bodyweight_unit for in-app consistency. */
export function normalizeFetchedProfileRow(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  if ((next.bodyweight_unit == null || next.bodyweight_unit === '') && next.weight_unit != null && next.weight_unit !== '') {
    next.bodyweight_unit = next.weight_unit;
  }
  return next;
}

/** Fetch profile from public.profiles by auth uid. Returns { id, role, display_name, coach_type, coach_focus?, ... } or null. Fail-soft: never throws. */
export async function fetchProfile(userId) {
  if (!supabase || !userId) return null;
  if (import.meta.env.DEV) console.log('[ATLAS] Fetching profile for', userId);
  const selects = [
    PROFILE_SELECT_FULL,
    PROFILE_SELECT_WITHOUT_PLAN_TIER,
    PROFILE_SELECT_BODY_AND_LOAD,
    PROFILE_SELECT_BODY_AND_LOAD_NO_PLAN,
    PROFILE_SELECT_LEGACY_BODY,
    PROFILE_SELECT_LEGACY_BODY_NO_PLAN,
    PROFILE_SELECT_FULL_LEGACY,
    PROFILE_SELECT_WITHOUT_PLAN_TIER_LEGACY,
    PROFILE_SELECT_BODY_AND_LOAD_LEGACY,
    PROFILE_SELECT_BODY_AND_LOAD_NO_PLAN_LEGACY,
    PROFILE_SELECT_LEGACY_BODY_LEGACY,
    PROFILE_SELECT_LEGACY_BODY_NO_PLAN_LEGACY,
  ];
  try {
    let lastError = null;
    for (const sel of selects) {
      const { data, error } = await supabase.from('profiles').select(sel).eq('id', userId).maybeSingle();
      if (!error) {
        if (import.meta.env.DEV) console.log('[AUTH] profile fetch ok?', !!data);
        return normalizeFetchedProfileRow(data ?? null);
      }
      lastError = error;
      if (
        !/goal|plan_tier|personal_plan_tier|personal_training_equipment|personal_training_confidence|linked_from_personal_at|height_unit|bodyweight_unit|load_unit|weight_unit|food_quantity_unit|nutrition_label_display|water_unit|sodium_unit|taking_clients|brand_name|brand_logo_url|brand_accent_colour|onboarding_headline|onboarding_message|onboarding_bullets|avatar_url|schema cache|PGRST204/i.test(
          error.message || ''
        )
      ) {
        break;
      }
    }
    if (import.meta.env.DEV) console.log('[AUTH] profile error', lastError?.message);
    return null;
  } catch (e) {
    if (import.meta.env.DEV) console.log('[AUTH] profile error', e?.message);
    return null;
  }
}

export async function fetchProfileWithTimeout(userId, timeoutMs = 8000) {
  const { profile } = await fetchProfileWithTimeoutResult(userId, timeoutMs);
  return profile;
}

export async function fetchProfileWithTimeoutResult(userId, timeoutMs = 8000) {
  try {
    const result = await Promise.race([
      fetchProfile(userId).then((profile) => ({ timedOut: false, profile })),
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true, profile: null }), timeoutMs)),
    ]);
    return {
      timedOut: Boolean(result?.timedOut),
      profile: result?.profile ?? null,
    };
  } catch {
    return { timedOut: false, profile: null };
  }
}
