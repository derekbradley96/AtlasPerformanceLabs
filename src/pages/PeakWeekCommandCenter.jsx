/**
 * Peak Week Command Center – competition/integrated coaches only.
 * Lists clients with active prep and show in ≤14 days (v_peak_week_clients).
 * Quick actions: Review Pose Check, Open Peak Week Plan, Message Client, Adjust Plan.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, radii, shadows } from '@/ui/tokens';
import { Calendar, ImageIcon, MessageSquare, ClipboardList, FileCheck, Pencil } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

function showPeakWeekByFocus(coachFocus) {
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

export default function PeakWeekCommandCenter() {
  const navigate = useNavigate();
  const { user, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPeakWeek = showPeakWeekByFocus(coachFocus);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const coachId = user?.id ?? null;

  useEffect(() => {
    if (!showPeakWeek || !hasSupabase || !coachId) {
      setLoading(false);
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from('v_peak_week_clients')
      .select('*')
      .eq('coach_id', coachId)
      .order('days_out', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setRows(error ? [] : (data ?? []));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [showPeakWeek, coachId]);

  if (!showPeakWeek) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="p-4 max-w-lg mx-auto">
          <h1 className="atlas-page-title">Peak Week Command Center</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
            Only visible when your coach focus is Competition or Integrated.
          </p>
          <Card style={{ padding: spacing[24], textAlign: 'center', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radii.card }}>
            <p className="text-[15px]" style={{ color: colors.muted }}>
              Change your focus in More → Coach type to access the Peak Week Command Center.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/home')}>
              Back to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const cardStyle = {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.card,
    boxShadow: shadows.glow,
    padding: spacing[16],
  };

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="atlas-page-title">Peak Week Command Center</h1>
        <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
          Athletes with show in the next 14 days.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : rows.length === 0 ? (
          <Card style={{ ...cardStyle, padding: spacing[24], textAlign: 'center' }}>
            <Calendar size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
            <p className="text-[15px] font-medium" style={{ color: colors.text }}>No athletes in peak window</p>
            <p className="text-sm mt-1" style={{ color: colors.muted }}>
              Clients with an active contest prep and show date within 14 days will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => {
              const withinSevenDays = r.days_out != null && r.days_out <= 7;
              return (
                <Card
                  key={r.client_id}
                  style={{
                    ...cardStyle,
                    ...(withinSevenDays
                      ? { borderLeft: `4px solid ${colors.primary}`, background: colors.surface1 }
                      : {}),
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate" style={{ color: colors.text }}>{r.client_name || 'Client'}</p>
                      <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                        {r.show_name || 'Show'} {r.division ? ` · ${r.division}` : ''}
                      </p>
                    </div>
                    <span
                      className="shrink-0 px-2 py-1 rounded text-xs font-medium"
                      style={{ background: withinSevenDays ? colors.primarySubtle : colors.surface2, color: colors.text }}
                    >
                      {r.days_out} days out
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                    <div>
                      <span className="text-xs" style={{ color: colors.muted }}>Weight trend</span>
                      <p className="font-medium" style={{ color: colors.text }}>
                        {r.weight_latest != null ? `${Number(r.weight_latest)} kg` : '—'}
                        {r.weight_change_last_checkin != null && r.weight_change_last_checkin !== 0
                          ? ` (${r.weight_change_last_checkin > 0 ? '+' : ''}${Number(r.weight_change_last_checkin).toFixed(1)})`
                          : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: colors.muted }}>Pose check</span>
                      <p className="font-medium" style={{ color: r.pose_check_submitted_this_week ? colors.success : colors.warning }}>
                        {r.pose_check_submitted_this_week ? 'Submitted' : 'Due'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: colors.muted }}>Flags</span>
                      <p className="font-medium" style={{ color: colors.text }}>{r.active_flags_count ?? 0}</p>
                    </div>
                    {r.prep_phase_week != null && (
                      <div>
                        <span className="text-xs" style={{ color: colors.muted }}>Phase week</span>
                        <p className="font-medium" style={{ color: colors.text }}>{r.prep_phase_week}</p>
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>Protocol Ready</span>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: r.protocol_ready ? colors.successSubtle : colors.surface2,
                          color: r.protocol_ready ? colors.success : colors.muted,
                        }}
                      >
                        {r.protocol_ready ? <FileCheck size={12} /> : null}
                        {r.protocol_ready ? 'Yes' : 'No'}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="inline-flex items-center gap-1.5"
                        onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}/peak-week`); }}
                      >
                        <FileCheck size={14} /> Open Protocol
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="inline-flex items-center gap-1.5"
                        onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}/peak-week`); }}
                      >
                        <Pencil size={14} /> Edit Protocol
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="inline-flex items-center gap-1.5"
                        onClick={() => { hapticLight(); navigate(`/messages/${r.client_id}`); }}
                      >
                        <MessageSquare size={14} /> Message Client
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="inline-flex items-center gap-1.5"
                      onClick={() => { hapticLight(); navigate('/review-center/pose-checks'); }}
                    >
                      <ImageIcon size={14} /> Review Pose Check
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="inline-flex items-center gap-1.5"
                      onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}/peak-week`); }}
                    >
                      <Calendar size={14} /> Peak Week Builder
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="inline-flex items-center gap-1.5"
                      onClick={() => { hapticLight(); navigate(`/clients/${r.client_id}`); }}
                    >
                      <ClipboardList size={14} /> Adjust Plan
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
