/**
 * Coaching insights engine
 *
 * High-level helpers that analyse check-ins, habits, engagement, and programs
 * and write summarised insights into public.coaching_insights / public.progress_trends.
 *
 * NOTE: These helpers are intentionally defensive and can be wired gradually.
 * They should be called from backend jobs or privileged Edge Functions, not
 * directly from the browser without RLS in place.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function getClient() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  return supabase || null;
}

/**
 * Generate all insights for a single client.
 * Increments public.coaching_insights and public.progress_trends based on signals.
 */
export async function generateClientInsights(clientId) {
  if (!clientId) return [];
  const supabase = getClient();
  if (!supabase) return [];

  // Preload graph data that can be shared across detectors to keep latency low.
  const graphContext = await buildGraphContext(clientId, supabase);

  const results = [];
  const detectors = [
    detectWeightPlateau,
    detectEngagementDrop,
    detectHabitAdherenceIssue,
    detectPrepRisk,
    detectCheckinOverdue,
    detectProgramStall,
  ];

  for (const fn of detectors) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const insight = await fn(clientId, { supabase, graph: graphContext });
      if (insight) results.push(insight);
    } catch (e) {
      if (import.meta.env.DEV) {
        // Do not throw; a single detector should not break the whole pipeline.
        // eslint-disable-next-line no-console
        console.error('[coachingInsightsEngine] detector failed', fn.name, e?.message);
      }
    }
  }

  return results;
}

/**
 * Build a lightweight intelligence graph for a client from:
 * - performance_events
 * - progress_trends
 * - client_outcomes
 *
 * This gives each detector richer context without repeating queries.
 */
