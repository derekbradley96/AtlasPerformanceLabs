import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getSupabase } from '@/lib/supabaseClient';
import * as sandbox from '@/lib/sandboxStore';
import { safeDate } from '@/lib/format';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { resolveViewerBodyweightUnit, formatWeightForViewer } from '@/lib/bodyMeasurementUnits';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {
    console.error('[ClientCheckInDetail] lightHaptic:', e);
  }
}

function formatShortDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMissingColumnNameFromError(error) {
  const message = String(error?.message || '');
  const m1 = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
  if (m1?.[1]) return m1[1];
  const m2 = message.match(/column\s+["']?([a-zA-Z0-9_.]+)["']?/i);
  if (m2?.[1]) {
    const parts = m2[1].split('.');
    return parts[parts.length - 1] || null;
  }
  return null;
}

export default function ClientCheckInDetail() {
  const { id: clientId, checkinId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const viewerWU = resolveViewerBodyweightUnit(profile);
  const supabase = getSupabase();

  const { data: client = null, isLoading: clientLoading } = useQuery({
    queryKey: ['comp-client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      if (supabase) {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, user_id, coach_id, trainer_id')
          .eq('id', clientId)
          .maybeSingle();
        if (error || !data) return null;
        return { ...data, full_name: data.name ?? data.full_name };
      }
      const c = sandbox.getClientById(clientId);
      return c ? { ...c, full_name: c.full_name ?? c.name } : null;
    },
    enabled: !!clientId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: checkInsListRaw = [], isLoading: checkinsLoading } = useQuery({
    queryKey: ['comp-checkins', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      if (supabase) {
        let selectColumns = [
          'id',
          'submitted_at',
          'created_at',
          'checkin_date',
          'week_start',
          'weight_kg',
          'weight',
          'steps',
          'adherence_pct',
          'nutrition_adherence',
          'notes',
          'photos',
        ];
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const { data, error } = await supabase
            .from('checkins')
            .select(selectColumns.join(', '))
            .eq('client_id', clientId)
            .order('submitted_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(50);
          if (!error) {
            const rows = Array.isArray(data) ? data : [];
            return rows.map((row) => ({
              ...row,
              status: row?.status ?? (row?.reviewed_at || row?.reviewed_by ? 'reviewed' : 'submitted'),
              adherence_pct: row?.adherence_pct ?? row?.nutrition_adherence ?? null,
              created_date:
                row?.created_date ??
                row?.created_at ??
                row?.submitted_at ??
                row?.checkin_date ??
                row?.week_start ??
                null,
            }));
          }
          const missing = getMissingColumnNameFromError(error);
          if (!missing || !selectColumns.includes(missing)) return [];
          selectColumns = selectColumns.filter((c) => c !== missing);
          if (selectColumns.length === 0) return [];
        }
        return [];
      }
      return sandbox.listCheckIns(clientId) ?? [];
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const checkInsList = Array.isArray(checkInsListRaw) ? checkInsListRaw : [];
  const checkIn = checkinId ? checkInsList.find((c) => c?.id === checkinId) : null;

  if (clientLoading || checkinsLoading) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!client || !checkIn) {
    return (
      <div className="min-w-0 max-w-full px-4 py-8" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Check-in not found.</p>
        <button
          type="button"
          onClick={() => navigate(clientId ? `/clients/${clientId}?tab=checkins` : '/clients')}
          className="mt-4 text-sm font-medium"
          style={{ color: colors.accent, minHeight: 44 }}
        >
          Back
        </button>
      </div>
    );
  }

  const needsReview = checkIn.status === 'submitted' && ((checkIn.flags?.length ?? 0) > 0 || (checkIn.adherence_pct != null && checkIn.adherence_pct < 80));

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden px-4" style={{ paddingBottom: spacing[16], background: colors.bg, color: colors.text }}>
      <Card style={{ marginBottom: spacing[16] }}>
        <div className="flex items-center justify-between" style={{ marginBottom: spacing[12] }}>
          <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{formatShortDate(checkIn?.submitted_at ?? checkIn?.created_date ?? '')}</p>
          {needsReview && (
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'rgba(234, 179, 8, 0.2)', color: colors.warning }}>Needs review</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2" style={{ marginBottom: spacing[12] }}>
          {checkIn.adherence_pct != null && (
            <div style={{ padding: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <p className="text-xs" style={{ color: colors.muted }}>Adherence</p>
              <p className="text-[15px] font-medium" style={{ color: colors.text }}>{checkIn.adherence_pct}%</p>
            </div>
          )}
          {checkIn.weight_kg != null && (
            <div style={{ padding: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <p className="text-xs" style={{ color: colors.muted }}>Weight</p>
              <p className="text-[15px] font-medium" style={{ color: colors.text }}>{formatWeightForViewer(Number(checkIn.weight_kg), viewerWU)}</p>
            </div>
          )}
          {checkIn.steps != null && (
            <div style={{ padding: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <p className="text-xs" style={{ color: colors.muted }}>Steps</p>
              <p className="text-[15px] font-medium" style={{ color: colors.text }}>{checkIn.steps.toLocaleString()}</p>
            </div>
          )}
        </div>
        {checkIn.notes && (
          <p className="text-sm" style={{ color: colors.muted }}>{checkIn.notes}</p>
        )}
        {checkIn.flags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {checkIn.flags.map((f) => (
              <span key={f} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' }}>{f.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
      </Card>
      <Button variant="secondary" onClick={async () => { await lightHaptic(); navigate(`/clients/${clientId}?tab=checkins`); }} style={{ width: '100%' }}>
        Back to Check-ins
      </Button>
    </div>
  );
}
