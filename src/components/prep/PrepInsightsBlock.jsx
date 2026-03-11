/**
 * Renders prep-specific insight summaries (from prepInsights.js) for competition/integrated coaches.
 * Fetches header, metrics, pose count when clientId is provided. Renders nothing when no prep or no insights.
 */
import React, { useState, useEffect } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getPrepInsightSummaries } from '@/lib/prepInsights';
import InsightCard from '@/components/review/InsightCard';
import { colors, spacing } from '@/ui/tokens';

async function fetchPrepInsightsData(clientId) {
  if (!hasSupabase || !clientId) return { header: null, metrics: null, poseChecksLast4w: 0 };
  const supabase = getSupabase();
  if (!supabase) return { header: null, metrics: null, poseChecksLast4w: 0 };
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  try {
    const [headerRes, metricsRes, poseRes] = await Promise.all([
      supabase.from('v_client_prep_header').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('v_client_progress_metrics').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('pose_checks').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('submitted_at', fourWeeksAgo.toISOString()),
    ]);
    const poseChecksLast4w = poseRes.count ?? 0;
    return {
      header: headerRes.data ?? null,
      metrics: metricsRes.data ?? null,
      poseChecksLast4w,
    };
  } catch (_) {
    return { header: null, metrics: null, poseChecksLast4w: 0 };
  }
}

export default function PrepInsightsBlock({ clientId }) {
  const [data, setData] = useState({ header: null, metrics: null, poseChecksLast4w: 0 });

  useEffect(() => {
    if (!clientId) {
      setData({ header: null, metrics: null, poseChecksLast4w: 0 });
      return;
    }
    let cancelled = false;
    fetchPrepInsightsData(clientId).then((out) => {
      if (!cancelled) setData(out);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  const summaries = getPrepInsightSummaries(data.header, data.metrics, {
    poseChecksLast4w: data.poseChecksLast4w,
    poseSubmittedThisWeek: data.header?.pose_check_submitted_this_week === true,
  });

  if (summaries.length === 0) return null;

  return (
    <div style={{ marginBottom: spacing[12] }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
        Prep insights
      </p>
      {summaries.map((s, i) => (
        <InsightCard key={i} level={s.level} title={s.title} detail={s.detail} />
      ))}
    </div>
  );
}
