/**
 * Coach: list clients with latest pose check status (this week submitted or not).
 * Click opens detail at /review-center/pose-checks/:poseCheckId.
 * Shows prep insight (generatePrepInsight) per client when they have active prep.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getCoachClients } from '@/lib/checkins';
import { getWeekStartISO, getLatestPoseChecksForCoach } from '@/lib/poseChecks';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { generatePrepInsight } from '@/lib/atlasInsights';
import { ChevronRight } from 'lucide-react';

const STATUS_SUBMITTED = 'submitted';
const STATUS_MISSED = 'missed';

function getStatus(latest, currentWeekStart) {
  if (!latest) return STATUS_MISSED;
  return latest.week_start === currentWeekStart ? STATUS_SUBMITTED : STATUS_MISSED;
}

export default function PoseCheckReviewPage() {
  const navigate = useNavigate();
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

  const rows = useMemo(() => {
    return clients.map((client) => {
      const latest = latestMap[client.id] || null;
      const status = getStatus(latest, currentWeekStart);
      const prep = prepByClientId[client.id] ?? null;
      const prepData = prep ? { has_active_prep: true, days_out: prep.days_out, show_date: prep.show_date, pose_check_submitted_this_week: prep.pose_check_submitted_this_week === true, show_name: prep.show_name, division: prep.division } : null;
      const prepInsight = prepData ? generatePrepInsight(prepData) : null;
      const prepSummary = prepInsight && prepInsight.title !== 'No active prep' ? prepInsight.summary : null;
      return { client, latest, status, prepSummary };
    });
  }, [clients, latestMap, currentWeekStart, prepByClientId]);

  const statusLabel = (status) => (status === STATUS_SUBMITTED ? 'Submitted this week' : 'No submission');
  const statusColor = (status) => (status === STATUS_SUBMITTED ? colors.primary : colors.muted);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose check review" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Pose check review" onBack={() => navigate(-1)} />
      <div className="p-4 pb-8">
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Week of {currentWeekStart}
        </p>
        {rows.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p style={{ color: colors.muted }}>No clients yet.</p>
          </Card>
        ) : (
          rows.map(({ client, latest, status, prepSummary }) => (
            <Card
              key={client.id}
              style={{ marginBottom: spacing[12], padding: spacing[16], cursor: latest ? 'pointer' : 'default' }}
              onClick={() => latest?.id && navigate(`/review-center/pose-checks/${latest.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color: colors.text }}>
                    {client.full_name || client.name || 'Client'}
                  </p>
                  <p className="text-sm" style={{ color: statusColor(status) }}>
                    {statusLabel(status)}
                  </p>
                  {prepSummary && (
                    <p className="text-xs mt-1" style={{ color: colors.muted }}>
                      {prepSummary}
                    </p>
                  )}
                  {latest?.submitted_at && (
                    <p className="text-xs mt-1" style={{ color: colors.muted }}>
                      Submitted {new Date(latest.submitted_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {latest?.id && (
                  <ChevronRight size={20} style={{ color: colors.muted }} />
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
