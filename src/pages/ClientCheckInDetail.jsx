import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { safeDate } from '@/lib/format';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

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

export default function ClientCheckInDetail() {
  const { id: clientId, checkinId } = useParams();
  const navigate = useNavigate();
  const client = clientId ? getClientById(clientId) : null;
  const checkInsListRaw = clientId ? getClientCheckIns(clientId) : [];
  const checkInsList = Array.isArray(checkInsListRaw) ? checkInsListRaw : [];
  const checkIn = checkinId ? checkInsList.find((c) => c?.id === checkinId) : null;

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
              <p className="text-[15px] font-medium" style={{ color: colors.text }}>{checkIn.weight_kg} kg</p>
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
