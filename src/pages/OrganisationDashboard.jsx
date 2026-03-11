/**
 * Organisation dashboard for coaching teams: org-level metrics and coach workload.
 * Requires user to belong to an organisation (profile.organisation_id or organisation_members).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  Users,
  UserCheck,
  BookOpen,
  Trophy,
  DollarSign,
} from 'lucide-react';

const COACH_ROLES = ['owner', 'admin', 'coach'];

async function fetchOrganisationDashboard() {
  if (!hasSupabase()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  // Resolve current user's organisation
  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .maybeSingle();

  let orgId = profile?.organisation_id ?? null;
  if (!orgId) {
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('organisation_id')
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle();
    orgId = membership?.organisation_id ?? null;
  }

  if (!orgId) {
    return { organisation: null, metrics: null, workload: [] };
  }

  const { data: organisation } = await supabase
    .from('organisations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  const [membersRes, clientsRes] = await Promise.all([
    supabase.from('organisation_members').select('profile_id, role').eq('organisation_id', orgId),
    supabase.from('clients').select('id, coach_id, trainer_id, monthly_fee, billing_status').eq('organisation_id', orgId),
  ]);

  const clients = clientsRes.data ?? [];
  const members = membersRes.data ?? [];
  const clientIds = clients.map((c) => c.id).filter(Boolean);
  const coachProfileIds = [...new Set(
    members.filter((m) => COACH_ROLES.includes((m.role || '').toLowerCase())).map((m) => m.profile_id).filter(Boolean)
  )];

  const [programBlocksRes, prepsRes, checkinsRes, profilesRes] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('program_blocks').select('id, client_id').in('client_id', clientIds)
      : Promise.resolve({ data: [] }),
    clientIds.length > 0
      ? supabase.from('contest_preps').select('client_id').eq('is_active', true).in('client_id', clientIds)
      : Promise.resolve({ data: [] }),
    clientIds.length > 0
      ? supabase.from('checkins').select('id, client_id').is('reviewed_at', null).not('submitted_at', 'is', null).in('client_id', clientIds)
      : Promise.resolve({ data: [] }),
    coachProfileIds.length > 0
      ? supabase.from('profiles').select('id, display_name, name').in('id', coachProfileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const programBlocks = programBlocksRes.data ?? [];
  const preps = prepsRes.data ?? [];
  const checkinsPending = checkinsRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const clientByCoach = new Map();
  for (const c of clients) {
    const coachId = c.coach_id ?? c.trainer_id;
    if (!coachId) continue;
    if (!clientByCoach.has(coachId)) clientByCoach.set(coachId, []);
    clientByCoach.get(coachId).push(c);
  }
  const prepClientIds = new Set((preps ?? []).map((p) => p.client_id).filter(Boolean));
  const pendingByClient = new Map();
  for (const ch of checkinsPending) {
    if (!ch.client_id) continue;
    pendingByClient.set(ch.client_id, (pendingByClient.get(ch.client_id) || 0) + 1);
  }

  const totalCoaches = coachProfileIds.length;
  const totalClients = clients.length;
  const activePrograms = programBlocks.length;
  const prepAthletes = [...new Set(clients.filter((c) => prepClientIds.has(c.id)).map((c) => c.id))].length;
  const monthlyRevenue = clients
    .filter((c) => (c.billing_status || '').toLowerCase() === 'active' && c.monthly_fee != null)
    .reduce((sum, c) => sum + Number(c.monthly_fee) || 0, 0);

  const workload = coachProfileIds.map((profileId) => {
    const coachClients = clientByCoach.get(profileId) ?? [];
    const coachClientIds = new Set(coachClients.map((c) => c.id));
    const prepCount = coachClients.filter((c) => prepClientIds.has(c.id)).length;
    let pendingCount = 0;
    for (const [cid, count] of pendingByClient) {
      if (coachClientIds.has(cid)) pendingCount += count;
    }
    const p = profileMap.get(profileId);
    const name = p?.display_name || p?.name || 'Coach';
    return {
      profileId,
      coachName: name,
      clients: coachClients.length,
      prepClients: prepCount,
      checkinsPending: pendingCount,
    };
  });

  return {
    organisation: organisation ?? { id: orgId, name: 'Organisation' },
    metrics: {
      totalCoaches,
      totalClients,
      activePrograms,
      prepAthletes,
      monthlyRevenue,
    },
    workload,
  };
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value));
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <Card style={{ padding: spacing[14], flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
        {Icon && <Icon size={16} />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: colors.text }}>
        {typeof value === 'number' && label.toLowerCase().includes('revenue') ? formatCurrency(value) : value}
      </p>
    </Card>
  );
}

export default function OrganisationDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['organisation_dashboard'],
    queryFn: fetchOrganisationDashboard,
    enabled: hasSupabase(),
  });

  if (!hasSupabase()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view organisation dashboard.</p>
      </div>
    );
  }

  const noOrg = data && !data.organisation;
  const metrics = data?.metrics;
  const workload = data?.workload ?? [];

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title={data?.organisation?.name ? `${data.organisation.name} · Team` : 'Organisation'}
        onBack={() => navigate(-1)}
        rightAction={
          !noOrg && data?.organisation ? (
            <button
              type="button"
              onClick={() => navigate('/organisation/team')}
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ color: colors.accent }}
            >
              Manage team
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-6">
        {isLoading && <p style={{ color: colors.muted }}>Loading…</p>}
        {isError && <p style={{ color: colors.muted }}>Could not load organisation data.</p>}

        {noOrg && !isLoading && !isError && (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: colors.muted }} />
            <p style={{ color: colors.text }}>You’re not in an organisation yet.</p>
            <p className="text-sm mt-2" style={{ color: colors.muted }}>
              Join or create an organisation to see the team dashboard.
            </p>
          </Card>
        )}

        {!noOrg && metrics && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard icon={Users} label="Total coaches" value={metrics.totalCoaches} />
              <MetricCard icon={UserCheck} label="Total clients" value={metrics.totalClients} />
              <MetricCard icon={BookOpen} label="Active programs" value={metrics.activePrograms} />
              <MetricCard icon={Trophy} label="Prep athletes" value={metrics.prepAthletes} />
              <MetricCard icon={DollarSign} label="Monthly revenue" value={metrics.monthlyRevenue} />
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                Coach workload
              </h2>
              <Card style={{ overflow: 'hidden', padding: 0 }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.border}`, background: colors.surface1 }}>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Coach
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Clients
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Prep clients
                        </th>
                        <th className="text-xs font-semibold uppercase tracking-wide p-3" style={{ color: colors.muted }}>
                          Check-ins pending
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workload.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-sm" style={{ color: colors.muted }}>
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
                              {row.clients}
                            </td>
                            <td className="p-3" style={{ color: colors.text }}>
                              {row.prepClients}
                            </td>
                            <td className="p-3" style={{ color: colors.text }}>
                              {row.checkinsPending}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
