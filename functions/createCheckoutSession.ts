/**
 * Stripe Checkout session for lead/service. Implement with Supabase + Stripe.
 * Base44 removed.
 */
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return Response.json(
    { error: 'Not implemented. Implement with Supabase and Stripe.' },
    { status: 501, headers: corsHeaders }
  );
});
