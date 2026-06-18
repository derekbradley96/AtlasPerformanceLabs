/**
 * Multi-athlete prep timeline (Gantt-style): all active contest preps for coach clients.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer } from '@/ui/pageLayout';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { hapticLight } from '@/lib/haptics';

const WEEKS_HALF = 12;
const MS_DAY = 86400000;

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addWeeks(date, w) {
  const x = new Date(date);
  x.setDate(x.getDate() + w * 7);
  return x;
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

function phaseStyle(weeksOut) {
  if (weeksOut == null || Number.isNaN(weeksOut)) return { bg: colors.surface2, label: 'Prep' };
  if (weeksOut < 0) return { bg: '#ca8a0422', label: 'Post show' };
  if (weeksOut === 0) return { bg: '#eab30844', label: 'Show day' };
  if (weeksOut < 4) return { bg: '#ef444455', label: 'Peak zone' };
  if (weeksOut < 8) return { bg: '#f59e0b55', label: 'Final push' };
  if (weeksOut <= 12) return { bg: '#3b82f655', label: 'Mid prep' };
  return { bg: '#64748b55', label: 'Early prep' };
}

async function fetchPrepTimelineRows(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      full_name,
      contest_preps (
        id,
        show_name,
        show_date,
        division,
        federation,
        is_active
      )
    `)
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
  if (error || !Array.isArray(clients)) return [];
  const rows = [];
  for (const c of clients) {
    const preps = Array.isArray(c.contest_preps) ? c.contest_preps : [];
    for (const p of preps) {
      if (!p?.is_active || !p.show_date) continue;
      const name = c.name || c.full_name || 'Athlete';
      rows.push({
        clientId: c.id,
        clientName: name,
        prepId: p.id,
        showName: p.show_name || 'Show',
        showDate: p.show_date,
        division: p.division || '',
        federation: p.federation || '',
      });
    }
  }
  rows.sort((a, b) => new Date(a.showDate).getTime() - new Date(b.showDate).getTime());
  return rows;
}

export default function CoachPrepTimelineBoard({ embedded = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id ?? null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refetch = useCallback(() => {
    if (!coachId) return;
    setLoading(true);
    setError(false);
    fetchPrepTimelineRows(coachId)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [coachId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const weekStart = useMemo(() => startOfWeekMonday(today), [today]);
  const gridStart = useMemo(() => addWeeks(weekStart, -WEEKS_HALF), [weekStart]);
  const totalWeeks = WEEKS_HALF * 2 + 1;
  const weekSlots = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalWeeks; i += 1) {
      out.push(addWeeks(gridStart, i));
    }
    return out;
  }, [gridStart, totalWeeks]);

  const currentWeekIndex = useMemo(() => {
    const idx = weekSlots.findIndex((w) => {
      const end = addWeeks(w, 1);
      return today >= w && today < end;
    });
    return idx >= 0 ? idx : WEEKS_HALF;
  }, [weekSlots, today]);

  const barLayout = useCallback(
    (showDateStr) => {
      const show = new Date(`${showDateStr}T12:00:00`);
      const daysOut = Math.ceil((show.getTime() - today.getTime()) / MS_DAY);
      const weeksOut = Math.max(0, Math.ceil(daysOut / 7));
      const totalDays = totalWeeks * 7;
      const barLenDays = Math.min(112, Math.max(42, daysOut + 7));
      const barStart = new Date(show);
      barStart.setDate(barStart.getDate() - barLenDays);
      const clipStart = barStart < gridStart ? gridStart : barStart;
      const clipEnd = show > addWeeks(gridStart, totalWeeks) ? addWeeks(gridStart, totalWeeks) : show;
      let leftPct = (daysBetween(gridStart, clipStart) / totalDays) * 100;
      let widthPct = (daysBetween(clipStart, clipEnd) / totalDays) * 100;
      leftPct = Math.max(0, Math.min(100, leftPct));
      widthPct = Math.max(100 / totalWeeks, Math.min(100 - leftPct, widthPct));
      const showPctRaw = (daysBetween(gridStart, show) / totalDays) * 100;
      const showMarkerPct = Math.max(0, Math.min(100, showPctRaw));
      return { leftPct, widthPct, weeksOut, daysOut, showMarkerPct };
    },
    [today, gridStart, totalWeeks]
  );

  const inner = (
    <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
      {!embedded && <h1 className="atlas-page-title mb-1">Prep timeline</h1>}
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        All athletes with an active contest prep, aligned to week bands (show date on the right).
      </p>

      {error ? (
        <LoadErrorFallback title="Could not load timeline" onRetry={refetch} />
      ) : loading ? (
        <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
      ) : rows.length === 0 ? (
        <Card style={{ padding: spacing[16] }}>
          <p className="text-sm" style={{ color: colors.muted }}>No active contest preps for your roster.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div
            className="relative rounded-lg border mb-2 overflow-hidden"
            style={{ borderColor: colors.border, background: colors.surface1 }}
          >
            <div className="flex text-[10px] font-medium px-1 py-1" style={{ color: colors.muted }}>
              {weekSlots.map((w, i) => (
                <div
                  key={i}
                  className="flex-1 text-center truncate"
                  style={{
                    borderLeft: i === currentWeekIndex ? `2px solid ${colors.primary}` : undefined,
                    minWidth: 0,
                  }}
                >
                  {i % 2 === 0 ? `${w.getMonth() + 1}/${w.getDate()}` : ''}
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => {
            const { leftPct, widthPct, weeksOut, showMarkerPct } = barLayout(row.showDate);
            const phase = phaseStyle(weeksOut);
            return (
              <button
                key={`${row.clientId}-${row.prepId}`}
                type="button"
                className="w-full text-left rounded-xl border p-3 transition-opacity active:opacity-90"
                style={{
                  borderColor: colors.border,
                  background: colors.surface,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  hapticLight();
                  navigate(`/clients/${row.clientId}`);
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: colors.text }}>{row.clientName}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: colors.muted }}>{row.showName}</p>
                  </div>
                  {row.division && (
                    <span
                      className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                      style={{ background: colors.primarySubtle, color: colors.primary }}
                    >
                      {row.division}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: phase.bg, color: colors.text }}>
                    {phase.label}
                  </span>
                  {weeksOut != null && (
                    <span className="text-xs" style={{ color: colors.muted }}>{weeksOut}w out</span>
                  )}
                </div>
                <div
                  className="relative h-8 rounded-md overflow-hidden"
                  style={{ background: colors.surface2 }}
                >
                  <div
                    className="absolute top-1 bottom-1 rounded"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 100 / totalWeeks)}%`,
                      background: phase.bg,
                      border: `1px solid ${colors.border}`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 z-10 rounded-full"
                    style={{ left: `calc(${showMarkerPct}% - 2px)`, background: '#eab308', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
                    title="Show day"
                  />
                </div>
                <div
                  className="flex justify-between text-[10px] mt-1"
                  style={{ color: colors.muted }}
                >
                  <span>{gridStart.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  <span>{addWeeks(gridStart, totalWeeks).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div style={{ background: colors.bg, color: colors.text }}>{inner}</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Prep timeline" onBack={() => navigate(-1)} />
      {inner}
    </div>
  );
}
