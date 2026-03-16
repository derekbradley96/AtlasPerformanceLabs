/**
 * Calculate exercise performance trends. Implement with Supabase (workout_sessions or equivalent).
 * Base44 removed.
 */
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return Response.json(
    { error: 'Not implemented. Implement with Supabase.' },
    { status: 501, headers: corsHeaders }
  );
});
