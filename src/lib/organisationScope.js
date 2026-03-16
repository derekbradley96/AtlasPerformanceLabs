/**
 * Organisation-aware scoping helpers for coach-centric views.
 *
 * Goal: decide whether to query by a single coach_id (solo coach or member)
 * or by multiple coach_ids (organisation owner/admin seeing team-wide data),
 * without breaking existing coach-first behaviour.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  isOrganisationOwner,
  isOrganisationAdmin,
} from '@/lib/organisationPermissions';

/**
 * Resolve the current user's organisation scope for coach-centric queries.
 *
 * Returns:
 * - coachId: the current auth user's id (primary coach id)
 * - coachIds: array of coach profile ids to include in queries
 * - mode:
 *   - 'none'      → no scoping possible (not signed in / no Supabase)
 *   - 'coach_only'→ single-coach view (solo coach or no organisation)
 *   - 'org_wide'  → organisation-wide view (owner/admin)
 *   - 'self_only' → coach-only within organisation
 * - orgId: organisation id if present
 * - myMember: organisation_members row for the current user (if any)
 */
export async function resolveOrgCoachScope() {
  if (!hasSupabase) {
    return { coachId: null, coachIds: [], mode: 'none', orgId: null, myMember: null };
  }
  const supabase = getSupabase();
  if (!supabase || typeof supabase.auth?.getUser !== 'function') {
    return { coachId: null, coachIds: [], mode: 'none', orgId: null, myMember: null };
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const userId = user?.id ?? null;
  if (!userId) {
    return { coachId: null, coachIds: [], mode: 'none', orgId: null, myMember: null };
  }

  // Look up profile to determine organisation_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organisation_id')
    .eq('id', userId)
    .maybeSingle();

  const orgId = profile?.organisation_id ?? null;
  if (!orgId) {
    // Solo coach / no organisation: keep existing coach-centric behaviour
    return {
      coachId: userId,
      coachIds: [userId],
      mode: 'coach_only',
      orgId: null,
      myMember: null,
    };
  }

  const { data: members } = await supabase
    .from('organisation_members')
    .select('profile_id, role, is_active')
    .eq('organisation_id', orgId);

  const activeMembers = (members || []).filter((m) => m.is_active);
  const myMember = activeMembers.find((m) => m.profile_id === userId) ?? null;

  const coachMembers = activeMembers.filter((m) => {
    const r = (m.role || '').trim().toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'coach';
  });

  const coachIds = coachMembers.map((m) => m.profile_id).filter(Boolean);

  // Default to self-only scope if we cannot determine membership
  if (!myMember) {
    return {
      coachId: userId,
      coachIds: coachIds.length > 0 ? coachIds : [userId],
      mode: 'coach_only',
      orgId,
      myMember: null,
    };
  }

  const owner = isOrganisationOwner(myMember);
  const admin = isOrganisationAdmin(myMember);

  if (owner || admin) {
    // Organisation-wide view: include all coach profile ids in org
    const ids = coachIds.length > 0 ? coachIds : [userId];
    return {
      coachId: userId,
      coachIds: ids,
      mode: 'org_wide',
      orgId,
      myMember,
    };
  }

  // Regular coach / assistant / posing coach: default to self-only; RLS still applies.
  return {
    coachId: userId,
    coachIds: [userId],
    mode: 'self_only',
    orgId,
    myMember,
  };
}

