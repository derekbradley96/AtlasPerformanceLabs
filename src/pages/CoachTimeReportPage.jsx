import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isPrepAthleteFromRow } from '@/lib/clientJourney';
import { buildWeeklyTimeReport } from '@/lib/coachTimeAllocation';
import { getWeekStartISO } from '@/lib/checkins';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, sectionGap, standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import { hapticNavigation } from '@/lib/haptics';

function formatDurationMins(totalMins) {
  const m = Math.max(0, Math.round(Number(totalMins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  return `${h}h ${r} min`;
}

function formatMoneyGbp(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `£${v.toFixed(2)}`;
}

export default function CoachTimeReportPage() {
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const coachId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [weekDataById, setWeekDataById] = useState({});

  useEffect(() => {
    if (!isCoach(effectiveRole) || !coachId || !hasSupabase) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const weekStart = getWeekStartISO();
        const weekStartDate = new Date(`${weekStart}T12:00:00`);
        const { data: clients, error: cErr } = await sb
          .from('clients')
          .select('id, name, full_name, client_type, show_date, contest_preps(id, is_active)')
          .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
        if (cErr) throw cErr;
        const list = Array.isArray(clients) ? clients : [];
        const ids = list.map((c) => c.id).filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) {
            setRows([]);
            setWeekDataById({});
          }
          return;
        }
        const [threadsRes, checkinsRes, poseRes] = await Promise.all([
          sb.from('message_threads').select('id, client_id').eq('coach_id', coachId).in('client_id', ids),
          sb.from('checkins').select('id, client_id, reviewed_at').in('client_id', ids).not('reviewed_at', 'is', null).gte('reviewed_at', weekStartDate.toISOString()),
          sb.from('pose_checks').select('id, client_id, reviewed_at').in('client_id', ids).not('reviewed_at', 'is', null).gte('reviewed_at', weekStartDate.toISOString()),
        ]);
        const threadRows = threadsRes.data || [];
        const threadIdToClient = {};
        threadRows.forEach((t) => {
          if (t.id && t.client_id) threadIdToClient[t.id] = t.client_id;
        });
        const threadIds = threadRows.map((t) => t.id).filter(Boolean);
        const byClient = {};
        ids.forEach((id) => {
          byClient[id] = { checkinsReviewed: 0, messagesSent: 0, programmeUpdates: 0, poseChecksReviewed: 0 };
        });
        (checkinsRes.data || []).forEach((r) => {
          if (r.client_id && byClient[r.client_id]) byClient[r.client_id].checkinsReviewed += 1;
        });
        (poseRes.data || []).forEach((r) => {
          if (r.client_id && byClient[r.client_id]) byClient[r.client_id].poseChecksReviewed += 1;
        });
        if (threadIds.length > 0) {
          const { data: msgs } = await sb
            .from('message_messages')
            .select('thread_id')
            .in('thread_id', threadIds)
            .eq('sender_role', 'coach')
            .gte('created_at', weekStartDate.toISOString());
          (msgs || []).forEach((r) => {
            const cid = threadIdToClient[r.thread_id];
            if (cid && byClient[cid]) byClient[cid].messagesSent += 1;
          });
        }
        const { data: subs } = await sb
          .from('client_subscriptions')
          .select('client_id, price')
          .eq('coach_id', coachId)
          .eq('status', 'active')
          .in('client_id', ids);
        const priceBy = {};
        (subs || []).forEach((s) => {
          const p = Number(s.price) || 0;
          if (s.client_id) priceBy[s.client_id] = Math.max(priceBy[s.client_id] || 0, p);
        });
        const enriched = list.map((c) => ({
          ...c,
          name: c.name || c.full_name || 'Client',
          isPrep: isPrepAthleteFromRow(c),
          monthly_price: priceBy[c.id] || 0,
        }));
        if (!cancelled) {
          setRows(enriched);
          setWeekDataById(byClient);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setWeekDataById({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, effectiveRole]);

  const report = useMemo(() => buildWeeklyTimeReport(rows, weekDataById), [rows, weekDataById]);

  const tableRows = useMemo(() => {
    const all = [...report.byType.prep, ...report.byType.lifestyle];
    return all.map((c) => {
      const hrs = (c.estimatedMinutes || 0) / 60;
      const monthly = Number(c.monthly_price) || 0;
      const perHr = hrs > 0.05 ? monthly / hrs : null;
      return {
        id: c.id,
        name: c.name || 'Client',
        type: c.isPrep ? 'Prep' : 'Lifestyle',
        mins: c.estimatedMinutes || 0,
        perHr,
      };
    }).sort((a, b) => b.mins - a.mins);
  }, [report]);

  if (!isCoach(effectiveRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg, color: colors.text }}>
        <p className="m-0">Not authorized.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, ...pageContainer, paddingBottom: spacing[24] }}>
      <div style={{ marginBottom: sectionGap }}>
        <button type="button" onClick={() => { hapticNavigation(); navigate(-1); }} className="text-sm font-semibold" style={{ color: colors.primary, background: 'none', border: 'none', padding: 0 }}>
          ← Back
        </button>
        <h1 className="text-xl font-bold mt-2 m-0">Time report</h1>
        <p className="text-sm m-0 mt-1" style={{ color: colors.muted }}>This week&apos;s estimated coaching time</p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
      ) : (
        <>
          <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
            <p className="text-2xl font-bold m-0" style={{ color: colors.text }}>
              Total: {formatDurationMins(report.totalMins)} across {rows.length} client{rows.length === 1 ? '' : 's'}
            </p>
            <div className="mt-4 space-y-2">
              <div>
                <div className="flex justify-between text-xs font-semibold" style={{ color: colors.muted }}>
                  <span>Prep athletes: {formatDurationMins(report.totalPrep)} — {report.prepSharePct}%</span>
                </div>
                <div className="h-2 rounded-full mt-1 overflow-hidden" style={{ background: colors.surface2 }}>
                  <div className="h-full rounded-full" style={{ width: `${report.prepSharePct}%`, background: colors.warning }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold" style={{ color: colors.muted }}>
                  <span>Lifestyle clients: {formatDurationMins(report.totalLifestyle)} — {100 - report.prepSharePct}%</span>
                </div>
                <div className="h-2 rounded-full mt-1 overflow-hidden" style={{ background: colors.surface2 }}>
                  <div className="h-full rounded-full" style={{ width: `${100 - report.prepSharePct}%`, background: colors.primary }} />
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ ...standardCard, padding: spacing[12] }}>
            <p className="text-xs font-semibold uppercase tracking-wide m-0 mb-2" style={{ color: colors.muted }}>Per client</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" style={{ color: colors.text }}>
                <thead>
                  <tr style={{ color: colors.muted }}>
                    <th className="py-2 pr-2">Client</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Est. time</th>
                    <th className="py-2">Value / hr</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td className="py-2 pr-2 font-medium">{r.name}</td>
                      <td className="py-2 pr-2">{r.type}</td>
                      <td className="py-2 pr-2">{formatDurationMins(r.mins)}</td>
                      <td className="py-2">{r.perHr != null ? `${formatMoneyGbp(r.perHr)}/hr` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] m-0 mt-3" style={{ color: colors.muted }}>
              Estimates use check-ins reviewed, coach messages sent, and pose checks reviewed this week (programme updates when tracked). Value uses active subscription price divided by estimated hours.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
