/**
 * Retention radar: every at-risk client in one ranked list, with why and a
 * one-tap nudge. Reads v_client_retention_risk (bands at_risk / churn_risk,
 * ranked by risk_score) — the same view the daily retention-alerts push and
 * coach digest use, so what the coach sees here matches what Atlas nags them
 * about. The average coaching client lasts ~90 days; this page exists to make
 * the quiet ones visible before they leave.
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getReengagementTemplate, sendReengagementNudge } from '@/lib/reengagementTemplates';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing, shell } from '@/ui/tokens';
import { hapticNavigation } from '@/lib/haptics';
import { toast } from 'sonner';

const REASON_LABELS = {
  no_checkin_ever: 'Never checked in',
  checkin_overdue: 'Check-in overdue',
  billing_overdue: 'Payment overdue',
  no_workouts_last_7d: 'No workouts this week',
  message_silence: 'Gone quiet in chat',
  low_habit_adherence: 'Habits slipping',
  habit_streak_broken: 'Streak broken',
};

const BAND_STYLES = {
  churn_risk: { label: 'Churn risk', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  at_risk: { label: 'At risk', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

function reasonLabel(reason) {
  return REASON_LABELS[reason] || String(reason || '').replaceAll('_', ' ');
}

async function fetchAtRiskClients(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_client_retention_risk')
    .select('client_id, client_name, risk_score, risk_band, reasons')
    .eq('coach_id', coachId)
    .in('risk_band', ['at_risk', 'churn_risk'])
    .order('risk_score', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export default function ClientsAtRisk() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['clients-at-risk', user?.id],
    queryFn: () => fetchAtRiskClients(user?.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const handleNudge = useCallback((row) => {
    hapticNavigation();
    sendReengagementNudge({
      clientId: row.client_id,
      template: getReengagementTemplate(row.reasons || []),
      navigate,
      toast,
    });
  }, [navigate]);

  const handleOpen = useCallback((row) => {
    hapticNavigation();
    navigate(`/clients/${encodeURIComponent(row.client_id)}`);
  }, [navigate]);

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: spacing[8], paddingBottom: shell.scrollContentInsetBottom }}
    >
      <div className="max-w-lg mx-auto w-full space-y-3">
        <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[4] }}>
          Ranked by risk. A nudge opens their chat with a message ready to edit.
        </p>

        {isLoading ? (
          <Card style={{ padding: spacing[20] }}>
            <p className="text-sm" style={{ color: colors.muted }}>Checking your roster…</p>
          </Card>
        ) : isError ? (
          <Card style={{ padding: spacing[20] }}>
            <p className="text-sm" style={{ color: colors.text }}>Could not load retention data.</p>
            <button type="button" className="text-sm underline mt-2" style={{ color: colors.primary }} onClick={() => refetch()}>
              Try again
            </button>
          </Card>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Roster looking healthy"
            description="No clients are flagged at risk right now. Check back after the daily scan."
            icon={AlertTriangle}
          />
        ) : (
          rows.map((row) => {
            const band = BAND_STYLES[row.risk_band] || BAND_STYLES.at_risk;
            const reasons = Array.isArray(row.reasons) ? row.reasons : [];
            return (
              <Card key={row.client_id} style={{ padding: spacing[16] }}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate" style={{ color: colors.text }}>
                      {row.client_name || 'Client'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: band.color, background: band.bg }}
                      >
                        {band.label} · {Math.round(Number(row.risk_score) || 0)}
                      </span>
                      {reasons.map((r) => (
                        <span
                          key={r}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{ color: colors.muted, background: 'rgba(255,255,255,0.06)' }}
                        >
                          {reasonLabel(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: colors.muted, flexShrink: 0 }} aria-hidden />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleNudge(row)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium active:opacity-80"
                    style={{ background: colors.primary, color: '#fff', border: 'none', minHeight: 44 }}
                  >
                    <MessageCircle size={16} />
                    Send nudge
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpen(row)}
                    className="flex-1 rounded-lg py-2 text-sm font-medium active:opacity-80"
                    style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, minHeight: 44 }}
                  >
                    Open client
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