async function buildGraphContext(clientId, supabase) {
  if (!supabase || !clientId) return {};

  const context = {
    events: [],
    trends: [],
    outcomes: [],
  };

  const promises = [
    supabase
      .from('performance_events')
      .select('id, event_type, event_data, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('progress_trends')
      .select('id, trend_type, trend_status, trend_value, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('client_outcomes')
      .select('id, coach_id, outcome_type, starting_weight, ending_weight, bodyfat_change, competition_placing, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10),
  ];

  const [eventsRes, trendsRes, outcomesRes] = await Promise.all(promises);

  if (!eventsRes.error && Array.isArray(eventsRes.data)) {
    context.events = eventsRes.data;
  }
  if (!trendsRes.error && Array.isArray(trendsRes.data)) {
    context.trends = trendsRes.data;
  }
  if (!outcomesRes.error && Array.isArray(outcomesRes.data)) {
    context.outcomes = outcomesRes.data;
  }

  return context;
}

/**
 * Weight plateau detection.
 * Rough heuristic: flat weight trend over recent check-ins or v_client_retention_signals.
 */
export async function detectWeightPlateau(clientId, { supabase: externalClient, graph } = {}) {
  const supabase = externalClient || getClient();
  if (!supabase || !clientId) return null;

  // Prefer progress_trends with trend_type = 'weight' + client_outcomes.
  const trends = Array.isArray(graph?.trends) ? graph.trends : [];
  const weightTrend = trends.find((t) => t.trend_type === 'weight') || null;

  // If we have a clear improving or healthy trend, do not raise a plateau.
  if (weightTrend && (weightTrend.trend_status === 'improving' || weightTrend.trend_status === 'stable')) {
    return null;
  }

  const outcomes = Array.isArray(graph?.outcomes) ? graph.outcomes : [];
  const latestOutcome = outcomes[0] || null;

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!clientRow?.coach_id) return null;

  // If trend explicitly says plateau or declining, escalate severity.
  const status = weightTrend?.trend_status || null;
  const baseSeverity = status === 'declining' ? 'high' : 'medium';

  const descriptionParts = [];
  if (status === 'plateau') {
    descriptionParts.push('Recent weight trend is flat over the last period.');
  } else if (status === 'declining') {
    descriptionParts.push('Recent weight trend is moving in the wrong direction for the stated goal.');
  } else {
    descriptionParts.push('Intelligence graph suggests weight progress may have slowed.');
  }

  if (latestOutcome) {
    descriptionParts.push('There is a recorded outcome for this client; review whether current progress still points toward that result.');
  }

  const description = descriptionParts.join(' ');

  const { data, error } = await supabase
    .from('coaching_insights')
    .insert({
      client_id: clientRow.id,
      coach_id: clientRow.coach_id,
      insight_type: 'weight_plateau',
      severity: baseSeverity,
      title: 'Weight trend needs review',
      description,
      metadata: {
        trend_status: status,
        trend_value: weightTrend?.trend_value ?? null,
        outcome_type: latestOutcome?.outcome_type ?? null,
        outcome_created_at: latestOutcome?.created_at ?? null,
      },
    })
    .select('*')
    .single();

  if (error) return null;
  return data;
}

/**
 * Engagement drop detection based on client_engagement_events and retention signals.
 */
export async function detectEngagementDrop(clientId, { supabase: externalClient, graph } = {}) {
  const supabase = externalClient || getClient();
  if (!supabase || !clientId) return null;

  // Use performance_events to see if there has been recent activity even if retention view is slow to update.
  const events = Array.isArray(graph?.events) ? graph.events : [];
  const now = Date.now();
  const activeWindowMs = 7 * 24 * 60 * 60 * 1000;
  const hasRecentEngagement = events.some((evt) => {
    if (!evt.created_at) return false;
    const t = new Date(evt.created_at).getTime();
    if (Number.isNaN(t)) return false;
    if (now - t > activeWindowMs) return false;
    // Count check-ins, messages, habit logs, program changes as engagement.
    const type = evt.event_type || '';
    return /checkin|message|habit|program/i.test(type);
  });

  const { data: signal } = await supabase
    .from('v_client_retention_signals')
    .select('coach_id, engagement_score, risk_reason')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!signal?.coach_id) return null;

  // If graph shows clear recent activity, be more lenient on low engagement_score.
  if (hasRecentEngagement && signal.engagement_score != null && signal.engagement_score >= 25) {
    return null;
  }

  if (signal.engagement_score != null && signal.engagement_score >= 40 && !hasRecentEngagement) {
    return null;
  }

  const { data, error } = await supabase
    .from('coaching_insights')
    .insert({
      client_id: clientId,
      coach_id: signal.coach_id,
      insight_type: 'engagement_drop',
      severity: signal.engagement_score != null && signal.engagement_score < 20 ? 'high' : 'medium',
      title: 'Engagement dropping',
      description: 'Engagement events over the last 14 days are low. Consider a re‑engagement touchpoint.',
      metadata: {
        engagement_score: signal.engagement_score,
        risk_reason: signal.risk_reason ?? [],
        recent_events_window_7d: hasRecentEngagement,
      },
    })
    .select('*')
    .single();

  if (error) return null;
  return data;
}

/**
 * Habit adherence issues based on v_client_habit_adherence.
 */
export async function detectHabitAdherenceIssue(clientId, { supabase: externalClient } = {}) {
  const supabase = externalClient || getClient();
  if (!supabase || !clientId) return null;

  const { data: habits, error: habitsError } = await supabase
    .from('v_client_habit_adherence')
    .select('habit_id, habit_title, adherence_last_7d, adherence_last_30d')
    .eq('client_id', clientId);
  if (habitsError || !Array.isArray(habits) || habits.length === 0) return null;

  const lowHabits = habits.filter((h) => (h.adherence_last_7d ?? 100) < 50);
  if (lowHabits.length === 0) return null;

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!clientRow?.coach_id) return null;

  const { data, error } = await supabase
    .from('coaching_insights')
    .insert({
      client_id: clientRow.id,
      coach_id: clientRow.coach_id,
      insight_type: 'habit_adherence_low',
      severity: 'medium',
      title: 'Habit adherence is low',
      description: 'One or more key habits have adherence under 50% in the last 7 days.',
      metadata: {
        low_habits: lowHabits.slice(0, 5),
      },
    })
    .select('*')
    .single();

  if (error) return null;
  return data;
}

