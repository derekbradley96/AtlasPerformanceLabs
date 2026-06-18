export async function fetchIsAdmin(supabaseClient) {
  if (!supabaseClient) return false;
  const { data } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .single();
  return data?.is_admin === true;
}

