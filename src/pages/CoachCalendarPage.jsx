/**
 * Session calendar for coaches: daily / weekly / list views for coach_sessions.
 * Shows client name, time, session type, location. Open client, edit session, mark complete.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ExternalLink,
  Pencil,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import SessionBookingModal from '@/components/SessionBookingModal';

const VIEW_OPTIONS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'list', label: 'List' },
];

function toISODate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDayLabel(d) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

async function fetchSessions() {
  if (!hasSupabase()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('coach_sessions')
    .select('id, client_id, session_type, session_date, duration_minutes, location, status, notes, clients(name, full_name)')
    .eq('coach_id', user.id)
    .order('session_date', { ascending: true });

  if (error) {
    const { data: rows, error: e2 } = await supabase
      .from('coach_sessions')
      .select('id, client_id, session_type, session_date, duration_minutes, location, status, notes')
      .eq('coach_id', user.id)
      .order('session_date', { ascending: true });
    if (e2 || !rows?.length) return rows ?? [];
    const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
    const { data: clients } = await supabase.from('clients').select('id, name, full_name').in('id', clientIds);
    const map = new Map((clients ?? []).map((c) => [c.id, c]));
    return rows.map((r) => ({
      ...r,
      clients: map.get(r.client_id) ?? null,
    }));
  }
  return data ?? [];
}

function SessionCard({ session, onOpenClient, onEdit, onMarkComplete }) {
  const name = clientNameFromSession(session);
  const time = formatTime(session.session_date);
  const type = (session.session_type || 'Session').toString();
  const loc = (session.location || '—').toString();
  const isScheduled = session.status === 'scheduled';

  return (
    <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <User size={16} style={{ color: colors.muted, flexShrink: 0 }} />
          <span className="font-medium truncate" style={{ color: colors.text }}>
            {name}
          </span>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0"
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
      <div className="space-y-1 text-sm" style={{ color: colors.muted }}>
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>{time}</span>
          {session.duration_minutes != null && (
            <span>· {session.duration_minutes} min</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} />
          <span>{type}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={14} />
          <span className="truncate">{loc}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenClient(session.client_id)}
        >
          <ExternalLink size={14} className="mr-1" />
          Open
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(session)}>
          <Pencil size={14} className="mr-1" />
          Edit
        </Button>
        {isScheduled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMarkComplete(session.id)}
            style={{ borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80' }}
          >
            <CheckCircle2 size={14} className="mr-1" />
            Complete
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function CoachCalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState('list');
  const [dayCursor, setDayCursor] = useState(() => new Date());
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [editSession, setEditSession] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['coach_sessions'],
    queryFn: fetchSessions,
    enabled: hasSupabase(),
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (id) => {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase.from('coach_sessions').update({ status: 'completed' }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach_sessions'] });
      toast.success('Marked complete');
    },
    onError: () => toast.error('Could not update'),
  });

  const saveEditMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase.from('coach_sessions').update(payload).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach_sessions'] });
      setEditSession(null);
      toast.success('Session updated');
    },
    onError: () => toast.error('Could not save'),
  });

  const openClient = useCallback(
    (clientId) => {
      impactLight();
      if (clientId) navigate(`/clients/${clientId}`);
    },
    [navigate]
  );

  const openEdit = useCallback((session) => {
    impactLight();
    setEditSession(session);
    const d = session.session_date ? new Date(session.session_date) : new Date();
    setEditForm({
      session_type: session.session_type || '',
      session_date_local: toISODate(d) + 'T' + d.toTimeString().slice(0, 5),
      duration_minutes: session.duration_minutes ?? '',
      location: session.location || '',
      notes: session.notes || '',
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editSession) return;
    const iso = editForm.session_date_local
      ? new Date(editForm.session_date_local).toISOString()
      : editSession.session_date;
    saveEditMutation.mutate({
      id: editSession.id,
      payload: {
        session_type: editForm.session_type || null,
        session_date: iso,
        duration_minutes: editForm.duration_minutes === '' ? null : Number(editForm.duration_minutes),
        location: editForm.location || null,
        notes: editForm.notes || null,
      },
    });
  }, [editSession, editForm, saveEditMutation]);

  const dayKey = toISODate(dayCursor);
  const sessionsForDay = useMemo(() => {
    return sessions.filter((s) => {
      if (!s.session_date) return false;
      return toISODate(new Date(s.session_date)) === dayKey;
    });
  }, [sessions, dayKey]);

  const weekEnd = addDays(weekCursor, 6);
  const sessionsForWeek = useMemo(() => {
    const start = weekCursor.getTime();
    const end = addDays(weekCursor, 7).getTime();
    return sessions.filter((s) => {
      if (!s.session_date) return false;
      const t = new Date(s.session_date).getTime();
      return t >= start && t < end;
    });
  }, [sessions, weekCursor]);

  const sessionsByWeekDay = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekCursor, i);
      const key = toISODate(d);
      days.push({
        date: d,
        label: formatDayLabel(d),
        sessions: sessionsForWeek.filter(
          (s) => toISODate(new Date(s.session_date)) === key
        ),
      });
    }
    return days;
  }, [weekCursor, sessionsForWeek]);

  if (!hasSupabase()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view your calendar.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title="Session calendar"
        onBack={() => navigate(-1)}
        rightAction={
          <button
            type="button"
            onClick={() => { impactLight(); setBookingOpen(true); }}
            className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium active:opacity-90"
            style={{ color: colors.accent, background: 'rgba(59, 130, 246, 0.12)', border: 'none' }}
            aria-label="Book session"
          >
            <Plus className="w-4 h-4" />
            Book
          </button>
        }
      />

      <SessionBookingModal open={bookingOpen} onOpenChange={setBookingOpen} />

      <div className="p-4 space-y-4">
        <SegmentedTabs options={VIEW_OPTIONS} value={view} onChange={setView} />

        {view === 'day' && (
          <>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDayCursor(addDays(dayCursor, -1))}
                aria-label="Previous day"
              >
                <ChevronLeft />
              </Button>
              <span className="font-medium" style={{ color: colors.text }}>
                {formatDayLabel(dayCursor)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDayCursor(addDays(dayCursor, 1))}
                aria-label="Next day"
              >
                <ChevronRight />
              </Button>
            </div>
            <p className="text-sm" style={{ color: colors.muted }}>
              Daily schedule
            </p>
            {sessionsForDay.length === 0 ? (
              <Card style={{ padding: spacing[24], textAlign: 'center' }}>
                <p style={{ color: colors.muted }}>No sessions this day.</p>
              </Card>
            ) : (
              sessionsForDay.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onOpenClient={openClient}
                  onEdit={openEdit}
                  onMarkComplete={(id) => markCompleteMutation.mutate(id)}
                />
              ))
            )}
          </>
        )}

        {view === 'week' && (
          <>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setWeekCursor(addDays(weekCursor, -7))}
                aria-label="Previous week"
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm font-medium" style={{ color: colors.text }}>
                {formatDayLabel(weekCursor)} – {formatDayLabel(weekEnd)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setWeekCursor(addDays(weekCursor, 7))}
                aria-label="Next week"
              >
                <ChevronRight />
              </Button>
            </div>
            <p className="text-sm" style={{ color: colors.muted }}>
              Weekly schedule
            </p>
            {sessionsByWeekDay.map(({ date, label, sessions: daySessions }) => (
              <div key={toISODate(date)} className="mb-4">
                <p className="text-xs font-semibold mb-2" style={{ color: colors.muted }}>
                  {label}
                </p>
                {daySessions.length === 0 ? (
                  <p className="text-sm pl-2" style={{ color: colors.muted }}>
                    —
                  </p>
                ) : (
                  daySessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onOpenClient={openClient}
                      onEdit={openEdit}
                      onMarkComplete={(id) => markCompleteMutation.mutate(id)}
                    />
                  ))
                )}
              </div>
            ))}
          </>
        )}

        {view === 'list' && (
          <>
            <p className="text-sm" style={{ color: colors.muted }}>
              All sessions (soonest first)
            </p>
            {isLoading ? (
              <p style={{ color: colors.muted }}>Loading…</p>
            ) : sessions.length === 0 ? (
              <Card style={{ padding: spacing[24], textAlign: 'center' }}>
                <p style={{ color: colors.muted }}>No sessions yet.</p>
                <p className="text-sm mt-2" style={{ color: colors.muted }}>
                  Add sessions from your database or a future “New session” flow.
                </p>
              </Card>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onOpenClient={openClient}
                  onEdit={openEdit}
                  onMarkComplete={(id) => markCompleteMutation.mutate(id)}
                />
              ))
            )}
          </>
        )}
      </div>

      <Sheet open={!!editSession} onOpenChange={(open) => !open && setEditSession(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit session</SheetTitle>
          </SheetHeader>
          {editSession && (
            <div className="space-y-4 mt-4 px-1">
              <label className="block text-sm font-medium" style={{ color: colors.muted }}>
                Session type
                <input
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                  style={{ background: colors.surface1, borderColor: colors.border, color: colors.text }}
                  value={editForm.session_type}
                  onChange={(e) => setEditForm((f) => ({ ...f, session_type: e.target.value }))}
                  placeholder="e.g. In-person, Hybrid"
                />
              </label>
              <label className="block text-sm font-medium" style={{ color: colors.muted }}>
                Date & time
                <input
                  type="datetime-local"
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                  style={{ background: colors.surface1, borderColor: colors.border, color: colors.text }}
                  value={editForm.session_date_local}
                  onChange={(e) => setEditForm((f) => ({ ...f, session_date_local: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium" style={{ color: colors.muted }}>
                Duration (minutes)
                <input
                  type="number"
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                  style={{ background: colors.surface1, borderColor: colors.border, color: colors.text }}
                  value={editForm.duration_minutes}
                  onChange={(e) => setEditForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium" style={{ color: colors.muted }}>
                Location
                <input
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                  style={{ background: colors.surface1, borderColor: colors.border, color: colors.text }}
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium" style={{ color: colors.muted }}>
                Notes
                <textarea
                  className="w-full mt-1 rounded-lg border px-3 py-2 min-h-[80px]"
                  style={{ background: colors.surface1, borderColor: colors.border, color: colors.text }}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              <div className="flex gap-2 pt-2">
                <Button type="button" className="flex-1" onClick={saveEdit} disabled={saveEditMutation.isPending}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditSession(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
