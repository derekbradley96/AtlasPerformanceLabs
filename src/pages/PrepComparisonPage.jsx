/**
 * Prep Comparison – coaches compare two prep outcomes (Prep A vs Prep B).
 * Metrics: Stage weight, Peak week carbs, Water manipulation, Timeline.
 * Visual comparison with bar charts (Recharts).
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import EmptyState from '@/components/ui/EmptyState';
import { GitCompare, Calendar } from 'lucide-react';
import { safeFormatDate } from '@/lib/format';

const PREP_A_COLOR = colors.primary;
const PREP_B_COLOR = colors.accent;

async function fetchCoachClients(supabase, userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, name')
    .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('full_name');
  if (error) return [];
  return (data || []).map((c) => ({ id: c.id, name: c.full_name || c.name || 'Client' }));
}

export default function PrepComparisonPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const [clientId, setClientId] = useState('');
  const [outcomeAId, setOutcomeAId] = useState('');
  const [outcomeBId, setOutcomeBId] = useState('');

  const { data: clients = [] } = useQuery({
    queryKey: ['prep-comparison-clients', user?.id],
    queryFn: () => fetchCoachClients(supabase, user?.id),
    enabled: !!supabase && !!user?.id,
  });

  const { data: outcomes = [] } = useQuery({
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

  const outcomeA = useMemo(() => outcomes.find((o) => o.id === outcomeAId), [outcomes, outcomeAId]);
  const outcomeB = useMemo(() => outcomes.find((o) => o.id === outcomeBId), [outcomes, outcomeBId]);
  const canCompare = outcomeA && outcomeB && outcomeAId !== outcomeBId;

  const labelA = outcomeA ? `${outcomeA.show_name || 'Show'} ${outcomeA.show_date ? safeFormatDate(outcomeA.show_date) : ''}`.trim() || 'Prep A' : 'Prep A';
  const labelB = outcomeB ? `${outcomeB.show_name || 'Show'} ${outcomeB.show_date ? safeFormatDate(outcomeB.show_date) : ''}`.trim() || 'Prep B' : 'Prep B';

  const barData = useMemo(() => {
    if (!canCompare) return [];
    const num = (v) => (v != null && v !== '' ? Number(v) : 0);
    return [
      {
        metric: 'Stage weight (kg)',
        prepA: num(outcomeA.stage_weight),
        prepB: num(outcomeB.stage_weight),
      },
      {
        metric: 'Peak week carbs (g)',
        prepA: num(outcomeA.peak_week_carbs),
        prepB: num(outcomeB.peak_week_carbs),
      },
      {
        metric: 'Water (L)',
        prepA: num(outcomeA.peak_week_water),
        prepB: num(outcomeB.peak_week_water),
      },
    ].filter((row) => row.prepA > 0 || row.prepB > 0);
  }, [canCompare, outcomeA, outcomeB]);

  const tooltipStyle = {
    contentStyle: {
      background: colors.surface2,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      color: colors.text,
      fontSize: 12,
    },
  };

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Prep Comparison" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Compare two prep outcomes for stage weight, peak week strategy, and timeline.
        </p>

        <section style={{ marginBottom: spacing[20] }}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setOutcomeAId('');
              setOutcomeBId('');
            }}
            style={{
              width: '100%',
              padding: spacing[12],
              borderRadius: shell.cardRadius ?? 8,
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: 14,
            }}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </section>

        {!clientId && (
          <EmptyState
            title="Select a client"
            description="Choose a client with at least two prep outcomes to compare."
            icon={GitCompare}
          />
        )}

        {clientId && outcomes.length < 2 && outcomes.length > 0 && (
          <Card style={{ padding: spacing[24], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
            <p className="text-sm" style={{ color: colors.text }}>This client has only one recorded outcome. Add another in Prep History (Client Detail) to compare.</p>
          </Card>
        )}

        {clientId && outcomes.length === 0 && (
          <EmptyState
            title="No prep outcomes"
            description="Record outcomes in Client Detail → Prep section to compare here."
            icon={Calendar}
          />
        )}

        {clientId && outcomes.length >= 2 && (
          <>
            <section style={{ marginBottom: spacing[16] }}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Prep A</label>
              <select
                value={outcomeAId}
                onChange={(e) => setOutcomeAId(e.target.value)}
                style={{
                  width: '100%',
                  padding: spacing[12],
                  borderRadius: shell.cardRadius ?? 8,
                  background: colors.surface2,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: 14,
                }}
              >
                <option value="">Select outcome</option>
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === outcomeBId}>
                    {o.show_name || 'Show'} {o.show_date ? safeFormatDate(o.show_date) : ''} {o.division ? ` · ${o.division}` : ''}
                  </option>
                ))}
              </select>
            </section>

            <section style={{ marginBottom: spacing[20] }}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Prep B</label>
              <select
                value={outcomeBId}
                onChange={(e) => setOutcomeBId(e.target.value)}
                style={{
                  width: '100%',
                  padding: spacing[12],
                  borderRadius: shell.cardRadius ?? 8,
                  background: colors.surface2,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: 14,
                }}
              >
                <option value="">Select outcome</option>
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === outcomeAId}>
                    {o.show_name || 'Show'} {o.show_date ? safeFormatDate(o.show_date) : ''} {o.division ? ` · ${o.division}` : ''}
                  </option>
                ))}
              </select>
            </section>

            {canCompare && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
                  Prep A vs Prep B
                </h2>

                {/* Timeline comparison */}
                <Card style={{ padding: spacing[16], marginBottom: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>Timeline</p>
                  <div className="flex flex-wrap gap-4">
                    <div style={{ flex: '1 1 140px' }}>
                      <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Prep A</p>
                      <p className="font-medium" style={{ color: PREP_A_COLOR }}>{labelA}</p>
                      <p className="text-sm" style={{ color: colors.text }}>{outcomeA.show_date ? safeFormatDate(outcomeA.show_date) : '—'}</p>
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Prep B</p>
                      <p className="font-medium" style={{ color: PREP_B_COLOR }}>{labelB}</p>
                      <p className="text-sm" style={{ color: colors.text }}>{outcomeB.show_date ? safeFormatDate(outcomeB.show_date) : '—'}</p>
                    </div>
                  </div>
                </Card>

                {/* Bar chart comparison */}
                {barData.length > 0 && (
                  <Card style={{ padding: spacing[16], marginBottom: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>Metrics</p>
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={barData}
                          layout="vertical"
                          margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                        >
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: colors.muted, fontSize: 10 }} />
                          <YAxis type="category" dataKey="metric" axisLine={false} tickLine={false} tick={{ fill: colors.text, fontSize: 11 }} width={100} />
                          <Tooltip {...tooltipStyle} formatter={(value) => [value, '']} labelFormatter={(label) => label} />
                          <Legend
                            formatter={(name) => <span style={{ color: colors.text, fontSize: 12 }}>{name}</span>}
                            wrapperStyle={{ paddingTop: 8 }}
                          />
                          <Bar dataKey="prepA" name={labelA} fill={PREP_A_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28}>
                            {barData.map((_, i) => (
                              <Cell key={`a-${i}`} fill={PREP_A_COLOR} />
                            ))}
                          </Bar>
                          <Bar dataKey="prepB" name={labelB} fill={PREP_B_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28}>
                            {barData.map((_, i) => (
                              <Cell key={`b-${i}`} fill={PREP_B_COLOR} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {/* Summary table */}
                <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>Summary</p>
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: colors.muted, fontWeight: 600 }}>Metric</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: PREP_A_COLOR }}>{labelA}</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: PREP_B_COLOR }}>{labelB}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '8px 0', color: colors.text }}>Stage weight</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeA.stage_weight != null ? `${outcomeA.stage_weight} kg` : '—'}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeB.stage_weight != null ? `${outcomeB.stage_weight} kg` : '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '8px 0', color: colors.text }}>Peak week carbs</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeA.peak_week_carbs != null ? `${outcomeA.peak_week_carbs} g` : '—'}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeB.peak_week_carbs != null ? `${outcomeB.peak_week_carbs} g` : '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '8px 0', color: colors.text }}>Water (L)</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeA.peak_week_water != null ? `${outcomeA.peak_week_water} L` : '—'}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeB.peak_week_water != null ? `${outcomeB.peak_week_water} L` : '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: colors.text }}>Show date</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeA.show_date ? safeFormatDate(outcomeA.show_date) : '—'}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: colors.text }}>{outcomeB.show_date ? safeFormatDate(outcomeB.show_date) : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </Card>
              </>
            )}

            {clientId && outcomes.length >= 2 && (outcomeAId === outcomeBId || !outcomeAId || !outcomeBId) && outcomeAId && outcomeBId && (
              <p className="text-sm mt-4" style={{ color: colors.muted }}>Select two different outcomes to compare.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
