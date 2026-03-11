/**
 * Nutrition module: tile-based screen for one client.
 * Route: /clients/:id/nutrition
 * Tiles: Current Plan, Diet Type, Refeed Day, Peak Week, Check-in Adjustment, Notes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAuth } from '@/lib/AuthContext';
import { useData, getEffectiveTrainerId } from '@/data/useData';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, shadows } from '@/ui/tokens';
import { toast } from 'sonner';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

export default function ClientNutritionTiles() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const data = useData();
  const trainerId = getEffectiveTrainerId(user?.id);

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);
  const [localPlan, setLocalPlan] = useState({
    diet_type: 'lifestyle',
    refeed_day: false,
    peak_week: false,
    checkin_adjustment: '',
    notes: '',
    phase: '',
    calories: null,
    protein: null,
    carbs: null,
    fats: null,
  });

  const loadPlan = useCallback(async () => {
    if (!clientId || !data.getActiveNutritionPlan) return;
    setLoading(true);
    try {
      const p = await data.getActiveNutritionPlan(clientId);
      setPlan(p ?? null);
      if (p && typeof p === 'object') {
        setLocalPlan({
          diet_type: p.diet_type === 'prep' ? 'prep' : 'lifestyle',
          refeed_day: !!p.refeed_day,
          peak_week: !!p.peak_week,
          checkin_adjustment: p.checkin_adjustment ?? '',
          notes: p.notes ?? '',
          phase: p.phase ?? '',
          calories: p.calories ?? null,
          protein: p.protein ?? null,
          carbs: p.carbs ?? null,
          fats: p.fats ?? null,
        });
      }
    } catch (e) {
      console.error('[ATLAS] ClientNutritionTiles loadPlan', e);
      toast.error('Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, [clientId, data]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const savePlan = useCallback(
    async (patch) => {
      if (!clientId || !trainerId || !data.upsertNutritionPlan) return;
      await lightHaptic();
      setSaving(true);
      try {
        const payload = {
          client_id: clientId,
          trainer_id: trainerId,
          id: plan?.id,
          ...localPlan,
          ...patch,
        };
        const updated = await data.upsertNutritionPlan(payload);
        setPlan(updated ?? plan);
        if (patch) setLocalPlan((prev) => ({ ...prev, ...patch }));
        toast.success('Saved');
      } catch (e) {
        console.error('[ATLAS] ClientNutritionTiles save', e);
        toast.error(e?.message ?? 'Failed to save');
      } finally {
        setSaving(false);
      }
    },
    [clientId, trainerId, plan, localPlan, data]
  );

  const toggleRefeed = () => {
    const next = !localPlan.refeed_day;
    setLocalPlan((p) => ({ ...p, refeed_day: next }));
    savePlan({ refeed_day: next });
  };

  const togglePeakWeek = () => {
    const next = !localPlan.peak_week;
    setLocalPlan((p) => ({ ...p, peak_week: next }));
    savePlan({ peak_week: next });
  };

  if (!clientId) {
    return (
      <div className="app-screen min-w-0 max-w-full px-4 py-8" style={{ background: colors.bgPrimary, color: colors.textPrimary }}>
        <p style={{ color: colors.textMuted }}>No client selected.</p>
        <Button variant="primary" onClick={() => navigate(clientId ? `/clients/${clientId}` : '/clients')} style={{ marginTop: spacing[16] }}>Go back</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-screen min-w-0 max-w-full flex items-center justify-center py-12" style={{ background: colors.bgPrimary }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tileStyle = (active) => ({
    padding: spacing[16],
    border: `1px solid ${active ? colors.borderActive : colors.border}`,
    borderRadius: 18,
    background: colors.surface1,
    boxShadow: active ? shadows.glow : undefined,
  });

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        background: colors.bgPrimary,
        color: colors.textPrimary,
        padding: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: spacing[20] }}>
        <button
          type="button"
          onClick={() => { lightHaptic(); navigate(clientId ? `/clients/${clientId}` : '/clients'); }}
          className="rounded-lg p-2"
          style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>Nutrition</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: spacing[12],
        }}
      >
        {/* 1) Current Plan */}
        <Card style={{ ...tileStyle(!!(localPlan.calories ?? localPlan.phase)), gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.textMuted }}>Current Plan</p>
              <p className="text-[15px] mt-1" style={{ color: colors.textPrimary }}>
                {localPlan.calories != null && <span>{localPlan.calories} cal</span>}
                {localPlan.protein != null && <span> · P: {localPlan.protein}g</span>}
                {localPlan.carbs != null && <span> C: {localPlan.carbs}g</span>}
                {localPlan.fats != null && <span> F: {localPlan.fats}g</span>}
                {!localPlan.calories && !localPlan.protein && !localPlan.phase && <span style={{ color: colors.textMuted }}>No macros set</span>}
              </p>
              {localPlan.phase && <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{localPlan.phase}</p>}
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: colors.surface2, color: colors.textSecondary }}>
              {localPlan.phase || '—'}
            </span>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/trainer/nutrition/${clientId}`)} style={{ marginTop: spacing[12] }}>
            Edit plan
          </Button>
        </Card>

        {/* 2) Diet Type */}
        <Card style={tileStyle(localPlan.diet_type === 'prep')}>
          <p className="text-xs font-medium" style={{ color: colors.textMuted }}>Diet Type</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={async () => { await lightHaptic(); setLocalPlan((p) => ({ ...p, diet_type: 'prep' })); savePlan({ diet_type: 'prep' }); }}
              style={{
                padding: '6px 12px',
                borderRadius: 14,
                border: `1px solid ${localPlan.diet_type === 'prep' ? colors.brand : colors.border}`,
                background: localPlan.diet_type === 'prep' ? `${colors.brand}22` : 'transparent',
                color: colors.textPrimary,
                fontSize: 13,
              }}
            >
              Prep
            </button>
            <button
              type="button"
              onClick={async () => { await lightHaptic(); setLocalPlan((p) => ({ ...p, diet_type: 'lifestyle' })); savePlan({ diet_type: 'lifestyle' }); }}
              style={{
                padding: '6px 12px',
                borderRadius: 14,
                border: `1px solid ${localPlan.diet_type === 'lifestyle' ? colors.brand : colors.border}`,
                background: localPlan.diet_type === 'lifestyle' ? `${colors.brand}22` : 'transparent',
                color: colors.textPrimary,
                fontSize: 13,
              }}
            >
              Lifestyle
            </button>
          </div>
        </Card>

        {/* 3) Refeed Day */}
        <Card style={tileStyle(localPlan.refeed_day)}>
          <p className="text-xs font-medium" style={{ color: colors.textMuted }}>Refeed Day</p>
          <button
            type="button"
            onClick={toggleRefeed}
            style={{
              marginTop: 8,
              padding: '8px 14px',
              borderRadius: 14,
              border: `1px solid ${localPlan.refeed_day ? colors.borderActive : colors.border}`,
              background: localPlan.refeed_day ? `${colors.accentGlow}22` : colors.surface2,
              color: colors.textPrimary,
              fontSize: 14,
            }}
          >
            {localPlan.refeed_day ? 'On' : 'Off'}
          </button>
        </Card>

        {/* 4) Peak Week */}
        <Card style={tileStyle(localPlan.peak_week)}>
          <p className="text-xs font-medium" style={{ color: colors.textMuted }}>Peak Week</p>
          <button
            type="button"
            onClick={togglePeakWeek}
            style={{
              marginTop: 8,
              padding: '8px 14px',
              borderRadius: 14,
              border: `1px solid ${localPlan.peak_week ? colors.borderActive : colors.border}`,
              background: localPlan.peak_week ? `${colors.accentGlow}22` : colors.surface2,
              color: colors.textPrimary,
              fontSize: 14,
            }}
          >
            {localPlan.peak_week ? 'On' : 'Off'}
          </button>
        </Card>

        {/* 5) Check-in Adjustment */}
        <Card style={{ ...tileStyle(!!localPlan.checkin_adjustment), gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="text-xs font-medium" style={{ color: colors.textMuted }}>Check-in Adjustment</p>
            {localPlan.checkin_adjustment ? <span className="text-[11px]" style={{ color: colors.textSecondary }}>Has note</span> : null}
          </div>
          <Button variant="secondary" onClick={() => { lightHaptic(); setCheckinSheetOpen(true); }} style={{ marginTop: 8 }}>
            {localPlan.checkin_adjustment ? 'Edit' : 'Add note'}
          </Button>
          {localPlan.checkin_adjustment && (
            <p className="text-sm mt-2 line-clamp-2" style={{ color: colors.textSecondary }}>{localPlan.checkin_adjustment}</p>
          )}
        </Card>

        {/* 6) Notes */}
        <Card style={{ ...tileStyle(!!localPlan.notes), gridColumn: '1 / -1' }}>
          <p className="text-xs font-medium" style={{ color: colors.textMuted }}>Notes</p>
          <textarea
            placeholder="General notes…"
            value={localPlan.notes}
            onChange={(e) => setLocalPlan((p) => ({ ...p, notes: e.target.value }))}
            onBlur={(e) => savePlan({ notes: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              marginTop: 8,
              padding: spacing[12],
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              background: colors.surface2,
              color: colors.textPrimary,
              fontSize: 14,
            }}
          />
        </Card>
      </div>

      {checkinSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-stretch justify-end"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setCheckinSheetOpen(false)}
          role="presentation"
        >
          <div style={{ background: colors.surface1, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing[16], maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-2" style={{ color: colors.textMuted }}>Check-in Adjustment</p>
            <textarea
              placeholder="Adjustment note for check-ins…"
              value={localPlan.checkin_adjustment}
              onChange={(e) => setLocalPlan((p) => ({ ...p, checkin_adjustment: e.target.value }))}
              rows={4}
              style={{
                width: '100%',
                padding: spacing[12],
                borderRadius: 14,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.textPrimary,
                fontSize: 14,
              }}
            />
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setCheckinSheetOpen(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button variant="primary" onClick={async () => { await savePlan({ checkin_adjustment: localPlan.checkin_adjustment }); setCheckinSheetOpen(false); }} style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
