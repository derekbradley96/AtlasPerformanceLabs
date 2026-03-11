/**
 * Client view of scheduled sessions: upcoming and past from coach_sessions (RLS client read-only).
 * Shows date, time, coach, location.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { Calendar, Clock, MapPin, User } from 'lucide-react';

async function fetchClientSessions() {
  if (!hasSupabase()) return { sessions: [], coachNames: {} };
  const supabase = getSupabase();
  if (!supabase) return { sessions: [], coachNames: {} };

  const { data: rows, error } = await supabase
    .from('coach_sessions')
    .select('id, coach_id, session_date, duration_minutes, location, status, session_type')
    .order('session_date', { ascending: true });

  if (error || !rows?.length) {
    return { sessions: rows ?? [], coachNames: {} };
  }

  const coachIds = [...new Set(rows.map((r) => r.coach_id).filter(Boolean))];
  const coachNames = {};
  if (coachIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, name')
      .in('id', coachIds);
    for (const p of profiles ?? []) {
      coachNames[p.id] = p.display_name || p.full_name || p.name || 'Coach';
    }
  }

  return { sessions: rows, coachNames };
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function SessionRow({ session, coachName }) {
  return (
    <Card style={{ padding: spacing[16], marginBottom: spacing[10] }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: colors.text }}>
          <Calendar size={16} style={{ color: colors.muted }} />
          {formatDate(session.session_date)}
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-md"
          style={{
            background:
              session.status === 'completed'
                ? 'rgba(34, 197, 94, 0.15)'
                : session.status === 'cancelled'
                  ? 'rgba(148, 163, 184, 0.2)'
                  : 'rgba(59, 130, 246, 0.15)',
            color:
              session.status === 'completed'
                ? '#4ade80'
                : session.status === 'cancelled'
                  ? colors.muted
                  : colors.accent,
          }}
        >
          {session.status}
        </span>
      </div>
      <div className="space-y-1.5 text-sm" style={{ color: colors.muted }}>
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>{formatTime(session.session_date)}</span>
          {session.duration_minutes != null && (
            <span>· {session.duration_minutes} min</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <User size={14} />
          <span>{coachName || 'Coach'}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={14} />
          <span>{session.location || '—'}</span>
        </div>
      </div>
    </Card>
  );
}

export default function ClientSessionsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['client_sessions'],
    queryFn: fetchClientSessions,
    enabled: hasSupabase(),
  });

  const sessions = data?.sessions ?? [];
  const coachNames = data?.coachNames ?? {};

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = [];
    const pa = [];
    for (const s of sessions) {
      if (!s.session_date) continue;
      const t = new Date(s.session_date).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= now) up.push(s);
      else pa.push(s);
    }
    pa.sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
    return { upcoming: up, past: pa };
  }, [sessions]);

  if (!hasSupabase()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to see your sessions.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="My sessions" onBack={() => navigate(-1)} />

      <div className="p-4">
        {isLoading ? (
          <p style={{ color: colors.muted }}>Loading…</p>
        ) : sessions.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: colors.muted }} />
            <p style={{ color: colors.muted }}>No scheduled sessions yet.</p>
            <p className="text-sm mt-2" style={{ color: colors.muted }}>
              Your coach will add in-person or hybrid sessions here.
            </p>
          </Card>
        ) : (
          <>
            <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
              Upcoming sessions
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm mb-6" style={{ color: colors.muted }}>
                No upcoming sessions.
              </p>
            ) : (
              upcoming.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  coachName={coachNames[s.coach_id]}
                />
              ))
            )}

            <h2 className="text-sm font-semibold mb-3 mt-6" style={{ color: colors.text }}>
              Past sessions
            </h2>
            {past.length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>
                No past sessions.
              </p>
            ) : (
              past.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  coachName={coachNames[s.coach_id]}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
