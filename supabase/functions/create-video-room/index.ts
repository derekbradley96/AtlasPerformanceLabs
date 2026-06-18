// Deprecated — video calls now use WebRTC via Supabase Realtime.
// This function is kept as an empty stub to avoid deploy errors.
// Safe to delete entirely in a future cleanup.
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

serve(() => new Response(
  JSON.stringify({ deprecated: true }),
  { status: 410 }
));