/**
 * Prep risk detection based on retention/pose/peak week signals.
 * For now, we re-use retention risk signals tagged as prep related.
 */
export async function detectPrepRisk(clientId, { supabase: externalClient } = {}) {
  const supabase = externalClient || getClient();
  if (!supabase || !clientId) return null;

  const { data: risk } = await supabase
    .from('v_client_retention_risk')
    .select('coach_id, risk_band, reasons')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!risk?.coach_id) return null;

  if (risk.risk_band === 'healthy' || risk.risk_band === 'watch') return null;

  const { data, error } = await supabase
    .from('coaching_insights')
    .insert({
      client_id: clientId,
      coach_id: risk.coach_id,
      insight_type: 'prep_risk',
      severity: risk.risk_band === 'churn_risk' ? 'high' : 'medium',
      title: 'Prep risk detected',
      description: 'Retention and engagement signals suggest this prep needs attention.',
      metadata: {
        risk_band: risk.risk_band,
        reasons: risk.reasons ?? [],
      },
    })
    .select('*')
    .single();

  if (error) return null;
  return data;
}

/**
 * Check-in overdue detection based on v_client_retention_signals.
 */
export async function detectCheckinOverdue(clientId, { supabase: externalClient } = {}) {
  const supabase = externalClient || getClient();
  if (!supabase || !clientId) return null;

  const { data: signal } = await supabase
    .from('v_client_retention_signals')
    .select('coach_id, days_since_last_checkin')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!signal?.coach_id) return null;

  if (signal.days_since_last_checkin == null || signal.days_since_last_checkin <= 7) {
    return null;
  }

  const severity = signal.days_since_last_checkin > 14 ? 'high' : 'medium';

  const { data, error } = await supabase
    .from('coaching_insights')
    .insert({
      client_id: clientId,
      coach_id: signal.coach_id,
      insight_type: 'checkin_overdue',
      severity,
      title: 'Check-in overdue',
      description: `Last check-in was ${signal.days_since_last_checkin} days ago. Consider sending a reminder or message.`,
      metadata: {
        days_since_last_checkin: signal.days_since_last_checkin,
      },
    })
    .select('*')
    .single();

  if (error) return null;
  return data;
}

/**
 * Program stall detection.
 * Placeholder: looks at progress_trends for program_compliance / engagement.
 */
export async function detectProgramStall(clientId, { supabase: externalClient, graph } = {}) {
  const supabase = externalClient || getClient();
  if (!supabase || !clientId) return null;

  const trends = Array.isArray(graph?.trends) ? graph.trends : [];
  const complianceTrend = trends.find((t) => t.trend_type === 'program_compliance') || null;
  const engagementTrend = trends.find((t) => t.trend_type === 'engagement') || null;

  if (!complianceTrend || !complianceTrend.trend_status) return null;

  const stalledStatuses = ['plateau', 'declining'];
  if (!stalledStatuses.includes(complianceTrend.trend_status)) return null;

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!clientRow?.coach_id) return null;

  const severity =
    complianceTrend.trend_status === 'declining' || (engagementTrend && engagementTrend.trend_status === 'declining')
      ? 'high'
      : 'medium';

  const { data, error } = await supabase
    .from('coaching_insights')
    .insert({
      client_id: clientRow.id,
      coach_id: clientRow.coach_id,
      insight_type: 'program_stall',
      severity,
      title: 'Program may be stalling',
      description: 'Program compliance trend suggests progress has stalled. Review volume, intensity, and adherence.',
      metadata: {
        compliance_trend_status: complianceTrend.trend_status,
        compliance_trend_value: complianceTrend.trend_value,
        engagement_trend_status: engagementTrend?.trend_status ?? null,
        engagement_trend_value: engagementTrend?.trend_value ?? null,
      },
    })
    .select('*')
    .single();

  if (error) return null;
  return data;
}

