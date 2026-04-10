import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Droplets, Crosshair } from 'lucide-react';
import { hasSupabase } from '@/lib/supabaseClient';
import {
  fetchClientPrepPrecision,
  fetchClientPrepPrecisionDaily,
  fetchPersonalPrepPrecision,
  fetchPersonalPrepPrecisionDaily,
  todayLocalDateString,
} from '@/data/prepPrecisionService';
import {
  formatWaterVolumeMlForViewer,
  formatSodiumMgForViewer,
  resolveViewerWaterUnit,
  resolveViewerSodiumUnit,
} from '@/lib/nutritionUnits';
import Card from '@/ui/Card';
import { colors, shell, spacing } from '@/ui/tokens';

/**
 * Layer 1 adjunct: water always (hint or tracked); sodium only when prep precision is active.
 */
export default function NutritionPrepOverviewStrip({
  profile,
  prepEnabled,
  isClient,
  isPersonal,
  clientId,
  userId,
}) {
  const navigate = useNavigate();
  const today = todayLocalDateString();
  const waterUnit = resolveViewerWaterUnit(profile);
  const sodiumUnit = resolveViewerSodiumUnit(profile);

  const { data: clientPrecision } = useQuery({
    queryKey: ['nutrition-strip-client-prep', clientId],
    enabled: Boolean(prepEnabled && isClient && clientId && hasSupabase),
    queryFn: () => fetchClientPrepPrecision(clientId),
  });
  const { data: clientDaily } = useQuery({
    queryKey: ['nutrition-strip-client-daily', clientId, today],
    enabled: Boolean(prepEnabled && isClient && clientId && hasSupabase),
    queryFn: () => fetchClientPrepPrecisionDaily(clientId, today),
  });

  const { data: personalPrecision } = useQuery({
    queryKey: ['nutrition-strip-personal-prep', userId],
    enabled: Boolean(prepEnabled && isPersonal && userId && hasSupabase),
    queryFn: () => fetchPersonalPrepPrecision(userId),
  });
  const { data: personalDaily } = useQuery({
    queryKey: ['nutrition-strip-personal-daily', userId, today],
    enabled: Boolean(prepEnabled && isPersonal && userId && hasSupabase),
    queryFn: () => fetchPersonalPrepPrecisionDaily(userId, today),
  });

  const precision = isClient ? clientPrecision : personalPrecision;
  const daily = isClient ? clientDaily : personalDaily;
  const waterT = precision?.water_target_ml;
  const waterA = daily?.water_actual_ml;
  const sodiumT = precision?.sodium_target_mg;
  const sodiumA = daily?.sodium_actual_mg;

  if (prepEnabled) {
    return (
      <Card style={{ padding: spacing[14], border: `1px solid ${colors.primary}44`, background: colors.primarySubtle ?? colors.surface1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[10] }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Prep hydration & sodium
            </p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
              <strong>Water:</strong>{' '}
              {formatWaterVolumeMlForViewer(waterA, waterUnit)} logged
              {waterT != null ? ` · target ${formatWaterVolumeMlForViewer(waterT, waterUnit)}` : ''}
            </p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
              <strong>Sodium:</strong>{' '}
              {formatSodiumMgForViewer(sodiumA, sodiumUnit)} logged
              {sodiumT != null ? ` · target ${formatSodiumMgForViewer(sodiumT, sodiumUnit)}` : ''}
            </p>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>
              Full timing, day type, and notes live in Prep precision — kept off your main macro screen on purpose.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/prep-precision')}
            style={{
              flexShrink: 0,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: `${spacing[8]}px ${spacing[10]}px`,
              background: colors.surface1,
              color: colors.primary,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Crosshair size={16} />
            Open
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: spacing[12], border: `1px solid ${shell.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10] }}>
        <span style={{ color: colors.primary, display: 'flex' }}>
          <Droplets size={20} />
        </span>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
          <strong style={{ color: colors.text }}>Hydration:</strong> keep fluids steady through the day. Sodium targets stay in standard nutrition unless
          you&apos;re on a prep-precision plan with your coach.
        </p>
      </div>
    </Card>
  );
}
