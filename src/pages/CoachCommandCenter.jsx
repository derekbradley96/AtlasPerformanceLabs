/**
 * Unified coaching command dashboard: review queue, messages, client alerts,
 * prep alerts, today schedule. Single view for coaches to triage the day.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { listThreads } from '@/lib/messaging/supabaseMessaging';
import {
  ListChecks,
  MessageSquare,
  AlertTriangle,
  CalendarCheck,
  Calendar,
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

async function fetchCommandCenterData() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  const coachId = user.id;

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [queueRes, sessionsRes, threads] = await Promise.all([
    supabase
      .from('v_coach_review_queue')
      .select('item_type, resolved_at')
      .eq('coach_id', coachId),
    supabase
      .from('coach_sessions')
      .select('id, client_id, session_date, duration_minutes, location, status, session_type, clients(name, full_name)')
      .eq('coach_id', coachId)
      .gte('session_date', todayStart.toISOString())
      .lt('session_date', todayEnd.toISOString())
      .order('session_date', { ascending: true }),
    listThreads({ supabase, coachId }).catch(() => []),
  ]);

  const queueRows = queueRes.data ?? [];
  const unresolved = queueRows.filter((r) => !r.resolved_at);

  const reviewQueueCount = unresolved.length;
  const clientAlertsCount = unresolved.filter((r) =>
    ['flag', 'retention_risk', 'billing_overdue', 'momentum_dropping'].includes(r.item_type)
  ).length;
  const prepAlertsCount = unresolved.filter((r) =>
    ['pose_check', 'peak_week_due', 'contest_prep'].includes(r.item_type)
  ).length;

  const todaySessions = (sessionsRes.data ?? []).filter((s) => s.status !== 'cancelled');
  const messageCount = Array.isArray(threads) ? threads.length : 0;

  return {
    reviewQueueCount,
    clientAlertsCount,
    prepAlertsCount,
    todaySessions,
    messageCount,
  };
}

function SectionCard({ icon: Icon, title, count, subtitle, onClick, href, navigate }) {
  const handleClick = () => {
    if (href && navigate) navigate(href);
    else onClick?.();
  };

  return (
    <Card
      style={{
        padding: spacing[16],
        borderLeft: `4px solid ${colors.primary}`,
        cursor: href || onClick ? 'pointer' : 'default',
      }}
      onClick={href || onClick ? handleClick : undefined}
      role={href || onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: colors.primarySubtle,
              color: colors.primary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: colors.text, margin: 0 }}>
              {title}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: colors.muted, margin: 0 }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {count != null && (
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: count > 0 ? colors.primary : colors.muted }}
            >
              {count}
            </span>
          )}
          {(href || onClick) && <ChevronRight size={18} style={{ color: colors.muted }} />}
        </div>
      </div>
    </Card>
  );
}

export default function CoachCommandCenter() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['coach-command-center'],
    queryFn: fetchCommandCenterData,
    enabled: hasSupabase,
  });

  if (!hasSupabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view the command center.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Command center" onBack={() => navigate(-1)} />

      <div className="p-4 space-y-4">
        {isLoading && (
          <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
        )}
        {isError && (
          <p className="text-sm" style={{ color: colors.danger }}>Could not load dashboard.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            <SectionCard
              icon={ListChecks}
              title="Review queue"
              subtitle="Check-ins, pose checks, retention"
              count={data.reviewQueueCount}
              href="/review-center/queue"
              navigate={navigate}
            />

            <SectionCard
              icon={MessageSquare}
              title="Messages"
              subtitle="Client conversations"
              count={data.messageCount}
              href="/messages"
              navigate={navigate}
            />

            <SectionCard
              icon={AlertTriangle}
              title="Client alerts"
              subtitle="Flags, retention risk, billing"
              count={data.clientAlertsCount}
              href="/review-center/queue"
              navigate={navigate}
            />

            <SectionCard
              icon={CalendarCheck}
              title="Prep alerts"
              subtitle="Pose checks, peak week due"
              count={data.prepAlertsCount}
              href="/review-center/queue?filter=pose_check"
              navigate={navigate}
            />

            <Card style={{ padding: spacing[16] }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={20} style={{ color: colors.primary }} />
                  <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                    Today&apos;s schedule
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/calendar')}
                  className="text-xs font-medium"
                  style={{ color: colors.primary }}
                >
                  View calendar
                </button>
              </div>
              {data.todaySessions.length === 0 ? (
                <p className="text-sm" style={{ color: colors.muted }}>
                  No sessions scheduled for today.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.todaySessions.map((s) => {
                    const clientName = s.clients?.full_name || s.clients?.name || 'Client';
                    const time = s.session_date
                      ? new Date(s.session_date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                      : '—';
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: colors.text }}>{clientName}</p>
                          <p className="text-xs" style={{ color: colors.muted }}>
                            {time}
                            {s.duration_minutes != null && ` · ${s.duration_minutes} min`}
                            {s.location && ` · ${s.location}`}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          style={{ color: colors.muted }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/calendar`);
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
