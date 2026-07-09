export async function fetchIsAdmin(supabaseClient, userId) {
  if (!supabaseClient) return false;
  // Must filter to the caller's own row: profiles RLS exposes other rows too
  // (admins see all, coaches see clients, marketplace coaches are public), so
  // an unfiltered .single() throws "multiple rows" and reads as not-admin.
  let uid = userId;
  if (!uid) {
    const { data } = await supabaseClient.auth.getUser();
    uid = data?.user?.id;
  }
  if (!uid) return false;
  const { data } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('id', uid)
    .maybeSingle();
  return data?.is_admin === true;
}
