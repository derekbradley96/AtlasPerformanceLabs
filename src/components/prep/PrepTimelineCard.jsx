/**
 * Prep timeline card: weeks/days out, peak week proximity, optional conditioning summary.
 * Uses v_client_prep_header and v_client_progress_metrics. Renders nothing when no active prep.
 */
import React, { useState, useEffect } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { Calendar, Zap, TrendingUp } from 'lucide-react';

async function fetchPrepTimeline(clientId) {
  if (!hasSupabase || !clientId) return { header: null, metrics: null };
  const supabase = getSupabase();
  if (!supabase) return { header: null, metrics: null };
  try {
    const [headerRes, metricsRes] = await Promise.all([
      supabase.from('v_client_prep_header').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('v_client_progress_metrics').select('show_date, days_out, avg_compliance_last_4w, latest_weight, weight_change').eq('client_id', clientId).maybeSingle(),
    ]);
    return {
      header: headerRes.data ?? null,
      metrics: metricsRes.data ?? null,
    };
  } catch (_) {
    return { header: null, metrics: null };
  }
}

export default function PrepTimelineCard({ clientId }) {
  const [data, setData] = useState({ header: null, metrics: null });

  useEffect(() => {
    if (!clientId) {
      setData({ header: null, metrics: null });
      return;
    }
    let cancelled = false;
    fetchPrepTimeline(clientId).then((out) => {
      if (!cancelled) setData(out);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  const header = data.header;
  const metrics = data.metrics;
  if (!header) return null;

  const weeksOut = header.weeks_out != null ? Number(header.weeks_out) : null;
  const daysOut = header.days_out != null ? Number(header.days_out) : null;
  const isPeakWeek = header.is_peak_week === true;
  const showDate = header.show_date ? new Date(header.show_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
  const showPassed = daysOut != null && daysOut < 0;

  const hasConditioning = metrics && (metrics.avg_compliance_last_4w != null || metrics.latest_weight != null);

  return (
    <Card style={{ marginBottom: spacing[12], padding: spacing[16] }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: colors.muted }}>
        <Calendar size={14} />
        <span className="text-xs font-medium uppercase tracking-wide">Prep timeline</span>
        {showDate && <span className="text-xs">· {showDate}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-medium" style={{ color: colors.text }}>
          {showPassed ? 'Show passed' : null}
          {!showPassed && weeksOut != null && weeksOut >= 0 && `${weeksOut}w out`}
          {!showPassed && weeksOut != null && weeksOut >= 0 && daysOut != null && ' · '}
          {!showPassed && daysOut != null && daysOut >= 0 && `${daysOut} days`}
        </span>
        {isPeakWeek && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: colors.primary, color: '#fff' }}
          >
            <Zap size={12} /> Peak week
          </span>
        )}
      </div>
      {hasConditioning && (
        <div className="flex flex-wrap gap-3 pt-2 mt-2" style={{ borderTop: `1px solid ${colors.border}` }}>
          {metrics.avg_compliance_last_4w != null && (
            <span className="text-xs flex items-center gap-1" style={{ color: colors.muted }}>
              <TrendingUp size={12} />
              Compliance {Math.round(Number(metrics.avg_compliance_last_4w))}%
            </span>
          )}
          {metrics.latest_weight != null && (
            <span className="text-xs" style={{ color: colors.muted }}>
              Weight {Number(metrics.latest_weight).toFixed(1)} kg
              {metrics.weight_change != null && (
                <span style={{ color: Number(metrics.weight_change) < 0 ? colors.success : colors.text }}>
                  {' '}({Number(metrics.weight_change) > 0 ? '+' : ''}{Number(metrics.weight_change).toFixed(1)})
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
