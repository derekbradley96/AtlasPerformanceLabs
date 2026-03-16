/**
 * Validate coach invite code. Uses Supabase profiles.referral_code.
 * No Base44 dependency.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json({ error: 'Server not configured' }, { status: 500, headers: corsHeaders });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return Response.json({ valid: false, error: 'Invalid code' }, { status: 400, headers: corsHeaders });
    }

    const normalized = code.trim().toLowerCase();
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, stripe_account_id')
      .ilike('referral_code', normalized);

    if (error) {
      console.error('validateInviteCode error:', error);
      return Response.json({ valid: false, error: 'Lookup failed' }, { status: 500, headers: corsHeaders });
    }

    const profile = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!profile) {
      return Response.json({ valid: false }, { headers: corsHeaders });
    }

    const isCoach = (profile as { role?: string }).role === 'coach' || (profile as { role?: string }).role === 'trainer';
    if (!isCoach) {
      return Response.json({ valid: false, error: 'Code is not for a coach' }, { headers: corsHeaders });
    }

    return Response.json({
      valid: true,
      trainer_id: (profile as { id: string }).id,
      coach_id: (profile as { id: string }).id,
      trainer: {
        id: (profile as { id: string }).id,
        name: (profile as { display_name?: string }).display_name ?? 'Coach',
        niche: '',
        monthlyRate: 10000
      }
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('validateInviteCode:', err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
