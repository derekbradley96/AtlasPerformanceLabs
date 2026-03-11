/**
 * Prep Data Vault – historical prep outcomes for a client.
 * Fetches prep_outcomes and displays Show, Division, Stage Weight, Peak Week Strategy, Coach Notes.
 * Used in Client Detail Prep section (competition/integrated coaches).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { History } from 'lucide-react';
import { safeFormatDate } from '@/lib/format';

function formatPeakWeekStrategy(outcome) {
  const parts = [];
  if (outcome.peak_week_carbs != null && outcome.peak_week_carbs !== '') parts.push(`${outcome.peak_week_carbs} g carbs`);
  if (outcome.peak_week_water != null && outcome.peak_week_water !== '') parts.push(`${Number(outcome.peak_week_water)} L water`);
  if (outcome.peak_week_sodium != null && outcome.peak_week_sodium !== '') parts.push(`${outcome.peak_week_sodium} mg sodium`);
  return parts.length ? parts.join(', ') : '—';
}

export default function PrepHistoryCard({ clientId }) {
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: outcomes = [], isLoading } = useQuery({
    queryKey: ['prep_outcomes', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('prep_outcomes')
        .select('*')
        .eq('client_id', clientId)
        .order('show_date', { ascending: false });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!clientId,
  });

  if (!clientId) return null;

  return (
    <div style={{ marginBottom: spacing[16] }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
        Prep History
      </p>
      {isLoading ? (
        <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
          <div className="animate-pulse flex flex-col gap-3">
            <div className="h-4 rounded bg-white/10 w-3/4" />
            <div className="h-3 rounded bg-white/10 w-1/2" />
            <div className="h-3 rounded bg-white/10 w-full" />
          </div>
        </Card>
      ) : outcomes.length === 0 ? (
        <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
          <div className="flex items-center gap-2" style={{ color: colors.muted }}>
            <History size={18} />
            <span className="text-sm">No past outcomes recorded</span>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {outcomes.map((o) => (
            <Card
              key={o.id}
              style={{
                padding: spacing[16],
                border: `1px solid ${colors.border}`,
                borderRadius: shell.cardRadius ?? 8,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium" style={{ color: colors.text }}>
                    {o.show_name || 'Show'}
                    {o.show_date ? ` · ${safeFormatDate(o.show_date)}` : ''}
                  </p>
                  {o.division && (
                    <p className="text-sm mt-0.5" style={{ color: colors.muted }}>{o.division}</p>
                  )}
                </div>
                {o.placing && (
                  <span
                    className="shrink-0 px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: colors.primarySubtle, color: colors.primary }}
                  >
                    {o.placing}
                  </span>
                )}
              </div>
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-xs" style={{ color: colors.muted }}>Stage weight</span>
                  <p className="font-medium" style={{ color: colors.text }}>
                    {o.stage_weight != null && o.stage_weight !== '' ? `${Number(o.stage_weight)} kg` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs" style={{ color: colors.muted }}>Peak week strategy</span>
                  <p className="font-medium" style={{ color: colors.text }}>{formatPeakWeekStrategy(o)}</p>
                </div>
                {o.coach_notes && (
                  <div>
                    <span className="text-xs" style={{ color: colors.muted }}>Coach notes</span>
                    <p className="mt-0.5 whitespace-pre-wrap" style={{ color: colors.text }}>{o.coach_notes}</p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
