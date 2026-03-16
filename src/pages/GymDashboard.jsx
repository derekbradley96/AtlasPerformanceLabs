/**
 * Gym-level overview for hybrid coaches: today's sessions, client mix (active/online/hybrid), metrics.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  Monitor,
  Layers,
  Activity,
  ChevronRight,
} from 'lucide-react';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 7);
  return x;
}

function toISODate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function clientNameFromSession(row) {
  const c = row.clients;
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    return c.full_name || c.name || 'Client';
  }
  if (Array.isArray(c) && c[0]) {
    return c[0].full_name || c[0].name || 'Client';
  }
  return 'Client';
}

async function fetchGymDashboardData() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  const coachId = user.id;

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [clientsRes, sessionsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, membership_type, billing_status, full_name, name')
      .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`),
    supabase
      .from('coach_sessions')
      .select('id, client_id, session_date, duration_minutes, location, status, session_type, clients(name, full_name)')
      .eq('coach_id', coachId)
      .gte('session_date', weekStart.toISOString())
      .lt('session_date', weekEnd.toISOString())
      .order('session_date', { ascending: true }),
  ]);

  let sessions = sessionsRes.data ?? [];
  if (sessionsRes.error && sessions.length === 0) {
    const { data: rows } = await supabase
      .from('coach_sessions')
      .select('id, client_id, session_date, duration_minutes, location, status, session_type')
      .eq('coach_id', coachId)
      .gte('session_date', weekStart.toISOString())
      .lt('session_date', weekEnd.toISOString())
      .order('session_date', { ascending: true });
    sessions = rows ?? [];
    const clientIds = [...new Set(sessions.map((r) => r.client_id).filter(Boolean))];
    if (clientIds.length) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, full_name')
        .in('id', clientIds);
      const map = new Map((clients ?? []).map((c) => [c.id, c]));
      sessions = sessions.map((r) => ({ ...r, clients: map.get(r.client_id) ?? null }));
    }
  }

  // Fetch sessions for today might be outside week if week boundary odd - ensure we have today
  const todayISO = toISODate(new Date());
  const sessionsToday = sessions.filter((s) => {
    if (!s.session_date) return false;
    return toISODate(s.session_date) === todayISO;
  });

  // If today falls outside fetched week range (shouldn't), refetch today only
  let todaySessions = sessionsToday;
  if (todaySessions.length === 0) {
    const { data: todayRows } = await supabase
      .from('coach_sessions')
      .select('id, client_id, session_date, duration_minutes, location, status, session_type, clients(name, full_name)')
      .eq('coach_id', coachId)
      .gte('session_date', todayStart.toISOString())
      .lt('session_date', todayEnd.toISOString())
      .order('session_date', { ascending: true });
    if (todayRows?.length) {
      todaySessions = todayRows;
    }
  }

  const clients = clientsRes.data ?? [];
  const isActive = (c) => {
    const b = (c.billing_status || '').toLowerCase();
    if (b === 'cancelled' || b === 'churned') return false;
    return true; // pending, active, overdue, null all count as coached/active for gym overview
  };
  const activeClients = clients.filter(isActive);
  const onlineClients = clients.filter((c) => (c.membership_type || '').toLowerCase() === 'online');
  const hybridClients = clients.filter((c) => (c.membership_type || '').toLowerCase() === 'hybrid');
  const inPersonClients = clients.filter((c) => (c.membership_type || '').toLowerCase() === 'in_person');

  const weeklySessionCount = sessions.filter((s) => s.status !== 'cancelled').length;
  const sessionsTodayCount = todaySessions.filter((s) => s.status !== 'cancelled').length;

  return {
    todaySessions: todaySessions,
    clientsCoached: clients.length,
    activeCount: activeClients.length,
    onlineCount: onlineClients.length,
    hybridCount: hybridClients.length,
    inPersonCount: inPersonClients.length,
    sessionsTodayCount,
    weeklySessionCount,
    weekStart,
    weekEnd,
  };
}

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <Card style={{ padding: spacing[16], flex: 1, minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: colors.muted }}>
        {Icon && <Icon size={16} />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold" style={{ color: colors.text }}>
        {value}
      </p>
      {sub != null && (
        <p className="text-xs mt-1" style={{ color: colors.muted }}>
          {sub}
        </p>
      )}
    </Card>
  );
}

export default function GymDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gym_dashboard'],
    queryFn: fetchGymDashboardData,
    enabled: hasSupabase,
  });

  const todaySessions = data?.todaySessions ?? [];

  if (!hasSupabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view gym overview.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title="Gym overview"
        onBack={() => navigate(-1)}
        rightAction={
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
            Calendar
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </Button>
        }
      />

      <div className="p-4 space-y-6">
        {isLoading && (
          <p style={{ color: colors.muted }}>Loading…</p>
        )}
        {isError && (
          <p style={{ color: colors.muted }}>Could not load gym data.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard
                icon={Calendar}
                label="Sessions today"
                value={data.sessionsTodayCount}
              />
              <MetricCard
                icon={Users}
                label="Clients coached"
                value={data.clientsCoached}
                sub={`${data.activeCount} active`}
              />
              <MetricCard
                icon={Activity}
                label="Weekly sessions"
                value={data.weeklySessionCount}
                sub="This week (excl. cancelled)"
              />
            </div>

            {/* Client mix */}
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                Client mix
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Card style={{ padding: spacing[14] }}>
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
                    <Activity size={16} />
                    Active clients
                  </div>
                  <p className="text-xl font-semibold mt-1" style={{ color: colors.text }}>
                    {data.activeCount}
                  </p>
                </Card>
                <Card style={{ padding: spacing[14] }}>
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
                    <Monitor size={16} />
                    Online
                  </div>
                  <p className="text-xl font-semibold mt-1" style={{ color: colors.text }}>
                    {data.onlineCount}
                  </p>
                </Card>
                <Card style={{ padding: spacing[14] }}>
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
                    <Layers size={16} />
                    Hybrid
                  </div>
                  <p className="text-xl font-semibold mt-1" style={{ color: colors.text }}>
                    {data.hybridCount}
                  </p>
                </Card>
                <Card style={{ padding: spacing[14] }}>
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
                    <MapPin size={16} />
                    In-person
                  </div>
                  <p className="text-xl font-semibold mt-1" style={{ color: colors.text }}>
                    {data.inPersonCount}
                  </p>
                </Card>
              </div>
              <p className="text-xs mt-2" style={{ color: colors.muted }}>
                Membership type from client record; unset counts only in coached total.
              </p>
            </div>

            {/* Today's sessions */}
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                Today&apos;s sessions
              </h2>
              {todaySessions.length === 0 ? (
                <Card style={{ padding: spacing[20], textAlign: 'center' }}>
                  <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: colors.muted }} />
                  <p className="text-sm" style={{ color: colors.muted }}>
                    No sessions scheduled for today.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/calendar')}
                  >
                    Open calendar
                  </Button>
                </Card>
              ) : (
                todaySessions.map((s) => (
                  <Card
                    key={s.id}
                    style={{ padding: spacing[14], marginBottom: spacing[10] }}
                    className="cursor-pointer active:opacity-90"
                    onClick={() =>
                      s.client_id
                        ? navigate(`/clients/${s.client_id}`)
                        : navigate('/calendar')
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium flex items-center gap-2" style={{ color: colors.text }}>
                        <User size={14} style={{ color: colors.muted }} />
                        {clientNameFromSession(s)}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background:
                            s.status === 'completed'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : s.status === 'cancelled'
                                ? 'rgba(148, 163, 184, 0.2)'
                                : 'rgba(59, 130, 246, 0.15)',
                          color:
                            s.status === 'completed'
                              ? '#4ade80'
                              : s.status === 'cancelled'
                                ? colors.muted
                                : colors.accent,
                        }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: colors.muted }}>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatTime(s.session_date)}
                        {s.duration_minutes != null && ` · ${s.duration_minutes} min`}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {s.location || '—'}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
