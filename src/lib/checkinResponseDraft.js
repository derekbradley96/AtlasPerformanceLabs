/**
 * Check-in copilot client. Calls the checkin-reply-draft edge function, which
 * assembles the client's history server-side and returns
 * { draft, summary, flags } for the coach to edit and approve.
 *
 * History: this used to call Anthropic directly from the browser with
 * VITE_ANTHROPIC_API_KEY — which Vite bundles into shipped JS, so anyone could
 * lift the key. The key now lives only in the edge function's env, and the
 * server grounds the draft in real check-in history instead of the eight
 * scalars the page happened to have in scope.
 */
import { invokeSupabaseFunction } from '@/lib/supabaseApi';

/**
 * @param {{ checkinId: string }} params
 * @returns {Promise<{ draft: string|null, summary: string|null, flags: string[] } | null>}
 */
export async function draftCheckinResponse({ checkinId }) {
  if (!checkinId) return null;
  try {
    const { data, error } = await invokeSupabaseFunction('checkin-reply-draft', { checkin_id: checkinId });
    if (error || !data) return null;
    return {
      draft: data.draft ?? null,
      summary: data.summary ?? null,
      flags: Array.isArray(data.flags) ? data.flags : [],
    };
  } catch (error) {
    console.error('[checkinDraft] edge function call failed:', error);
    return null;
  }
}
