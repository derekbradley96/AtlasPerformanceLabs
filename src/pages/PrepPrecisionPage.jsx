import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Droplets, FlaskConical, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { isCoach as isCoachFn, isClient as isClientFn, isPersonal as isPersonalFn } from '@/lib/roles';
import { usePresentationMode } from '@/lib/presentationMode';
import { resolvePersonalPlanTier } from '@/config/plans';
import { resolvePrepPrecisionAccess, resolvePrepPrecisionTierForCoachView } from '@/lib/prepPrecisionAccess';
import { derivePrepCoachSignalFlags } from '@/lib/prepCoachSignals';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  fetchClientPrepPrecision,
  upsertClientPrepPrecision,
  fetchClientPrepPrecisionDaily,
  upsertClientPrepPrecisionDaily,
  fetchClientPrepPrecisionDailyRange,
  listPrepPeakOverrides,
  insertPrepPeakOverride,
  revokePrepPeakOverride,
  fetchPersonalPrepPrecision,
  upsertPersonalPrepPrecision,
  fetchPersonalPrepPrecisionDaily,
  upsertPersonalPrepPrecisionDaily,
  fetchPersonalPrepPrecisionDailyRange,
  pickActiveOverrideForDate,
  effectivePrepPrecisionForDay,
  summarizeVarianceToTarget,
  todayLocalDateString,
  daysAgoDateString,
} from '@/data/prepPrecisionService';
import {
  formatWaterVolumeMlForViewer,
  formatSodiumMgForViewer,
  resolveViewerWaterUnit,
  resolveViewerSodiumUnit,
} from '@/lib/nutritionUnits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Card from '@/ui/Card';
import { PageLoader } from '@/components/ui/LoadingState';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { colors, shell, spacing } from '@/ui/tokens';

const DAY_TYPES = [
  { id: 'training', label: 'Training day' },
  { id: 'rest', label: 'Rest day' },
  { id: 'high', label: 'High day' },
  { id: 'low', label: 'Low day' },
  { id: 'refeed', label: 'Refeed day' },
];

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isSafePrepDashboardReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') return false;
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return false;
  return returnTo === '/prep-dashboard' || returnTo.startsWith('/prep-dashboard?');
}

