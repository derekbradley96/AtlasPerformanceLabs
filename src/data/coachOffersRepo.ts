/**
 * Coach onboarding offer: one row per coach (`coach_offers`). Demo: localStorage.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { logError } from '@/services/errorLogger';

const DEMO_KEY_PREFIX = 'atlas_coach_offer_v1:';

export type CoachOfferPayload = {
  name: string;
  price_monthly: number;
  currency?: string;
  includes_training: boolean;
  includes_nutrition: boolean;
  includes_checkins: boolean;
  includes_messaging: boolean;
};

export type CoachOfferRow = CoachOfferPayload & {
  id: string;
  coach_id: string;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_COACH_OFFER: CoachOfferPayload = {
  name: 'Online coaching',
  price_monthly: 100,
  currency: 'GBP',
  includes_training: true,
  includes_nutrition: true,
  includes_checkins: true,
  includes_messaging: true,
};

function readDemoOffer(coachId: string): CoachOfferRow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEMO_KEY_PREFIX + coachId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoachOfferRow;
    return parsed?.coach_id ? parsed : null;
  } catch {
    return null;
  }
}

function writeDemoOffer(coachId: string, row: CoachOfferRow) {
  try {
    window.localStorage.setItem(DEMO_KEY_PREFIX + coachId, JSON.stringify(row));
  } catch (e) {
    logError(e, { action: 'writeDemoOffer', coachId });
  }
}

/** PostgREST when table exists in migrations but remote DB was not migrated. */
function isCoachOffersTableMissing(err: unknown): boolean {
  const o = err as { code?: string; message?: string };
  const msg = (o?.message ?? '').toLowerCase();
  return (
    o?.code === 'PGRST205' ||
    /schema cache|could not find.*['"]?public\.coach_offers['"]?/i.test(msg) ||
    /coach_offers.*schema cache/i.test(msg)
  );
}

export async function fetchCoachOffer(coachId: string | null, isDemoMode: boolean): Promise<CoachOfferRow | null> {
  if (!coachId) return null;
  if (isDemoMode) return readDemoOffer(coachId);
  if (!hasSupabase) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('coach_offers').select('*').eq('coach_id', coachId).maybeSingle();
  if (error) {
    if (isCoachOffersTableMissing(error)) {
      return readDemoOffer(coachId);
    }
    logError(error, { action: 'fetchCoachOffer', coachId });
    return null;
  }
  return (data as CoachOfferRow) ?? null;
}

export async function upsertCoachOffer(
  coachId: string | null,
  isDemoMode: boolean,
  payload: CoachOfferPayload,
): Promise<{ ok: boolean; error?: string; usedLocalFallback?: boolean }> {
  if (!coachId) return { ok: false, error: 'No coach' };
  const name = String(payload.name ?? '').trim() || DEFAULT_COACH_OFFER.name;
  const price_monthly = Math.max(1, Math.floor(Number(payload.price_monthly) || DEFAULT_COACH_OFFER.price_monthly));
  const row: CoachOfferRow = {
    id: 'local',
    coach_id: coachId,
    name,
    price_monthly,
    currency: 'GBP',
    includes_training: payload.includes_training !== false,
    includes_nutrition: payload.includes_nutrition !== false,
    includes_checkins: payload.includes_checkins !== false,
    includes_messaging: payload.includes_messaging !== false,
  };
  if (isDemoMode) {
    writeDemoOffer(coachId, { ...row, id: `demo-${coachId}` });
    return { ok: true };
  }
  if (!hasSupabase) return { ok: false, error: 'No database' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'No client' };
  const upsertBody = {
    coach_id: coachId,
    name: row.name,
    price_monthly: row.price_monthly,
    currency: 'GBP',
    includes_training: row.includes_training,
    includes_nutrition: row.includes_nutrition,
    includes_checkins: row.includes_checkins,
    includes_messaging: row.includes_messaging,
  };
  const { error } = await sb.from('coach_offers').upsert(upsertBody, { onConflict: 'coach_id' });
  if (error) {
    if (isCoachOffersTableMissing(error)) {
      writeDemoOffer(coachId, { ...row, id: `local-${coachId}` });
      return {
        ok: true,
        error: undefined,
        usedLocalFallback: true as const,
      };
    }
    logError(error, { action: 'upsertCoachOffer', coachId });
    return {
      ok: false,
      error:
        'Could not save your coaching offer to the server. Your database may be missing the coach_offers table — run `supabase db push` from the project repo, then try again.',
    };
  }
  return { ok: true };
}

/** Idempotent: ensures one offer row exists (default package). */
export async function ensureDefaultCoachOffer(coachId: string | null, isDemoMode: boolean): Promise<boolean> {
  const existing = await fetchCoachOffer(coachId, isDemoMode);
  if (existing) return true;
  const r = await upsertCoachOffer(coachId, isDemoMode, { ...DEFAULT_COACH_OFFER });
  return r.ok;
}
