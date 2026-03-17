/**
 * Supabase Edge Functions API.
 * Re-exports from supabaseStripeApi. Use for Edge Function calls (e.g. validateInviteCode, getTrainerEarnings).
 * Uses VITE_SUPABASE_URL; when missing, calls return { data: null, error }.
 */

export { invokeSupabaseFunction, normalizeInviteCode, getSupabaseProjectRef } from '@/lib/supabaseStripeApi';
