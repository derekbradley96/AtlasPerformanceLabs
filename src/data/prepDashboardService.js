import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { listClients } from '@/data/supabaseClientsRepo';
import { resolveClientDeliveryContext } from '@/lib/accessModel';
import {
  derivePrepPhaseBucket,
  deriveWeightTrendState,
  deriveAdherenceBucket,
  deriveWaterStability,
  deriveSodiumStability,
  deriveRollupStatus,
  derivePrepInsights,
} from '@/lib/prepDashboardEngine';

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {object} row
 * @param {string|null} coachFocus
 */
export function isPrepRosterClient(row, coachFocus) {
  return resolveClientDeliveryContext({ clientRow: row, linkedCoachFocus: coachFocus }) === 'competition';
}

/**
 * @param {string} trainerId
 * @param {string|null} coachFocus
 */
export async function fetchPrepDashboardData(trainerId, coachFocus) {
  if (!hasSupabase || !trainerId) {
    return { prepClients: [], byId: {} };
  }
  const sb = getSupabase();
  const all = await listClients(trainerId);
  const prepRows = (Array.isArray(all) ? all : []).filter((r) => isPrepRosterClient(r, coachFocus));
  const ids = prepRows.map((r) => r.id).filter(Boolean);
  if (!ids.length) {
    return { prepClients: [], byId: {} };
  }

  const since = daysAgoIso(21);

  const [checkinsRes, plansRes, precisionRes, dailyRes, peakRes, adherRes] = await Promise.all([
    sb
      .from('checkins')
      .select('id, client_id, submitted_at, reviewed_at, weight, nutrition_adherence')
      .in('client_id', ids)
      .order('submitted_at', { ascending: false })
      .limit(400),
    sb.from('nutrition_plans').select('id, client_id, calories, protein, carbs, fats, phase, peak_week, is_active, diet_type').in('client_id', ids),
    sb.from('client_prep_precision').select('*').in('client_id', ids),
    sb.from('client_prep_precision_daily').select('*').in('client_id', ids).gte('day_date', daysAgoIso(14)),
    sb.from('peak_weeks').select('id, client_id, is_active').in('client_id', ids).eq('is_active', true),
    sb.from('nutrition_daily_adherence').select('client_id, day_date, macros_hit_percent').in('client_id', ids).gte('day_date', since).order('day_date', { ascending: false }),
  ]);

  const checkins = !checkinsRes.error && Array.isArray(checkinsRes.data) ? checkinsRes.data : [];
  const plans = !plansRes.error && Array.isArray(plansRes.data) ? plansRes.data : [];
  const precisions = !precisionRes.error && Array.isArray(precisionRes.data) ? precisionRes.data : [];
  const dailies = !dailyRes.error && Array.isArray(dailyRes.data) ? dailyRes.data : [];
  const peaks = !peakRes.error && Array.isArray(peakRes.data) ? peakRes.data : [];
  const adherRows = !adherRes.error && Array.isArray(adherRes.data) ? adherRes.data : [];

  const checkinsByClient = new Map();
  for (const c of checkins) {
    const cid = c.client_id;
    if (!cid) continue;
    if (!checkinsByClient.has(cid)) checkinsByClient.set(cid, []);
    if (checkinsByClient.get(cid).length < 8) checkinsByClient.get(cid).push(c);
  }

  const plansByClient = new Map();
  for (const p of plans) {
    const cid = p.client_id;
    if (!cid) continue;
    const cur = plansByClient.get(cid);
    if (!cur) {
      plansByClient.set(cid, p);
      continue;
    }
    if (p.is_active && !cur.is_active) plansByClient.set(cid, p);
    else if (p.is_active === cur.is_active && p.id && cur.id && String(p.id) > String(cur.id)) {
      plansByClient.set(cid, p);
    }
  }

  const precisionByClient = new Map(precisions.map((r) => [r.client_id, r]));
  const dailyByClient = new Map();
  for (const d of dailies) {
    const cid = d.client_id;
    if (!cid) continue;
    if (!dailyByClient.has(cid)) dailyByClient.set(cid, []);
    dailyByClient.get(cid).push(d);
  }
  for (const [, arr] of dailyByClient) {
    arr.sort((a, b) => String(a.day_date).localeCompare(String(b.day_date)));
  }

  const peakActive = new Set(peaks.map((p) => p.client_id).filter(Boolean));

  const adherByClient = new Map();
  for (const a of adherRows) {
    const cid = a.client_id;
    if (!cid) continue;
    if (!adherByClient.has(cid)) adherByClient.set(cid, []);
    if (adherByClient.get(cid).length < 14) adherByClient.get(cid).push(Number(a.macros_hit_percent));
  }

  const byId = {};
  const prepClients = prepRows.map((client) => {
    const cid = client.id;
    const clientCheckins = checkinsByClient.get(cid) || [];
    const weightsChrono = [...clientCheckins]
      .reverse()
      .map((c) => Number(c.weight))
      .filter((n) => Number.isFinite(n) && n > 0);
    const plan = plansByClient.get(cid) || null;
    const peakWeekActive = peakActive.has(cid);
    const phaseBucket = derivePrepPhaseBucket(plan?.phase, peakWeekActive, !!plan?.peak_week);
    const weightTrend = deriveWeightTrendState(weightsChrono, phaseBucket);

    const adherSamples = adherByClient.get(cid) || [];
    const adherAvg =
      adherSamples.length > 0
        ? adherSamples.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0) / adherSamples.length
        : null;
    const lastCheckinAdher = clientCheckins[0]?.nutrition_adherence;
    const hitPct = Number.isFinite(Number(lastCheckinAdher)) ? Number(lastCheckinAdher) : adherAvg;
    const adherence = deriveAdherenceBucket(hitPct);

    const prec = precisionByClient.get(cid) || null;
    const dList = dailyByClient.get(cid) || [];
    const waterActuals = dList.map((d) => d.water_actual_ml).filter((v) => v != null);
    const sodiumActuals = dList.map((d) => d.sodium_actual_mg).filter((v) => v != null);
    const water = deriveWaterStability(waterActuals, prec?.water_target_ml);
    const sodium = deriveSodiumStability(sodiumActuals, prec?.sodium_target_mg);

    const rollup = deriveRollupStatus({ weightTrend, adherence, water, sodium });
    const insights = derivePrepInsights({ weightTrend, adherence, water, sodium, rollup });

    const unreviewed = clientCheckins.filter((c) => c.submitted_at && !c.reviewed_at);
    const hasUnreviewedRecent = unreviewed.some((c) => {
      const t = new Date(c.submitted_at).getTime();
      return Date.now() - t < 14 * 86400000;
    });

    const latestCheckinId = clientCheckins[0]?.id ?? null;

    const row = {
      client,
      plan,
      prepPrecision: prec,
      prepDailies: dList,
      latestCheckins: clientCheckins,
      phaseBucket,
      weightTrend,
      weightSeries: weightsChrono.slice(-6),
      adherence,
      hitPct: Number.isFinite(hitPct) ? Math.round(hitPct) : null,
      water,
      sodium,
      rollup,
      insights,
      hasUnreviewedRecent,
      latestCheckinId,
      dayType: prec?.day_type || null,
    };
    byId[cid] = row;
    return row;
  });

  return { prepClients, byId };
}
