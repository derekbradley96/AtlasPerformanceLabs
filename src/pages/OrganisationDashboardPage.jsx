/**
 * Organisation dashboard for coaching teams: org-level summaries, workload by coach, quick actions.
 * Restricted to users in an organisation. Uses organisation membership; owner/admin get full access.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { canManageTeam } from '@/lib/organisationPermissions';
import { getWeekStartISO } from '@/lib/checkins';
import {
  Users,
  UserCheck,
  Trophy,
  Target,
  ClipboardCheck,
  ListChecks,
  AlertTriangle,
  TrendingDown,
  UserPlus,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { OrganisationDashboardSkeleton } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';

const COACH_ROLES = ['owner', 'admin', 'coach'];
const LOW_MOMENTUM_THRESHOLD = 50;

async function fetchOrganisationDashboardPage() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .maybeSingle();

  let orgId = profile?.organisation_id ?? null;
  if (!orgId) {
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('organisation_id, role')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    orgId = membership?.organisation_id ?? null;
  }

  if (!orgId) {
    return { organisation: null, myRole: null, metrics: null, workload: [], canManage: false };
  }

  const { data: organisation } = await supabase
    .from('organisations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  const { data: myMember } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('organisation_id', orgId)
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  const canManage = canManageTeam(myMember ?? {});

  const [membersRes, clientsRes, prepsRes] = await Promise.all([
    supabase
      .from('organisation_members')
      .select('id, profile_id, role')
      .eq('organisation_id', orgId)
      .eq('is_active', true),
    supabase
      .from('clients')
      .select('id, coach_id, trainer_id, assigned_coach_id')
      .eq('organisation_id', orgId),
    supabase
      .from('contest_preps')
      .select('client_id')
      .eq('is_active', true),
  ]);

  const members = membersRes.data ?? [];
  const clients = clientsRes.data ?? [];
  const preps = prepsRes.data ?? [];
  const clientIds = clients.map((c) => c.id).filter(Boolean);
  const prepClientIds = new Set(preps.map((p) => p.client_id).filter(Boolean));
  const coachProfileIds = [...new Set(
    members.filter((m) => COACH_ROLES.includes((m.role || '').toLowerCase())).map((m) => m.profile_id).filter(Boolean)
  )];

  const competitionCount = clients.filter((c) => prepClientIds.has(c.id)).length;
  const transformationCount = Math.max(0, clients.length - competitionCount);

  const weekStart = getWeekStartISO();

  const [
    checkinsPendingRes,
    reviewQueueRes,
    retentionRiskRes,
    momentumRes,
    profilesRes,
    reviewQueueRowsRes,
    retentionRiskRowsRes,
  ] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from('checkins')
          .select('id', { count: 'exact', head: true })
          .in('client_id', clientIds)
          .not('submitted_at', 'is', null)
          .is('reviewed_at', null)
      : Promise.resolve({ count: 0 }),
    coachProfileIds.length > 0
      ? supabase
          .from('v_coach_review_queue')
          .select('id', { count: 'exact', head: true })
          .in('coach_id', coachProfileIds)
          .is('resolved_at', null)
      : Promise.resolve({ count: 0 }),
    clientIds.length > 0
      ? supabase
          .from('v_client_retention_risk')
          .select('client_id')
          .in('client_id', clientIds)
          .in('risk_band', ['at_risk', 'churn_risk'])
      : Promise.resolve({ data: [] }),
    clientIds.length > 0
      ? supabase
          .from('v_client_momentum')
          .select('client_id, total_score')
          .in('client_id', clientIds)
          .eq('week_start', weekStart)
      : Promise.resolve({ data: [] }),
    coachProfileIds.length > 0
      ? supabase.from('profiles').select('id, display_name, name').in('id', coachProfileIds)
      : Promise.resolve({ data: [] }),
    coachProfileIds.length > 0
      ? supabase.from('v_coach_review_queue').select('coach_id').in('coach_id', coachProfileIds).is('resolved_at', null)
      : Promise.resolve({ data: [] }),
    clientIds.length > 0
      ? supabase.from('v_client_retention_risk').select('coach_id, client_id').in('client_id', clientIds).in('risk_band', ['at_risk', 'churn_risk'])
      : Promise.resolve({ data: [] }),
  ]);

  const checkinsPending = checkinsPendingRes.count ?? 0;
  const reviewItemsPending = reviewQueueRes.count ?? 0;
  const highRiskClients = (retentionRiskRes.data ?? []).length;
  const momentumRows = momentumRes.data ?? [];
  const lowMomentumClients = momentumRows.filter((r) => {
    const s = r.total_score != null ? Number(r.total_score) : null;
    return s === null || s < LOW_MOMENTUM_THRESHOLD;
  }).length;

  const profiles = profilesRes.data ?? [];
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const queueByCoach = new Map();
  (reviewQueueRowsRes.data ?? []).forEach((r) => {
    if (r.coach_id) queueByCoach.set(r.coach_id, (queueByCoach.get(r.coach_id) || 0) + 1);
  });
  const riskByCoach = new Map();
  (retentionRiskRowsRes.data ?? []).forEach((r) => {
    if (r.coach_id) riskByCoach.set(r.coach_id, (riskByCoach.get(r.coach_id) || 0) + 1);
  });

  const coachIdFromClient = (c) => c.assigned_coach_id ?? c.coach_id ?? c.trainer_id;
  const clientByCoach = new Map();
  for (const c of clients) {
    const coachId = coachIdFromClient(c);
    if (!coachId) continue;
    if (!clientByCoach.has(coachId)) clientByCoach.set(coachId, []);
    clientByCoach.get(coachId).push(c);
  }

  const workload = coachProfileIds.map((profileId) => {
    const coachClients = clientByCoach.get(profileId) ?? [];
    const prepCount = coachClients.filter((c) => prepClientIds.has(c.id)).length;
    const p = profileMap.get(profileId);
    const name = p?.display_name || p?.name || 'Coach';
    return {
      profileId,
      coachName: name,
      assignedClients: coachClients.length,
      prepClients: prepCount,
      pendingReviews: queueByCoach.get(profileId) ?? 0,
      atRiskClients: riskByCoach.get(profileId) ?? 0,
    };
  });

  const activeCoaches = coachProfileIds.length;

  return {
    organisation: organisation ?? { id: orgId, name: 'Organisation' },
    myRole: myMember?.role ?? null,
    canManage,
    metrics: {
      totalActiveCoaches: activeCoaches,
      totalActiveClients: clients.length,
      competitionClients: competitionCount,
      transformationClients: transformationCount,
      checkinsPending,
      reviewItemsPending,
      highRiskClients,
      lowMomentumClients,
    },
    workload,
  };
}

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <Card style={{ ...standardCard, padding: spacing[14], flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
        {Icon && <Icon size={16} />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: accent || colors.text }}>
        {value}
      </p>
    </Card>
  );
}

const QUICK_ACTIONS_BASE = [
  { key: 'team', label: 'Manage Team', path: '/organisation/team', icon: Users, requiresManage: true },
  { key: 'analytics', label: 'View Organisation Analytics', path: '/organisation/analytics', icon: BarChart3, requiresManage: true },
  { key: 'clients', label: 'Assign Clients', path: '/clients', icon: UserPlus, requiresManage: false },
  { key: 'review', label: 'Review Queue', path: '/review-center/queue', icon: ListChecks, requiresManage: false },
];

export default function OrganisationDashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['organisation_dashboard_page'],
    queryFn: fetchOrganisationDashboardPage,
    enabled: hasSupabase,
  });

  if (!hasSupabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view organisation dashboard.</p>
      </div>
    );
  }

  const noOrg = data && !data.organisation;
  const metrics = data?.metrics;
  const workload = data?.workload ?? [];
  const canManage = data?.canManage ?? false;

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title={data?.organisation?.name ? `${data.organisation.name}` : 'Organisation'}
        onBack={() => navigate(-1)}
        rightAction={
          canManage ? (
            <button
              type="button"
              onClick={() => navigate('/organisation/team')}
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ color: colors.primary }}
            >
              Manage team
            </button>
          ) : undefined
        }
      />

      <div className="p-4 max-w-lg mx-auto space-y-6" style={pageContainer}>
        {isLoading && <OrganisationDashboardSkeleton />}
        {isError && <p style={{ color: colors.muted }}>Could not load organisation data.</p>}

        {noOrg && !isLoading && !isError && (
          <EmptyState
            title="No organisation yet"
            description="Create or join an organisation to see your team dashboard, workload, and org-wide metrics. Perfect for multi-coach teams and coaching brands."
            icon={Users}
            actionLabel="Create Team"
            onAction={() => navigate('/organisation/setup')}
          />
        )}

        {!noOrg && data?.organisation && (
          <>
            {/* Organisation-level summaries */}
            <section>
              <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={Users} label="Active coaches" value={metrics?.totalActiveCoaches ?? 0} />
                <MetricCard icon={UserCheck} label="Active clients" value={metrics?.totalActiveClients ?? 0} />
                <MetricCard icon={Trophy} label="Competition clients" value={metrics?.competitionClients ?? 0} />
                <MetricCard icon={Target} label="Transformation clients" value={metrics?.transformationClients ?? 0} />
                <MetricCard
                  icon={ClipboardCheck}
                  label="Check-ins pending"
                  value={metrics?.checkinsPending ?? 0}
                  accent={Number(metrics?.checkinsPending) > 0 ? colors.warning : undefined}
                />
                <MetricCard
                  icon={ListChecks}
                  label="Review items pending"
                  value={metrics?.reviewItemsPending ?? 0}
                  accent={Number(metrics?.reviewItemsPending) > 0 ? colors.warning : undefined}
                />
                <MetricCard
                  icon={AlertTriangle}
                  label="High-risk clients"
                  value={metrics?.highRiskClients ?? 0}
                  accent={Number(metrics?.highRiskClients) > 0 ? colors.danger : undefined}
                />
                <MetricCard
                  icon={TrendingDown}
                  label="Low momentum clients"
                  value={metrics?.lowMomentumClients ?? 0}
                  accent={Number(metrics?.lowMomentumClients) > 0 ? colors.warning : undefined}
                />
              </div>
            </section>

            {/* Quick actions */}
            <section>
              <p style={sectionLabel}>Quick actions</p>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS_BASE.filter((a) => !a.requiresManage || canManage).map(({ key, label, path, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(path)}
                    className="flex items-center justify-between gap-2 rounded-xl border p-4 text-left transition-colors active:opacity-90"
                    style={{
                      background: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: shell.iconContainerRadius,
                          background: colors.primarySubtle,
                          color: colors.primary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={20} strokeWidth={2} />
                      </span>
                      <span className="font-medium text-sm truncate">{label}</span>
                    </div>
                    <ChevronRight size={18} style={{ color: colors.muted, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </section>

            {/* Workload by coach */}
            <section>
              <p style={sectionLabel}>Workload by coach</p>
              <Card style={{ ...standardCard, overflow: 'hidden', padding: 0 }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.border}`, background: colors.surface1 }}>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Coach
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Assigned
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Prep
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Pending reviews
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          At-risk
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workload.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-sm" style={{ color: colors.muted }}>
                            No coaches in this organisation.
                          </td>
                        </tr>
                      ) : (
                        workload.map((row) => (
                          <tr key={row.profileId} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td className="p-3 font-medium" style={{ color: colors.text }}>
                              {row.coachName}
                            </td>
                            <td className="p-3" style={{ color: colors.text }}>
                              {row.assignedClients}
                            </td>
                            <td className="p-3" style={{ color: colors.text }}>
                              {row.prepClients}
                            </td>
                            <td className="p-3" style={{ color: colors.text }}>
                              {row.pendingReviews}
                            </td>
                            <td className="p-3" style={{ color: row.atRiskClients > 0 ? colors.danger : colors.text }}>
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
