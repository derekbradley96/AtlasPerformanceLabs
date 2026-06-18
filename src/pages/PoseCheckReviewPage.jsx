/**
 * Coach: list clients with latest pose check status (this week submitted or not).
 * Click opens detail at /review-center/pose-checks/:poseCheckId.
 * Grouped by urgency: review now → missing this week → caught up.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shadows } from '@/ui/tokens';
import { getCoachClients } from '@/lib/checkins';
import { getWeekStartISO, getLatestPoseChecksForCoach } from '@/lib/poseChecks';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { generatePrepInsight } from '@/lib/atlasInsights';
import { useAuth } from '@/lib/AuthContext';
import { resolveViewerBodyweightUnit } from '@/lib/bodyMeasurementUnits';
import { ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const TIER_REVIEW = 0;
const TIER_MISSING = 1;
const TIER_DONE = 2;

function classifyPoseRow(latest, currentWeekStart) {
  if (!latest) return { tier: TIER_MISSING, label: 'No submission this week' };
  const thisWeek = latest.week_start === currentWeekStart;
  const reviewed = !!(latest.reviewed_at || latest.reviewed_by);
  if (thisWeek && !reviewed) return { tier: TIER_REVIEW, label: 'Needs your review' };
  if (!thisWeek) return { tier: TIER_MISSING, label: 'No submission this week' };
  return { tier: TIER_DONE, label: 'Reviewed this week' };
}

const SECTIONS = [
  { tier: TIER_REVIEW, title: 'Review now', subtitle: 'Submitted this week — add feedback', Icon: AlertCircle, border: colors.primary },
  { tier: TIER_MISSING, title: 'Missing this week', subtitle: 'Nudge or check in', Icon: Clock, border: colors.warning },
  { tier: TIER_DONE, title: 'Caught up', subtitle: 'Reviewed or no action needed', Icon: CheckCircle2, border: colors.border },
];

export default function PoseCheckReviewPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const viewerWU = resolveViewerBodyweightUnit(profile);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [latestMap, setLatestMap] = useState({});

  const currentWeekStart = useMemo(() => getWeekStartISO(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getCoachClients();
      if (cancelled) return;
      setClients(list);
      const ids = list.map((c) => c.id).filter(Boolean);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const rows = await getLatestPoseChecksForCoach(ids);
      if (cancelled) return;
      const map = {};
      for (const r of rows) map[r.client_id] = r;
      setLatestMap(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const clientIds = useMemo(() => clients.map((c) => c.id).filter(Boolean), [clients]);
  const { data: prepHeaders = [] } = useQuery({
    queryKey: ['v_client_prep_header_list', clientIds],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || clientIds.length === 0) return [];
      const { data, error } = await getSupabase()
        .from('v_client_prep_header')
        .select('*')
        .in('client_id', clientIds);
      return error ? [] : (Array.isArray(data) ? data : []);
    },
    enabled: clientIds.length > 0,
  });
  const prepByClientId = useMemo(() => {
    const map = {};
    for (const row of prepHeaders) if (row?.client_id) map[row.client_id] = row;
    return map;
  }, [prepHeaders]);

  const { data: queuePoseItems = [] } = useQuery({
    queryKey: ['pose-review-queue-fallback', profile?.id],
    queryFn: async () => {
      if (!hasSupabase || !getSupabase() || !profile?.id) return [];
      const { data, error } = await getSupabase()
        .from('v_coach_review_queue')
        .select('client_id, client_name, payload, created_at, resolved_at')
        .eq('coach_id', profile.id)
        .eq('item_type', 'pose_check')
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      if (error || !Array.isArray(data)) return [];
      return data;
    },
    enabled: !!profile?.id,
  });

  const enrichedRows = useMemo(() => {
    return clients.map((client) => {
      const latest = latestMap[client.id] || null;
      const { tier, label } = classifyPoseRow(latest, currentWeekStart);
      const prep = prepByClientId[client.id] ?? null;
      const prepData = prep
        ? {
            has_active_prep: true,
            days_out: prep.days_out,
            show_date: prep.show_date,
            pose_check_submitted_this_week: prep.pose_check_submitted_this_week === true,
            show_name: prep.show_name,
            division: prep.division,
          }
        : null;
      const prepInsight = prepData ? generatePrepInsight(prepData, viewerWU) : null;
      const prepSummary = prepInsight && prepInsight.title !== 'No active prep' ? prepInsight.summary : null;
      const peakHint =
        prep?.is_peak_week === true
          ? 'Peak week'
          : prep?.days_out != null && prep.days_out <= 14
            ? `${prep.days_out}d to show`
            : null;
      return { client, latest, tier, statusLabel: label, prepSummary, peakHint };
    });
  }, [clients, latestMap, currentWeekStart, prepByClientId, viewerWU]);

  const byTier = useMemo(() => {
    const m = { [TIER_REVIEW]: [], [TIER_MISSING]: [], [TIER_DONE]: [] };
    for (const row of enrichedRows) {
      m[row.tier].push(row);
    }
    const sortFn = (a, b) => {
      const ta = a.latest?.submitted_at ? new Date(a.latest.submitted_at).getTime() : 0;
      const tb = b.latest?.submitted_at ? new Date(b.latest.submitted_at).getTime() : 0;
      return tb - ta;
    };
    m[TIER_REVIEW].sort(sortFn);
    m[TIER_MISSING].sort((a, b) => (a.client.name || '').localeCompare(b.client.name || ''));
    m[TIER_DONE].sort(sortFn);
    return m;
  }, [enrichedRows]);

  const fallbackRows = useMemo(() => {
    if (enrichedRows.length > 0) return [];
    return (queuePoseItems || []).map((item) => ({
      id: item?.payload?.pose_check_id || `${item.client_id}-${item.created_at}`,
      clientName: item?.client_name || 'Client',
      clientId: item?.client_id || null,
      poseCheckId: item?.payload?.pose_check_id || null,
      submittedAt: item?.payload?.submitted_at || item?.created_at || null,
    }));
  }, [enrichedRows.length, queuePoseItems]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Posing review" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Posing review" onBack={() => navigate(-1)} />
      <div className="p-4 pb-8">
        <Card
          style={{
            padding: spacing[16],
            marginBottom: spacing[16],
            border: `1px solid ${colors.primary}44`,
            boxShadow: shadows.glow,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: colors.text }}>Weekly posing queue</p>
          <p className="text-xs mt-1" style={{ color: colors.muted }}>
            Week of {currentWeekStart} · Start with <strong style={{ color: colors.text }}>Review now</strong>, then chase missing submissions.
          </p>
        </Card>

        {enrichedRows.length === 0 && fallbackRows.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p style={{ color: colors.muted }}>No clients yet.</p>
          </Card>
        ) : enrichedRows.length === 0 && fallbackRows.length > 0 ? (
          <section style={{ marginBottom: spacing[20] }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} style={{ color: colors.primary }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.text }}>Review now</p>
                <p className="text-[11px]" style={{ color: colors.muted }}>
                  Items from your review queue · {fallbackRows.length} client{fallbackRows.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {fallbackRows.map((row) => (
                <Card
                  key={row.id}
                  style={{
                    padding: spacing[14],
                    cursor: row.poseCheckId ? 'pointer' : 'default',
                    borderLeft: `4px solid ${colors.primary}`,
                  }}
                  onClick={() => row.poseCheckId && navigate(`/review-center/pose-checks/${row.poseCheckId}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: colors.text }}>
                        {row.clientName}
                      </p>
                      <p className="text-sm" style={{ color: colors.primary }}>
                        Needs your review
                      </p>
                      {row.submittedAt && (
                        <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
                          Submitted {new Date(row.submittedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {row.poseCheckId && <ChevronRight size={20} style={{ color: colors.muted, flexShrink: 0 }} />}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          SECTIONS.map(({ tier, title, subtitle, Icon, border }) => {
            const list = byTier[tier] || [];
            if (list.length === 0) return null;
            return (
              <section key={tier} style={{ marginBottom: spacing[20] }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} style={{ color: tier === TIER_REVIEW ? colors.primary : tier === TIER_MISSING ? colors.warning : colors.muted }} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.text }}>{title}</p>
                    <p className="text-[11px]" style={{ color: colors.muted }}>{subtitle} · {list.length} client{list.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {list.map(({ client, latest, statusLabel, prepSummary, peakHint }) => (
                    <Card
                      key={client.id}
                      style={{
                        padding: spacing[14],
                        cursor: latest?.id ? 'pointer' : 'default',
                        borderLeft: `4px solid ${border}`,
                      }}
                      onClick={() => latest?.id && navigate(`/review-center/pose-checks/${latest.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: colors.text }}>
                            {client.full_name || client.name || 'Client'}
                          </p>
                          <p className="text-sm" style={{ color: tier === TIER_REVIEW ? colors.primary : colors.muted }}>
                            {statusLabel}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {peakHint && (
                              <span
                                className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                                style={{ background: colors.warningSubtle, color: colors.warning }}
                              >
                                {peakHint}
                              </span>
                            )}
                          </div>
                          {prepSummary && (
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: colors.muted }}>
                              {prepSummary}
                            </p>
                          )}
                          {latest?.submitted_at && (
                            <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
                              Submitted {new Date(latest.submitted_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {latest?.id && <ChevronRight size={20} style={{ color: colors.muted, flexShrink: 0 }} />}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
