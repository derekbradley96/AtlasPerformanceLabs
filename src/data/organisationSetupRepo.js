/**
 * Organisation creation (coach owner). Supabase only — used by OrganisationSetupPage.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/**
 * @param {{ name: string; slug: string | null; ownerProfileId: string }} input
 * @returns {Promise<{ orgId: string }>}
 */
export async function createOrganisationAsOwner(input) {
  const { name, slug, ownerProfileId } = input;
  if (!hasSupabase) throw new Error('Sign in to create an organisation.');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Sign in to create an organisation.');
  if (!ownerProfileId) throw new Error('Sign in to create an organisation.');

  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({
      name,
      slug,
      owner_profile_id: ownerProfileId,
    })
    .select('id')
    .single();

  if (orgError) {
    if (orgError.code === '23505') {
      const err = new Error('That slug is already in use. Choose another.');
      /** @type {any} */ (err).code = '23505';
      throw err;
    }
    throw new Error(orgError.message || 'Could not create organisation.');
  }

  const orgId = org?.id;
  if (!orgId) throw new Error('Organisation was created but could not continue.');

  const { error: memberError } = await supabase.from('organisation_members').insert({
    organisation_id: orgId,
    profile_id: ownerProfileId,
    role: 'owner',
    is_active: true,
  });

  if (memberError) {
    throw new Error(memberError.message || 'Could not add you as owner.');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ organisation_id: orgId })
    .eq('id', ownerProfileId);

  if (profileError) {
    throw new Error(profileError.message || 'Organisation created but profile could not be updated.');
  }

  return { orgId };
}