export default function PrepPrecisionPage() {
  const navigate = useNavigate();
  const [prepSearchParams] = useSearchParams();
  const { id: routeClientId } = useParams();
  const queryClient = useQueryClient();
  const { isWideWeb } = usePresentationMode();
  const {
    effectiveRole,
    resolvedAccess,
    coachFocus,
    clientLinkedRow,
    clientLinkedResolved,
    user,
    profile,
  } = useAuth();

  const isCoach = isCoachFn(effectiveRole);
  const isClient = isClientFn(effectiveRole);
  const isPersonal = isPersonalFn(effectiveRole);

  const coachContextClientId = isCoach ? routeClientId : null;
  const clientSelfId = isClient ? clientLinkedRow?.id : null;
  const activeClientId = coachContextClientId || clientSelfId || null;

  const { data: coachClientMeta, isLoading: coachClientLoading } = useQuery({
    queryKey: ['prep-precision-client-meta', coachContextClientId],
    enabled: Boolean(hasSupabase && isCoach && coachContextClientId),
    queryFn: async () => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('clients')
        .select('id, client_type, delivery_context, coach_id, trainer_id')
        .eq('id', coachContextClientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const personalPlanTier = isPersonal ? resolvePersonalPlanTier(profile, user) : null;

  const { data: personalGoal, isLoading: personalGoalLoading } = useQuery({
    queryKey: ['personal-primary-goal', user?.id],
    enabled: Boolean(hasSupabase && isPersonal && user?.id),
    queryFn: async () => {
      const sb = getSupabase();
      const { data, error } = await sb.from('personal').select('primary_goal').eq('user_id', user.id).maybeSingle();
      if (error && !/primary_goal|schema cache|PGRST204/i.test(String(error.message || ''))) throw new Error(error.message);
      return data?.primary_goal ?? null;
    },
  });

  const access = useMemo(() => {
    if (isCoach) {
      const tier = resolvePrepPrecisionTierForCoachView({
        coachFocus,
        clientRow: coachClientMeta,
      });
      return {
        tier,
        reason: tier === 'full' ? 'coach_prep_context' : 'hidden_coach',
      };
    }
    return resolvePrepPrecisionAccess({
      role: effectiveRole,
      resolvedAccess,
      coachFocus,
      clientRowForCoach: null,
      personalPrimaryGoal: personalGoal,
      personalPlanTier,
      clientLinkedResolved,
    });
  }, [
    isCoach,
    coachFocus,
    coachClientMeta,
    effectiveRole,
    resolvedAccess,
    personalGoal,
    personalPlanTier,
    clientLinkedResolved,
  ]);

  const tier = access.tier;
  const isFull = tier === 'full';
  const isLight = tier === 'light';

  const today = todayLocalDateString();
  const from7 = daysAgoDateString(6);

  const waterUnit = resolveViewerWaterUnit(profile);
  const sodiumUnit = resolveViewerSodiumUnit(profile);

  const canLoadClientFlow = Boolean(
    hasSupabase &&
      (isCoach
        ? !!(coachContextClientId && coachClientMeta)
        : isClient
          ? !!(activeClientId && clientLinkedResolved)
          : false)
  );

  const { data: clientPrecision, isLoading: loadingClientPrecision } = useQuery({
    queryKey: ['client-prep-precision', activeClientId],
    enabled: Boolean((isCoach || isClient) && canLoadClientFlow && activeClientId),
    queryFn: () => fetchClientPrepPrecision(activeClientId),
  });

  const { data: overrides = [], isLoading: loadingOverrides } = useQuery({
    queryKey: ['prep-peak-overrides', activeClientId],
    enabled: Boolean((isCoach || isClient) && canLoadClientFlow && activeClientId && isFull),
    queryFn: () => listPrepPeakOverrides(activeClientId, { includeRevoked: false }),
  });

  const activeOverride = useMemo(
    () => pickActiveOverrideForDate(overrides, today),
    [overrides, today]
  );

  const effectiveRow = useMemo(
    () => effectivePrepPrecisionForDay(clientPrecision, activeOverride),
    [clientPrecision, activeOverride]
  );

  const { data: clientDaily, isLoading: loadingClientDaily } = useQuery({
    queryKey: ['client-prep-precision-daily', activeClientId, today],
    enabled: Boolean((isCoach || isClient) && canLoadClientFlow && activeClientId),
    queryFn: () => fetchClientPrepPrecisionDaily(activeClientId, today),
  });

  const { data: clientWeek = [] } = useQuery({
    queryKey: ['client-prep-precision-week', activeClientId, from7, today],
    enabled: Boolean((isCoach || isClient) && canLoadClientFlow && activeClientId),
    queryFn: () => fetchClientPrepPrecisionDailyRange(activeClientId, from7, today),
  });

  const { data: personalPrecision, isLoading: loadingPersonalPrecision } = useQuery({
    queryKey: ['personal-prep-precision', user?.id],
    enabled: Boolean(hasSupabase && isPersonal && isLight && user?.id),
    queryFn: () => fetchPersonalPrepPrecision(user.id),
  });

  const { data: personalDaily } = useQuery({
    queryKey: ['personal-prep-precision-daily', user?.id, today],
    enabled: Boolean(hasSupabase && isPersonal && isLight && user?.id),
    queryFn: () => fetchPersonalPrepPrecisionDaily(user.id, today),
  });

  const { data: personalWeek = [] } = useQuery({
    queryKey: ['personal-prep-precision-week', user?.id, from7, today],
    enabled: Boolean(hasSupabase && isPersonal && isLight && user?.id),
    queryFn: () => fetchPersonalPrepPrecisionDailyRange(user.id, from7, today),
  });

  const [draft, setDraft] = useState({});
  useEffect(() => {
    if (isPersonal && personalPrecision) {
      setDraft(personalPrecision);
    } else if ((isCoach || isClient) && clientPrecision) {
      setDraft(clientPrecision);
    }
  }, [isPersonal, isCoach, isClient, personalPrecision, clientPrecision]);

  const saveClientPrecisionMutation = useMutation({
    mutationFn: (payload) => upsertClientPrepPrecision(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-prep-precision', activeClientId] });
      toast.success('Prep precision saved');
    },
    onError: (e) => toast.error(e?.message || 'Save failed'),
  });

  const savePersonalPrecisionMutation = useMutation({
    mutationFn: (payload) => upsertPersonalPrepPrecision(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-prep-precision', user?.id] });
      toast.success('Saved');
    },
    onError: (e) => toast.error(e?.message || 'Save failed'),
  });

  const saveClientDailyMutation = useMutation({
    mutationFn: (payload) => upsertClientPrepPrecisionDaily(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-prep-precision-daily', activeClientId] });
      queryClient.invalidateQueries({ queryKey: ['client-prep-precision-week', activeClientId] });
      toast.success('Today updated');
    },
    onError: (e) => toast.error(e?.message || 'Save failed'),
  });

  const savePersonalDailyMutation = useMutation({
    mutationFn: (payload) => upsertPersonalPrepPrecisionDaily(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-prep-precision-daily', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['personal-prep-precision-week', user?.id] });
      toast.success('Today updated');
    },
    onError: (e) => toast.error(e?.message || 'Save failed'),
  });

  const addOverrideMutation = useMutation({
    mutationFn: (payload) => insertPrepPeakOverride(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-peak-overrides', activeClientId] });
      toast.success('Override added (date-bound)');
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const revokeOverrideMutation = useMutation({
    mutationFn: (id) => revokePrepPeakOverride(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-peak-overrides', activeClientId] });
      toast.success('Override revoked');
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const [waterInput, setWaterInput] = useState('');
  const [sodiumInput, setSodiumInput] = useState('');
  useEffect(() => {
    const d = isPersonal ? personalDaily : clientDaily;
    setWaterInput(d?.water_actual_ml != null ? String(d.water_actual_ml) : '');
    setSodiumInput(d?.sodium_actual_mg != null ? String(d.sodium_actual_mg) : '');
  }, [isPersonal, personalDaily, clientDaily]);

  const [ovFrom, setOvFrom] = useState(today);
  const [ovTo, setOvTo] = useState(today);
  const [ovLabel, setOvLabel] = useState('Peak week override');
  const [ovWater, setOvWater] = useState('');
  const [ovSodium, setOvSodium] = useState('');

  const waterSummary = useMemo(() => {
    const tgt = Number(effectiveRow?.water_target_ml ?? draft?.water_target_ml);
    return summarizeVarianceToTarget(clientWeek.length ? clientWeek : personalWeek, 'water_actual_ml', tgt);
  }, [effectiveRow, draft, clientWeek, personalWeek]);

  const sodiumSummary = useMemo(() => {
    const tgt = Number(effectiveRow?.sodium_target_mg ?? draft?.sodium_target_mg);
    return summarizeVarianceToTarget(clientWeek.length ? clientWeek : personalWeek, 'sodium_actual_mg', tgt);
  }, [effectiveRow, draft, clientWeek, personalWeek]);

  const precisionBase = isPersonal ? personalPrecision : clientPrecision;
  const structure = useMemo(
    () => ({ ...(precisionBase || {}), ...draft }),
    [precisionBase, draft]
  );

  const returnTo = prepSearchParams.get('returnTo');
  const safeDashboardReturn = useMemo(
    () => (isSafePrepDashboardReturnTo(returnTo) ? returnTo : null),
    [returnTo]
  );

  const goBack = useCallback(() => {
    if (safeDashboardReturn) {
      navigate(safeDashboardReturn);
      return;
    }
    if (isCoach && coachContextClientId) navigate(`/clients/${coachContextClientId}/nutrition`);
    else navigate('/nutrition');
  }, [isCoach, coachContextClientId, navigate, safeDashboardReturn]);

  if (isCoach && !coachContextClientId) {
    return <Navigate to="/clients" replace />;
  }

  if (isCoach && coachClientLoading) {
    return (
      <div style={{ minHeight: '50vh', padding: spacing[20] }}>
        <PageLoader message="Loading client…" />
      </div>
    );
  }

  if (isCoach && !coachClientMeta) {
    return <Navigate to="/clients" replace />;
  }

  if (isClient && clientLinkedResolved && !clientSelfId) {
    return <Navigate to="/nutrition" replace />;
  }

  if (isPersonal && personalGoalLoading) {
    return (
      <div style={{ minHeight: '50vh', padding: spacing[20] }}>
        <PageLoader message="Loading…" />
      </div>
    );
  }

  if (tier === 'hidden') {
    return <Navigate to="/nutrition" replace />;
  }

  const loadingMain =
    (isCoach || isClient) && canLoadClientFlow && (loadingClientPrecision || loadingClientDaily || loadingOverrides);
  if ((isCoach || isClient) && clientLinkedResolved === false) {
    return (
      <div style={{ minHeight: '50vh', padding: spacing[20] }}>
        <PageLoader message="Syncing profile…" />
      </div>
    );
  }

  if ((isCoach || isClient) && loadingMain) {
    return (
      <div style={{ minHeight: '50vh', padding: spacing[20] }}>
        <PageLoader message="Loading prep precision…" />
      </div>
    );
  }

  if (isPersonal && loadingPersonalPrecision) {
    return (
      <div style={{ minHeight: '50vh', padding: spacing[20] }}>
        <PageLoader message="Loading prep precision…" />
      </div>
    );
  }

  const coachCanEditStructure = isCoach && isFull;
  const clientCanLog = isClient && isFull;
  const personalCanEditSelf = isPersonal && isLight;

  const displayWaterTarget = effectiveRow?.water_target_ml ?? structure?.water_target_ml;
  const displaySodiumTarget = effectiveRow?.sodium_target_mg ?? structure?.sodium_target_mg;

  const coachPrepFlags =
    coachCanEditStructure && Array.isArray(clientWeek) && clientWeek.length
      ? derivePrepCoachSignalFlags({
          dailies: clientWeek,
          waterTargetMl: displayWaterTarget,
          sodiumTargetMg: displaySodiumTarget,
        })
      : [];

  const patchDraft = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }));

  const saveStructure = () => {
    if (isPersonal && personalCanEditSelf) {
      savePersonalPrecisionMutation.mutate({
        user_id: user.id,
        precision_mode_enabled: structure.precision_mode_enabled !== false,
        prep_phase: structure.prep_phase || null,
        sodium_target_mg: numOrNull(structure.sodium_target_mg),
        water_target_ml: numOrNull(structure.water_target_ml),
        meals_per_day: numOrNull(structure.meals_per_day),
        pre_workout_window_minutes: numOrNull(structure.pre_workout_window_minutes),
        post_workout_window_minutes: numOrNull(structure.post_workout_window_minutes),
        meal_spacing_minutes: numOrNull(structure.meal_spacing_minutes),
        day_type: structure.day_type || null,
        is_refeed_day: !!structure.is_refeed_day,
        prep_notes: structure.prep_notes || null,
      });
      return;
    }
    if (coachCanEditStructure && activeClientId) {
      saveClientPrecisionMutation.mutate({
        client_id: activeClientId,
        precision_mode_enabled: !!structure.precision_mode_enabled,
        prep_phase: structure.prep_phase || null,
        sodium_target_mg: numOrNull(structure.sodium_target_mg),
        water_target_ml: numOrNull(structure.water_target_ml),
        meals_per_day: numOrNull(structure.meals_per_day),
        pre_workout_window_minutes: numOrNull(structure.pre_workout_window_minutes),
        post_workout_window_minutes: numOrNull(structure.post_workout_window_minutes),
        meal_spacing_minutes: numOrNull(structure.meal_spacing_minutes),
        day_type: structure.day_type || null,
        is_refeed_day: !!structure.is_refeed_day,
        coach_precision_notes: structure.coach_precision_notes || null,
        is_peak_week_override_active: !!structure.is_peak_week_override_active,
      });
    }
  };

  const saveTodayActuals = () => {
    if (isPersonal && user?.id) {
      savePersonalDailyMutation.mutate({
        userId: user.id,
        dayDate: today,
        water_actual_ml: numOrNull(waterInput),
        sodium_actual_mg: numOrNull(sodiumInput),
      });
      return;
    }
    if ((clientCanLog || coachCanEditStructure) && activeClientId) {
      saveClientDailyMutation.mutate({
        clientId: activeClientId,
        dayDate: today,
        water_actual_ml: numOrNull(waterInput),
        sodium_actual_mg: numOrNull(sodiumInput),
      });
    }
  };

  const submitOverride = () => {
    if (!activeClientId || !coachCanEditStructure) return;
    const overrides = {};
    const w = numOrNull(ovWater);
    const s = numOrNull(ovSodium);
    if (w != null) overrides.water_target_ml = w;
    if (s != null) overrides.sodium_target_mg = s;
    addOverrideMutation.mutate({
      clientId: activeClientId,
      valid_from: ovFrom,
      valid_to: ovTo,
      label: ovLabel || 'Peak week override',
      overrides,
    });
  };

  const gridStyle = isWideWeb
    ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[16] }
    : { display: 'flex', flexDirection: 'column', gap: spacing[16] };

  const pageBody = (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        paddingLeft: shell.pagePaddingH,
        paddingRight: shell.pagePaddingH,
        paddingTop: spacing[16],
        paddingBottom: 'calc(' + spacing[24] + 'px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10], marginBottom: spacing[16] }}>
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
            borderRadius: 12,
            padding: 8,
            color: colors.text,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Prep precision</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted, lineHeight: 1.4 }}>
            Separate from standard nutrition targets — precision, timing, day type, and stable hydration/sodium.
          </p>
        </div>
      </div>

      {activeOverride ? (
        <Card
          style={{
            padding: spacing[14],
            marginBottom: spacing[16],
            border: `1px solid ${colors.primary}55`,
            background: colors.primarySubtle ?? colors.surface1,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.primary }}>
            Active peak-week override
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.text }}>
            {activeOverride.label} · {activeOverride.valid_from} → {activeOverride.valid_to}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.muted }}>
            Effective values below merge coach baseline with this date-bound patch. Revoking restores baseline defaults.
          </p>
        </Card>
      ) : null}

      {isLight ? (
        <Card style={{ padding: spacing[12], marginBottom: spacing[16], border: `1px solid ${colors.border}` }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
            Personal prep mode is intentionally light: track structure and consistency here. Full peak-week orchestration and
            coach-led contest corrections stay with a prep coach.
          </p>
        </Card>
      ) : null}

      <div style={gridStyle}>
        <Card style={{ padding: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing[10] }}>
            <Droplets size={18} style={{ color: colors.primary }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Hydration precision</h2>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: colors.muted }}>
            Target: {formatWaterVolumeMlForViewer(displayWaterTarget, waterUnit)} · Today logged:{' '}
            {formatWaterVolumeMlForViewer(numOrNull(waterInput), waterUnit)}
          </p>
          {(coachCanEditStructure || personalCanEditSelf) && (
            <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginBottom: 4 }}>Water target (ml)</label>
          )}
          {(coachCanEditStructure || personalCanEditSelf) && (
            <Input
              type="number"
              value={structure.water_target_ml ?? ''}
              onChange={(e) => patchDraft('water_target_ml', e.target.value === '' ? '' : Number(e.target.value))}
              className="mb-3"
            />
          )}
          {(clientCanLog || coachCanEditStructure || personalCanEditSelf) && (
            <>
              <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginBottom: 4 }}>
                Today actual (ml, stored as ml)
              </label>
              <Input type="number" value={waterInput} onChange={(e) => setWaterInput(e.target.value)} />
            </>
          )}
        </Card>

        <Card style={{ padding: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing[10] }}>
            <FlaskConical size={18} style={{ color: colors.primary }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Sodium precision</h2>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: colors.muted }}>
            Target: {formatSodiumMgForViewer(displaySodiumTarget, sodiumUnit)} · Today logged:{' '}
            {formatSodiumMgForViewer(numOrNull(sodiumInput), sodiumUnit)}
          </p>
          {(coachCanEditStructure || personalCanEditSelf) && (
            <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginBottom: 4 }}>Sodium target (mg)</label>
          )}
          {(coachCanEditStructure || personalCanEditSelf) && (
            <Input
              type="number"
              value={structure.sodium_target_mg ?? ''}
              onChange={(e) => patchDraft('sodium_target_mg', e.target.value === '' ? '' : Number(e.target.value))}
              className="mb-3"
            />
          )}
          {(clientCanLog || coachCanEditStructure || personalCanEditSelf) && (
            <>
              <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginBottom: 4 }}>
                Today actual (mg, stored as mg)
              </label>
              <Input type="number" value={sodiumInput} onChange={(e) => setSodiumInput(e.target.value)} />
            </>
          )}
        </Card>
      </div>

      <Card style={{ padding: spacing[16], marginTop: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing[10] }}>
          <CalendarClock size={18} style={{ color: colors.primary }} />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Meal timing & day type</h2>
        </div>
        <div style={{ ...gridStyle, marginTop: spacing[10] }}>
          {isClient && isFull && !coachCanEditStructure && !personalCanEditSelf ? (
            <div style={{ gridColumn: isWideWeb ? '1 / -1' : undefined, fontSize: 14, color: colors.text, lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Meals per day:</strong> {structure.meals_per_day ?? '—'}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Pre-workout window:</strong>{' '}
                {structure.pre_workout_window_minutes != null ? `${structure.pre_workout_window_minutes} min` : '—'}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Post-workout window:</strong>{' '}
                {structure.post_workout_window_minutes != null ? `${structure.post_workout_window_minutes} min` : '—'}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Meal spacing:</strong>{' '}
                {structure.meal_spacing_minutes != null ? `${structure.meal_spacing_minutes} min` : '—'}
              </p>
            </div>
          ) : null}
          {(coachCanEditStructure || personalCanEditSelf) && (
            <>
              <div>
                <label style={{ fontSize: 12, color: colors.muted }}>Meals per day</label>
                <Input
                  type="number"
                  value={structure.meals_per_day ?? ''}
                  onChange={(e) => patchDraft('meals_per_day', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: colors.muted }}>Pre-workout window (min)</label>
                <Input
                  type="number"
                  value={structure.pre_workout_window_minutes ?? ''}
                  onChange={(e) =>
                    patchDraft('pre_workout_window_minutes', e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: colors.muted }}>Post-workout window (min)</label>
                <Input
                  type="number"
                  value={structure.post_workout_window_minutes ?? ''}
                  onChange={(e) =>
                    patchDraft('post_workout_window_minutes', e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: colors.muted }}>Meal spacing (min)</label>
                <Input
                  type="number"
                  value={structure.meal_spacing_minutes ?? ''}
                  onChange={(e) => patchDraft('meal_spacing_minutes', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </>
          )}
          <div style={{ gridColumn: isWideWeb ? '1 / -1' : undefined }}>
            <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginBottom: 6 }}>Day type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DAY_TYPES.map((dt) => {
                const active = (structure.day_type || '') === dt.id;
                return (
                  <button
                    key={dt.id}
                    type="button"
                    disabled={!coachCanEditStructure && !personalCanEditSelf}
                    onClick={() => patchDraft('day_type', dt.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: `1px solid ${active ? colors.primary : colors.border}`,
                      background: active ? `${colors.primary}18` : colors.surface1,
                      color: colors.text,
                      fontSize: 13,
                      cursor: coachCanEditStructure || personalCanEditSelf ? 'pointer' : 'default',
                      opacity: coachCanEditStructure || personalCanEditSelf ? 1 : 0.7,
                    }}
                  >
                    {dt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {(coachCanEditStructure || personalCanEditSelf) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!structure.is_refeed_day}
                onChange={(e) => patchDraft('is_refeed_day', e.target.checked)}
              />
              Refeed day flag
            </label>
          )}
          {isClient && isFull && !coachCanEditStructure ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.muted }}>
              <strong>Refeed day:</strong> {structure.is_refeed_day ? 'Yes' : 'No'}
            </p>
          ) : null}
        </div>
        {coachCanEditStructure && (
          <>
            <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginTop: 12 }}>Coach precision notes</label>
            <textarea
              value={structure.coach_precision_notes ?? ''}
              onChange={(e) => patchDraft('coach_precision_notes', e.target.value)}
              rows={3}
              style={{
                width: '100%',
                marginTop: 6,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                padding: 10,
                background: colors.surface1,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!structure.precision_mode_enabled}
                onChange={(e) => patchDraft('precision_mode_enabled', e.target.checked)}
              />
              Precision mode enabled for this client
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={!!structure.is_peak_week_override_active}
                onChange={(e) => patchDraft('is_peak_week_override_active', e.target.checked)}
              />
              Peak week override flag (signal for client)
            </label>
          </>
        )}
        {personalCanEditSelf && (
          <>
            <label style={{ fontSize: 12, color: colors.muted, display: 'block', marginTop: 12 }}>Prep notes (self)</label>
            <textarea
              value={structure.prep_notes ?? ''}
              onChange={(e) => patchDraft('prep_notes', e.target.value)}
              rows={2}
              style={{
                width: '100%',
                marginTop: 6,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                padding: 10,
                background: colors.surface1,
                color: colors.text,
                fontSize: 14,
              }}
            />
          </>
        )}
        {(coachCanEditStructure || personalCanEditSelf) && (
          <Button className="mt-4" onClick={saveStructure} disabled={saveClientPrecisionMutation.isPending || savePersonalPrecisionMutation.isPending}>
            Save structure
          </Button>
        )}
      </Card>

      {(clientCanLog || coachCanEditStructure || personalCanEditSelf) && (
        <Button className="mt-4" variant="secondary" onClick={saveTodayActuals} disabled={saveClientDailyMutation.isPending || savePersonalDailyMutation.isPending}>
          Save today&apos;s water & sodium actuals
        </Button>
      )}

      <Card style={{ padding: spacing[16], marginTop: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>Prep consistency (last 7 days)</h2>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
          {waterSummary
            ? `Water: average gap to target about ${Math.round(waterSummary.avgDelta)} ml across ${waterSummary.daysCounted} logged days.`
            : 'Log water on more days to see stability vs target.'}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
          {sodiumSummary
            ? `Sodium: average gap to target about ${Math.round(sodiumSummary.avgDelta)} mg across ${sodiumSummary.daysCounted} logged days.`
            : 'Log sodium on more days to see stability vs target.'}
        </p>
      </Card>

      {coachCanEditStructure && coachPrepFlags.length > 0 ? (
        <Card style={{ padding: spacing[16], marginTop: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>Coach prep signals</h2>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            Stability-focused flags from logged precision data — not automated prep decisions.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
            {coachPrepFlags.map((f) => (
              <li key={f.id} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: f.severity === 'watch' ? 700 : 500 }}>{f.severity === 'watch' ? 'Watch: ' : ''}</span>
                {f.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isFull && coachCanEditStructure ? (
        <Card style={{ padding: spacing[16], marginTop: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>Date-bound peak overrides</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            Temporary patches only — revocable, labelled, and they do not overwrite baseline prep precision rows.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input type="date" value={ovFrom} onChange={(e) => setOvFrom(e.target.value)} />
            <Input type="date" value={ovTo} onChange={(e) => setOvTo(e.target.value)} />
            <Input value={ovLabel} onChange={(e) => setOvLabel(e.target.value)} placeholder="Label" />
            <Input type="number" value={ovWater} onChange={(e) => setOvWater(e.target.value)} placeholder="Patch water target (ml)" />
            <Input type="number" value={ovSodium} onChange={(e) => setOvSodium(e.target.value)} placeholder="Patch sodium target (mg)" />
            <Button onClick={submitOverride} disabled={addOverrideMutation.isPending}>
              Add override
            </Button>
          </div>
          <ul style={{ margin: spacing[16] + 'px 0 0', paddingLeft: 18, fontSize: 13, color: colors.text }}>
            {overrides.map((o) => (
              <li key={o.id} style={{ marginBottom: 8 }}>
                <strong>{o.label}</strong> · {o.valid_from} → {o.valid_to}
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => revokeOverrideMutation.mutate(o.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isFull && isClient ? (
        <Card style={{ padding: spacing[16], marginTop: spacing[16], border: `1px solid ${shell.cardBorder}` }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>Coach structure</h2>
          {clientPrecision?.coach_precision_notes ? (
            <p style={{ margin: 0, fontSize: 14, color: colors.text, whiteSpace: 'pre-wrap' }}>
              {clientPrecision.coach_precision_notes}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No coach notes yet.</p>
          )}
        </Card>
      ) : null}

      {!hasSupabase ? (
        <p style={{ marginTop: spacing[16], fontSize: 13, color: colors.muted }}>Connect Supabase to sync prep precision.</p>
      ) : null}
    </div>
  );

  if (isPersonal) {
    return <PersonalSurface>{pageBody}</PersonalSurface>;
  }
  return pageBody;
}
