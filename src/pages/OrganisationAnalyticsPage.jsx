/**
 * Organisation Analytics – owner/admin view of team-wide performance.
 * Aggregates across all active coaches in the organisation.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, radii, shadows } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel } from '@/ui/pageLayout';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { resolveOrgCoachScope } from '@/lib/organisationScope';
import { getWeekStartISO } from '@/lib/checkins';
import {
  Users,
  UserCheck,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  MessageCircle,
} from 'lucide-react';
import { OrganisationAnalyticsSkeleton } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';

const LOW_MOMENTUM_THRESHOLD = 50;

async function fetchOrganisationAnalytics() {
  if (!hasSupabase) {
    return null;
  }
  const supabase = getSupabase();
  if (!supabase) return null;

  const scope = await resolveOrgCoachScope();
  if (!scope || !scope.orgId) {
    return { organisation: null, mode: scope?.mode ?? 'none' };
  }

  // Restrict strictly to owner/admin for this page
  const myRoleRaw = (scope.myMember?.role || '').trim().toLowerCase();
  const isOwnerAdmin = myRoleRaw === 'owner' || myRoleRaw === 'admin';
  if (!isOwnerAdmin) {
    return { organisation: null, mode: scope.mode, forbidden: true };
  }

  const orgId = scope.orgId;
  const coachIds =
    Array.isArray(scope.coachIds) && scope.coachIds.length > 0
      ? scope.coachIds
      : scope.coachId
        ? [scope.coachId]
        : [];
  if (coachIds.length === 0) {
    return { organisation: null, mode: scope.mode };
  }

  const weekStart = getWeekStartISO();

  const [
    orgRes,
    clientsRes,
    membersRes,
    progressRes,
    retentionRes,
    reviewQueueRes,
    momentumRes,
    prepRes,
    moneyRes,
    referralAnalyticsRes,
    referralEnquiriesRes,
    referralProfilesRes,
    personalConversionRes,
  ] = await Promise.all([
    supabase.from('organisations').select('id, name').eq('id', orgId).maybeSingle(),
    supabase
      .from('clients')
      .select('id, assigned_coach_id, coach_id, trainer_id, organisation_id')
      .eq('organisation_id', orgId),
    supabase
      .from('organisation_members')
      .select('profile_id, role, is_active')
      .eq('organisation_id', orgId),
    supabase
      .from('v_client_progress_metrics')
      .select(
        'client_id, coach_id, client_name, avg_compliance_last_4w, active_flags_count, has_active_prep, show_date',
      )
      .in('coach_id', coachIds),
    supabase
      .from('v_client_retention_risk')
      .select('client_id, coach_id, client_name, risk_band, risk_score')
      .in('coach_id', coachIds),
    supabase
      .from('v_coach_review_queue')
      .select('coach_id, resolved_at')
      .in('coach_id', coachIds),
    supabase
      .from('v_client_momentum')
      .select('client_id, total_score')
      .eq('week_start', weekStart),
    supabase
      .from('contest_preps')
      .select('client_id, show_date, is_active')
      .eq('is_active', true)
      .eq('organisation_id', orgId)
      .catch?.(() => ({ data: [] })), // organisation_id may not exist; handled below
    supabase
      .from('v_coach_money_dashboard')
      .select(
        'coach_id, expected_mrr, expected_monthly_revenue, overdue_clients_count, active_clients_count',
      )
      .in('coach_id', coachIds),
    supabase
      .from('v_referral_analytics_by_coach')
      .select('coach_id, profile_views, result_story_views, enquiry_submits, conversion_rate')
      .in('coach_id', coachIds),
    supabase
      .from('coach_public_enquiries')
      .select('enquiry_type')
      .in('coach_id', coachIds),
    coachIds.length > 0
      ? supabase.from('profiles').select('id, full_name, display_name').in('id', coachIds)
      : Promise.resolve({ data: [] }),
    supabase.rpc('get_org_personal_conversion_metrics', { p_org_id: orgId }).single(),
  ]);

  const organisation = orgRes.data || { id: orgId, name: 'Organisation' };
  const clients = clientsRes.data || [];
  const members = (membersRes.data || []).filter((m) => m.is_active);
  const progress = progressRes.data || [];
  const retention = retentionRes.data || [];
  const reviewQueue = reviewQueueRes.data || [];
  const momentum = momentumRes.data || [];
  const preps = Array.isArray(prepRes?.data) ? prepRes.data : [];
  const moneyRows = moneyRes.data || [];

  const coachMemberRoles = ['owner', 'admin', 'coach'];
  const coachProfileIds = members
    .filter((m) => coachMemberRoles.includes((m.role || '').toLowerCase()))
    .map((m) => m.profile_id);

  const totalClients = clients.length;
  const activeCoaches = new Set(coachProfileIds).size;

  const complianceValues = progress
    .map((p) => Number(p.avg_compliance_last_4w))
    .filter((n) => !Number.isNaN(n));
  const avgCompliance =
    complianceValues.length > 0
      ? complianceValues.reduce((sum, v) => sum + v, 0) / complianceValues.length
      : null;

  const bandCounts = { healthy: 0, watch: 0, at_risk: 0, churn_risk: 0 };
  retention.forEach((r) => {
    const band = (r.risk_band || '').toLowerCase();
    if (band && bandCounts[band] != null) bandCounts[band] += 1;
  });

  const totalPendingReviews = reviewQueue.filter((r) => !r.resolved_at).length;

  const momentumScores = momentum
    .map((m) => Number(m.total_score))
    .filter((n) => !Number.isNaN(n));
  const avgMomentum =
    momentumScores.length > 0
      ? momentumScores.reduce((sum, v) => sum + v, 0) / momentumScores.length
      : null;
  const lowMomentumCount = momentumScores.filter((v) => v < LOW_MOMENTUM_THRESHOLD).length;

  const prepClients = new Set(preps.map((p) => p.client_id).filter(Boolean));

  const prepRosterSummary = {
    totalPrepClients: prepClients.size,
  };

  const moneyTotals = moneyRows.reduce(
    (acc, row) => {
      const mrr = Number(row.expected_mrr ?? row.expected_monthly_revenue);
      const overdue = Number(row.overdue_clients_count);
      const active = Number(row.active_clients_count);
      return {
        expectedRevenue:
          acc.expectedRevenue +
          (Number.isNaN(mrr) ? 0 : mrr),
        overdueClients:
          acc.overdueClients +
          (Number.isNaN(overdue) ? 0 : overdue),
        activeClients:
          acc.activeClients +
          (Number.isNaN(active) ? 0 : active),
      };
    },
    { expectedRevenue: 0, overdueClients: 0, activeClients: 0 },
  );

  const byCoach = {};
  coachIds.forEach((id) => {
    byCoach[id] = {
      coachId: id,
      assignedClients: 0,
      atRiskClients: 0,
      avgCompliance: null,
      pendingReviews: 0,
    };
  });

  const coachIdForClient = (c) => c.assigned_coach_id ?? c.coach_id ?? c.trainer_id;
  clients.forEach((c) => {
    const cid = coachIdForClient(c);
    if (!cid || !byCoach[cid]) return;
    byCoach[cid].assignedClients += 1;
  });

  const complianceByCoach = {};
  progress.forEach((p) => {
    const cid = p.coach_id;
    const v = Number(p.avg_compliance_last_4w);
    if (Number.isNaN(v) || !cid || !byCoach[cid]) return;
    if (!complianceByCoach[cid]) complianceByCoach[cid] = { sum: 0, count: 0 };
    complianceByCoach[cid].sum += v;
    complianceByCoach[cid].count += 1;
  });
  Object.entries(complianceByCoach).forEach(([cid, { sum, count }]) => {
    if (!byCoach[cid]) return;
    byCoach[cid].avgCompliance = count > 0 ? sum / count : null;
  });

  retention.forEach((r) => {
    const cid = r.coach_id;
    const band = (r.risk_band || '').toLowerCase();
    if (!cid || !byCoach[cid]) return;
    if (band === 'at_risk' || band === 'churn_risk') {
      byCoach[cid].atRiskClients += 1;
    }
  });

  reviewQueue.forEach((r) => {
    const cid = r.coach_id;
    if (!cid || !byCoach[cid]) return;
    if (!r.resolved_at) byCoach[cid].pendingReviews += 1;
  });

  const coachWorkload = Object.values(byCoach);

  const personalConversionPayload = personalConversionRes?.data ?? null;
  const personalConversion =
    personalConversionPayload && !personalConversionPayload.error
      ? {
          global: personalConversionPayload.global ?? {},
          by_coach: Array.isArray(personalConversionPayload.by_coach) ? personalConversionPayload.by_coach : [],
          by_focus: personalConversionPayload.by_focus && typeof personalConversionPayload.by_focus === 'object' ? personalConversionPayload.by_focus : {},
        }
      : null;

  const referralRows = referralAnalyticsRes?.data || [];
  const referralEnquiries = referralEnquiriesRes?.data || [];
  const profileList = referralProfilesRes?.data || [];
  const profileByName = Object.fromEntries(
    profileList.map((p) => [p.id, (p.display_name || p.full_name || 'Coach').trim() || 'Coach'])
  );
  const topViewedCoaches = referralRows
    .filter((r) => (r.profile_views || 0) > 0)
    .sort((a, b) => (b.profile_views || 0) - (a.profile_views || 0))
    .slice(0, 10)
    .map((r) => ({
      coach_id: r.coach_id,
      name: profileByName[r.coach_id] || 'Coach',
      profile_views: r.profile_views || 0,
      conversion_rate: r.conversion_rate,
    }));
  const enquiriesByType = {
    transformation: referralEnquiries.filter((e) => e.enquiry_type === 'transformation').length,
    competition: referralEnquiries.filter((e) => e.enquiry_type === 'competition').length,
    general: referralEnquiries.filter((e) => e.enquiry_type === 'general' || !e.enquiry_type).length,
  };

  return {
    organisation,
    summary: {
      totalClients,
      activeCoaches,
      avgCompliance,
      retentionBands: bandCounts,
      totalPendingReviews,
      avgMomentum,
      lowMomentumCount,
      moneyTotals,
      prepRosterSummary,
    },
    coachWorkload,
    referralAnalytics: {
      topViewedCoaches,
      enquiriesByType,
    },
    personalConversion,
  };
}

function Metric({ label, value, icon: Icon }) {
  return (
    <Card style={{ ...standardCard, padding: spacing[14], flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
        {Icon && <Icon size={16} />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: colors.text }}>
        {value}
      </p>
    </Card>
  );
}

export default function OrganisationAnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchOrganisationAnalytics();
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const organisation = data?.organisation;
  const summary = data?.summary;
  const coachWorkload = data?.coachWorkload || [];
  const forbidden = data?.forbidden;

  if (!hasSupabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view organisation analytics.</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <div className="text-center max-w-sm">
          <p style={{ color: colors.text }}>Organisation analytics are only available to owners and admins.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  if (!organisation && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <div className="text-center max-w-sm">
          <p style={{ color: colors.text }}>You’re not currently in an organisation.</p>
          <p className="text-sm mt-2" style={{ color: colors.muted }}>
            Join or create an organisation to access team-wide analytics.
          </p>
          <Button className="mt-4" onClick={() => navigate('/organisation/setup')}>
            Create organisation
          </Button>
        </div>
      </div>
    );
  }

  const retentionBands = summary?.retentionBands || { healthy: 0, watch: 0, at_risk: 0, churn_risk: 0 };
  const moneyTotals = summary?.moneyTotals || { expectedRevenue: 0, overdueClients: 0 };

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title={organisation?.name ? `${organisation.name} · Analytics` : 'Organisation analytics'}
        onBack={() => navigate(-1)}
      />

      <div className="p-4 max-w-lg mx-auto space-y-6" style={pageContainer}>
        {loading && <OrganisationAnalyticsSkeleton />}

        {!loading && summary && (summary.totalClients ?? 0) === 0 && (summary.activeCoaches ?? 0) <= 1 && (
          <EmptyState
            title="No analytics data yet"
            description="Add clients and assign them to coaches to see team-wide metrics, retention distribution, and workload here. Operations-focused view for owners and admins."
            icon={BarChart3}
            actionLabel="Go to Organisation"
            onAction={() => navigate('/organisation')}
          />
        )}

        {!loading && summary && ((summary.totalClients ?? 0) > 0 || (summary.activeCoaches ?? 0) > 1) && (
          <>
            {/* Org summary metrics */}
            <section>
              <p style={sectionLabel}>Overview</p>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Total clients" value={summary.totalClients ?? 0} icon={UserCheck} />
                <Metric label="Active coaches" value={summary.activeCoaches ?? 0} icon={Users} />
                <Metric
                  label="Avg compliance"
                  value={
                    summary.avgCompliance != null
                      ? `${summary.avgCompliance.toFixed(0)}%`
                      : '—'
                  }
                  icon={ClipboardCheck}
                />
                <Metric
                  label="Pending reviews"
                  value={summary.totalPendingReviews ?? 0}
                  icon={AlertTriangle}
                />
                <Metric
                  label="Avg momentum"
                  value={
                    summary.avgMomentum != null
                      ? summary.avgMomentum.toFixed(0)
                      : '—'
                  }
                  icon={TrendingUp}
                />
                <Metric
                  label="Low momentum"
                  value={summary.lowMomentumCount ?? 0}
                  icon={TrendingDown}
                />
              </div>
            </section>

            {/* Retention + Prep + Revenue */}
            <section>
              <p style={sectionLabel}>Retention & prep</p>
              <Card style={{ ...standardCard, padding: spacing[16], marginBottom: spacing[12] }}>
                <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                  Retention risk distribution
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span>Healthy: {retentionBands.healthy}</span>
                  <span>Watch: {retentionBands.watch}</span>
                  <span>At risk: {retentionBands.at_risk}</span>
                  <span>Churn risk: {retentionBands.churn_risk}</span>
                </div>
              </Card>
              <Card style={{ ...standardCard, padding: spacing[16], marginBottom: spacing[12] }}>
                <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                  Prep roster
                </p>
                <p className="text-sm" style={{ color: colors.muted }}>
                  Active prep clients: {summary.prepRosterSummary?.totalPrepClients ?? 0}
                </p>
              </Card>
              {moneyTotals && (moneyTotals.expectedRevenue > 0 || moneyTotals.overdueClients > 0) && (
                <Card style={{ ...standardCard, padding: spacing[16] }}>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: colors.text }}>
                    <BarChart3 size={16} />
                    <span>Revenue snapshot</span>
                  </p>
                  <p className="text-sm" style={{ color: colors.muted }}>
                    Expected monthly revenue:{' '}
                    {moneyTotals.expectedRevenue > 0
                      ? new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(moneyTotals.expectedRevenue)
                      : '—'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: colors.muted }}>
                    Overdue clients: {moneyTotals.overdueClients ?? 0}
                  </p>
                </Card>
              )}
            </section>

            {/* Referral & results analytics */}
            {(data?.referralAnalytics?.topViewedCoaches?.length > 0 ||
              (data?.referralAnalytics?.enquiriesByType &&
                (data.referralAnalytics.enquiriesByType.transformation +
                  data.referralAnalytics.enquiriesByType.competition +
                  data.referralAnalytics.enquiriesByType.general) > 0)) && (
              <section>
                <p style={sectionLabel}>Referral & results</p>
                <Card style={{ ...standardCard, padding: spacing[16], marginBottom: spacing[12] }}>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: colors.text }}>
                    <Eye size={16} />
                    Top viewed coaches
                  </p>
                  {data?.referralAnalytics?.topViewedCoaches?.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {data.referralAnalytics.topViewedCoaches.map((c) => (
                        <li key={c.coach_id} className="flex justify-between">
                          <span style={{ color: colors.text }}>{c.name}</span>
                          <span style={{ color: colors.muted }}>{c.profile_views} views</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm" style={{ color: colors.muted }}>
                      No profile views yet.
                    </p>
                  )}
                </Card>
                <Card style={{ ...standardCard, padding: spacing[16] }}>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: colors.text }}>
                    <MessageCircle size={16} />
                    Enquiries by type
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span style={{ color: colors.text }}>
                      Transformation: <strong>{data?.referralAnalytics?.enquiriesByType?.transformation ?? 0}</strong>
                    </span>
                    <span style={{ color: colors.text }}>
                      Competition / Prep: <strong>{data?.referralAnalytics?.enquiriesByType?.competition ?? 0}</strong>
                    </span>
                    <span style={{ color: colors.text }}>
                      General: <strong>{data?.referralAnalytics?.enquiriesByType?.general ?? 0}</strong>
                    </span>
                  </div>
                </Card>
              </section>
            )}

            {/* Personal to Coach conversion (marketplace funnel) */}
            {data?.personalConversion && (
              <section>
                <p style={sectionLabel}>Personal to Coach conversion</p>
                <Card style={{ ...standardCard, padding: spacing[16], marginBottom: spacing[12] }}>
                  <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                    Conversion rate (Personal users who joined a coach)
                  </p>
                  <p className="text-sm mb-3" style={{ color: colors.muted }}>
                    Opened Find a Coach: <strong>{data.personalConversion.global?.opened_find_a_coach ?? 0}</strong>
                    {' · '}
                    Converted to client: <strong>{data.personalConversion.global?.total_converted ?? 0}</strong>
                    {' · '}
                    Rate:{' '}
                    <strong>
                      {data.personalConversion.global?.conversion_rate != null
                        ? `${(Number(data.personalConversion.global.conversion_rate) * 100).toFixed(1)}%`
                        : '—'}
                    </strong>
                  </p>
                  {data.personalConversion.by_coach?.length > 0 && (
                    <>
                      <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                        Top converting coaches
                      </p>
                      <ul className="space-y-1 text-sm mb-3">
                        {data.personalConversion.by_coach.slice(0, 5).map((c) => (
                          <li key={c.coach_id} className="flex justify-between">
                            <span style={{ color: colors.text }}>{c.coach_name || 'Coach'}</span>
                            <span style={{ color: colors.muted }}>
                              {c.converted} converted
                              {c.conversion_rate != null ? ` · ${(Number(c.conversion_rate) * 100).toFixed(0)}%` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {data.personalConversion.by_focus && Object.keys(data.personalConversion.by_focus).length > 0 && (
                    <div className="flex flex-wrap gap-3 text-sm" style={{ color: colors.muted }}>
                      <span style={{ color: colors.text }}>Comp vs transformation split (converted):</span>
                      {Object.entries(data.personalConversion.by_focus).map(([focus, cnt]) => (
                        <span key={focus}>
                          {focus}: <strong style={{ color: colors.text }}>{cnt}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </section>
            )}

            {/* Coach workload breakdown */}
            <section>
              <p style={sectionLabel}>Coach workload</p>
              <Card style={{ ...standardCard, padding: 0 }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Coach
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Assigned
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Pending reviews
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Avg compliance
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          At-risk clients
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {coachWorkload.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-sm" style={{ color: colors.muted }}>
                            No active coaches in this organisation.
                          </td>
                        </tr>
                      ) : (
                        coachWorkload.map((row) => (
                          <tr key={row.coachId} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td className="p-3 text-sm" style={{ color: colors.text }}>
                              {row.coachId}
                            </td>
                            <td className="p-3 text-sm" style={{ color: colors.text }}>
                              {row.assignedClients}
                            </td>
                            <td className="p-3 text-sm" style={{ color: colors.text }}>
                              {row.pendingReviews}
                            </td>
                            <td className="p-3 text-sm" style={{ color: colors.text }}>
                              {row.avgCompliance != null ? `${row.avgCompliance.toFixed(0)}%` : '—'}
                            </td>
                            <td className="p-3 text-sm" style={{ color: row.atRiskClients > 0 ? colors.danger : colors.text }}>
                              {row.atRiskClients}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

