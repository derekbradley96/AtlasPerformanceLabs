/**
 * Get or ensure coach has a referral code. Uses Supabase profiles.referral_code.
 * No Base44 dependency.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

function randomCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'atlas-' + s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json({ error: 'Server not configured' }, { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey ?? '', { global: { headers: { Authorization: authHeader ?? '' } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(authHeader?.replace('Bearer ', '') ?? '');
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, referral_code')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404, headers: corsHeaders });
    }

    const existing = (profile as { referral_code?: string }).referral_code?.trim();
    if (existing) {
      return Response.json({ code: existing }, { headers: corsHeaders });
    }

    let code: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const c = randomCode();
      const { data: conflict } = await supabase.from('profiles').select('id').eq('referral_code', c).maybeSingle();
      if (!conflict) {
        const { error: updateErr } = await supabase.from('profiles').update({ referral_code: c }).eq('id', user.id);
        if (!updateErr) {
          code = c;
          break;
        }
      }
    }
    if (!code) {
      return Response.json({ error: 'Failed to generate unique code' }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ code }, { headers: corsHeaders });
  } catch (err) {
    console.error('generateInviteCode:', err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
