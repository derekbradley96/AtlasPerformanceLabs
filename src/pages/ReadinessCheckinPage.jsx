import React, { useMemo, useState } from 'react';
import { atlasMigrationDataAttributes, deriveReadinessCheckinRouteState } from '@/lib/atlasMigrationPhases';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isClient, isPersonal } from '@/lib/roles';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { calculateReadinessScore } from '@/lib/readinessEngine';
import { createReadinessCheckinWithRecommendation, getLocalDateKey, normalizeReadinessScoresForPersistence } from '@/lib/readinessCheckinApi';
import { clampAdherence0to100, clampReadinessAggregate0to100, formatReadinessAsOutOfTen } from '@/lib/progressMetricsValidation';
import { runPersonalFeedbackLoop } from '@/lib/personalFeedbackLoop';
import { getPersonalAutoAdjustmentsEnabled } from '@/lib/autoAdjustmentClarity';
import { fetchWeeklyAutoAdherencePersonal } from '@/lib/weeklyAutoAdherence';
import {
  buildTodayLooksLikeLines,
  buildPersonalTodaysAdjustment,
  buildClientTodaysAdjustment,
  withInputReasonFragment,
} from '@/lib/dailyCheckinFeedback';
import { colors, spacing, touchTargetMin, radii, shell } from '@/ui/tokens';
import Card from '@/ui/Card';
import TopBar from '@/components/ui/TopBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { buildCompletionMomentumFeedback, getRetentionStreaks } from '@/lib/retentionHabitService';

const SCALE = [1, 2, 3, 4, 5];
const STEPS = ['weight', 'feel', 'notes'];

function clamp15(v) {
  const n = Math.round(Number(v) || 0);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(5, Math.max(1, n));
}

/** Ensure JSONB-safe payload for Supabase. */
function jsonSafe(v) {
  try {
    return JSON.parse(JSON.stringify(v ?? {}));
  } catch {
    return {};
  }
}

async function insertPersonalCheckinRow(supabase, row) {
  let { error } = await supabase.from('personal_checkins').insert(row).select('id').single();
  if (
    error &&
    row.recovery != null &&
    (String(error.message || '').toLowerCase().includes('recovery') || String(error.code) === '42703')
  ) {
    const { recovery: _r, ...rest } = row;
    const second = await supabase.from('personal_checkins').insert(rest).select('id').single();
    error = second.error;
  }
  return error;
}

/** Map 1–5 subjective inputs to readiness_engine (5 slots). */
function mapFeelToReadinessScores({ energy, recovery, sleepQuality, stress, appetite }) {
  const e = clamp15(energy);
  const r = clamp15(recovery);
  const sq = clamp15(sleepQuality);
  const s = clamp15(stress);
  const a = clamp15(appetite);
  return {
    sleep_score: sq,
    fatigue_score: Math.min(5, Math.max(1, 6 - r)),
    soreness_score: a,
    stress_score: s,
    motivation_score: e,
  };
}

function ScaleRow({ label, value, onChange, hints }) {
  return (
    <Card style={{ padding: spacing[12] }}>
      <div style={{ marginBottom: spacing[8] }}>
        <p style={{ margin: 0, fontSize: 14, color: colors.text, fontWeight: 600 }}>{label}</p>
      </div>
      <div style={{ display: 'flex', gap: spacing[6], flexWrap: 'wrap' }}>
        {SCALE.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                minHeight: Math.max(touchTargetMin, 40),
                minWidth: 44,
                padding: '0 12px',
                borderRadius: 999,
                border: `1px solid ${active ? colors.primary : colors.border}`,
                background: active ? colors.primarySubtle : colors.surface2,
                color: active ? colors.primary : colors.text,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 120ms ease, background-color 140ms ease',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {hints ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing[8], fontSize: 11, color: colors.muted }}>
          <span>{hints.left}</span>
          <span>{hints.right}</span>
        </div>
      ) : null}
    </Card>
  );
}

function AdjustmentRow({ label, value, showBorder }) {
  return (
    <div style={{ paddingBottom: spacing[10], borderBottom: showBorder ? `1px solid ${colors.border}` : 'none' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, color: colors.text, lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

export default function ReadinessCheckinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const returnTo = searchParams.get('return') || '';

  const [energy, setEnergy] = useState(0);
  const [recovery, setRecovery] = useState(0);
  const [sleepQuality, setSleepQuality] = useState(0);
  const [stress, setStress] = useState(0);
  const [appetite, setAppetite] = useState(0);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [postSubmit, setPostSubmit] = useState(null);

  const allowed = isClient(effectiveRole) || isPersonal(effectiveRole);

  const feelValues = useMemo(
    () => ({ energy, recovery, sleepQuality, stress, appetite }),
    [energy, recovery, sleepQuality, stress, appetite]
  );

  const todayLines = useMemo(() => buildTodayLooksLikeLines(feelValues), [feelValues]);

  const canSubmit = energy && recovery && sleepQuality && stress && appetite && !submitting;

  const activeStep = STEPS[stepIndex];
  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const readinessMigration = useMemo(() => {
    if (!allowed) return deriveReadinessCheckinRouteState({ surface: 'role_denied' });
    if (postSubmit?.adjustment) {
      const r = isClient(effectiveRole) ? 'client' : 'personal';
      return deriveReadinessCheckinRouteState({ role: r, surface: 'post_submit' });
    }
    const r = isClient(effectiveRole) ? 'client' : 'personal';
    return deriveReadinessCheckinRouteState({ role: r, surface: 'form', step: activeStep });
  }, [allowed, postSubmit?.adjustment, effectiveRole, activeStep]);

  const canContinueStep = useMemo(() => {
    if (activeStep === 'feel') {
      return Boolean(energy && recovery && sleepQuality && stress && appetite);
    }
    return true;
  }, [activeStep, energy, recovery, sleepQuality, stress, appetite]);

  const preview = useMemo(() => {
    if (!energy || !recovery || !sleepQuality || !stress || !appetite) return null;
    const scoresPre = mapFeelToReadinessScores(feelValues);
    const norm = normalizeReadinessScoresForPersistence(scoresPre);
    const calc = calculateReadinessScore(norm);
    const readiness_score = clampReadinessAggregate0to100(calc.readiness_score);
    return { ...calc, readiness_score };
  }, [feelValues, energy, recovery, sleepQuality, stress, appetite]);

  const finishNavigation = () => {
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      navigate(returnTo, { replace: true });
    } else {
      navigate(-1);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !user?.id || !allowed) return;
    // Client check-ins must reach the coach, so they need Supabase. The
    // personal loop (runPersonalFeedbackLoop + local adjustment history) is
    // local-first — every remote write below already sits behind if (supabase).
    if (!hasSupabase && !isPersonal(effectiveRole)) {
      toast.error('Check-in requires a connection.');
      return;
    }

    setSubmitting(true);
    try {
      let adherenceAuto = 60;
      if (isPersonal(effectiveRole)) {
        const w = await fetchWeeklyAutoAdherencePersonal(user.id);
        adherenceAuto = clampAdherence0to100(w?.overallPct != null ? w.overallPct : 60);
      }

      const scores = mapFeelToReadinessScores(feelValues);

      let recommendation = null;
      let recommendationError = null;
      if (hasSupabase) {
        ({ recommendation, recommendationError } = await createReadinessCheckinWithRecommendation({
          userId: user.id,
          effectiveRole,
          scores,
          notes,
        }));
      }

      let loop = null;
      if (isPersonal(effectiveRole)) {
        const wRaw = (weight || '').trim() ? Number(weight) : null;
        const weightKg =
          wRaw != null && Number.isFinite(wRaw) && wRaw > 0 ? Math.min(400, Math.max(25, wRaw)) : null;
        loop = runPersonalFeedbackLoop(user.id, {
          weight: weightKg,
          energy,
          recovery,
          sleep: sleepQuality,
          stress,
          appetite,
          adherence: adherenceAuto,
          notes,
        });
        const supabase = getSupabase();
        if (supabase) {
          const personalRow = {
            user_id: user.id,
            weight: weightKg,
            energy: clamp15(energy),
            recovery: clamp15(recovery),
            sleep: clamp15(sleepQuality),
            stress: clamp15(stress),
            hunger: clamp15(appetite),
            adherence: adherenceAuto,
            notes: notes?.trim() || null,
          };
          const pcErr = await insertPersonalCheckinRow(supabase, personalRow);
          if (pcErr) throw pcErr;

          const paPayload = {
            profile_id: user.id,
            trigger_type: loop?.decision?.type || 'on_track',
            reason: loop?.decision?.reason || 'On track',
            previous_payload: {},
            applied_payload: jsonSafe(loop?.programAdjustment),
            status: loop?.programAdjustment ? 'applied' : 'no_change',
          };
          const { error: paErr } = await supabase.from('program_adjustments').insert(paPayload);
          if (paErr) throw paErr;

          const naPayload = {
            profile_id: user.id,
            trigger_type: loop?.decision?.type || 'on_track',
            reason: loop?.decision?.reason || 'On track',
            previous_payload: {},
            applied_payload: jsonSafe(loop?.nutritionAdjustment),
            status: loop?.nutritionAdjustment ? 'applied' : 'no_change',
          };
          const { error: naErr } = await supabase.from('nutrition_adjustments').insert(naPayload);
          if (naErr) throw naErr;
        }

        const autoAdjOn = getPersonalAutoAdjustmentsEnabled(user.id);
        if (!autoAdjOn && loop?.decision?.type !== 'on_track') {
          toast.message('Auto adjustments are off — your plan was not changed automatically.');
        }
      }

      getRetentionStreaks({ profileId: user.id })
        .then((retention) => {
          const msg = buildCompletionMomentumFeedback({ retention, type: 'checkin' });
          if (msg) toast.message(msg);
        })
        .catch(() => {});

      if (recommendationError && import.meta.env.DEV) {
        console.warn('[ReadinessCheckinPage] recommendation row not saved', recommendationError);
      }

      const day = getLocalDateKey();
      queryClient.invalidateQueries({ queryKey: ['readiness-checkin-today'] });
      queryClient.invalidateQueries({ queryKey: ['readiness-checkin-today', user.id, day] });
      queryClient.invalidateQueries({ queryKey: ['personal-home-today-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['today-readiness-checkin-personal'] });
      queryClient.invalidateQueries({ queryKey: ['today-readiness-checkin-client'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-auto-adherence'] });

      if (isPersonal(effectiveRole)) {
        let adj = buildPersonalTodaysAdjustment(loop);
        adj = withInputReasonFragment(adj, feelValues);
        setPostSubmit({ kind: 'personal', adjustment: adj, loop });
      } else {
        let adj = buildClientTodaysAdjustment(recommendation);
        adj = withInputReasonFragment(adj, feelValues);
        setPostSubmit({ kind: 'client', adjustment: adj, recommendation });
      }
    } catch (err) {
      console.error('[ReadinessCheckinPage] save failed', err?.cause || err);
      const detail = String(err?.cause?.message || err?.message || '').trim();
      toast.error(
        detail && detail.length < 200
          ? detail
          : 'Could not save check-in. Check your connection, run Supabase migrations if local, and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return (
      <div
        {...atlasMigrationDataAttributes(readinessMigration.phase, readinessMigration.primary)}
        className="min-h-screen"
        style={{ background: colors.bg, color: colors.text }}
      >
        <TopBar title="Daily Check-in" onBack={() => navigate(-1)} />
        <div style={{ paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: spacing[16], paddingBottom: spacing[16] }}>
          <p style={{ color: colors.muted }}>This check-in is available for client and personal accounts.</p>
        </div>
      </div>
    );
  }

  if (postSubmit?.adjustment) {
    const adj = postSubmit.adjustment;
    return (
      <div
        {...atlasMigrationDataAttributes(readinessMigration.phase, readinessMigration.primary)}
        className="min-h-screen"
        style={{ background: colors.bg, color: colors.text }}
      >
        <TopBar title="Daily Check-in" onBack={() => finishNavigation()} />
        <div
          style={{
            paddingLeft: shell.pagePaddingH,
            paddingRight: shell.pagePaddingH,
            paddingTop: spacing[16],
            paddingBottom: `calc(${spacing[32]}px + env(safe-area-inset-bottom, 0px))`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing[14],
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: colors.muted, lineHeight: 1.45 }}>
            This takes 30 seconds. We use this to adjust your training.
          </p>
          <Card style={{ padding: spacing[16], border: `1px solid ${colors.primary}44`, background: colors.surface1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Today&apos;s Adjustment
            </p>
            <div style={{ marginTop: spacing[12] }}>
              <AdjustmentRow label="Volume" value={adj.volume} showBorder />
              <AdjustmentRow label="Intensity" value={adj.intensity} showBorder />
              <AdjustmentRow label="Rest" value={adj.rest} showBorder={false} />
            </div>
            <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>{adj.reason}</p>
          </Card>
          <Button type="button" onClick={() => finishNavigation()} style={{ minHeight: touchTargetMin + 4 }}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...atlasMigrationDataAttributes(readinessMigration.phase, readinessMigration.primary)}
      className="min-h-screen"
      style={{ background: colors.bg, color: colors.text }}
    >
      <TopBar title="Daily Check-in" onBack={() => navigate(-1)} />
      <form
        onSubmit={onSubmit}
        style={{
          paddingLeft: shell.pagePaddingH,
          paddingRight: shell.pagePaddingH,
          paddingTop: spacing[10],
          paddingBottom: `calc(${spacing[32]}px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[12],
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: colors.muted, lineHeight: 1.45 }}>
          This takes 30 seconds. We use this to adjust your training.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <div style={{ width: '100%', height: 6, borderRadius: 999, background: colors.surface2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: colors.primary,
              transition: 'width 220ms ease',
            }}
          />
        </div>

        {activeStep === 'weight' && (
          <Card style={{ padding: spacing[12] }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: spacing[8], color: colors.muted }}>Weight (optional)</label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 82.4"
              style={{
                width: '100%',
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.text,
                padding: spacing[10],
              }}
            />
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>Used to track trend over time.</p>
          </Card>
        )}

        {activeStep === 'feel' && (
          <>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.text }}>How do you feel today?</p>
            <ScaleRow label="Energy" value={energy} onChange={setEnergy} hints={{ left: 'Low', right: 'High' }} />
            <ScaleRow label="Recovery" value={recovery} onChange={setRecovery} hints={{ left: 'Low', right: 'High' }} />
            <ScaleRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} hints={{ left: 'Poor', right: 'Great' }} />
            <ScaleRow label="Stress" value={stress} onChange={setStress} hints={{ left: 'Low', right: 'High' }} />
            <ScaleRow label="Appetite" value={appetite} onChange={setAppetite} hints={{ left: 'Low', right: 'High' }} />

            {todayLines.length > 0 ? (
              <Card style={{ padding: spacing[14], background: colors.surface1, border: `1px solid ${colors.border}` }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text }}>Today looks like:</p>
                <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 18, color: colors.muted, fontSize: 13, lineHeight: 1.55 }}>
                  {todayLines.map((line) => (
                    <li key={line} style={{ marginBottom: 4 }}>
                      {line}
                    </li>
                  ))}
                </ul>
                {preview ? (
                  <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 12, color: colors.muted }}>
                    Estimated readiness: {formatReadinessAsOutOfTen(preview.readiness_score)} ({preview.readiness_status.replace(/_/g, ' ')})
                  </p>
                ) : null}
              </Card>
            ) : null}
          </>
        )}

        {activeStep === 'notes' && (
          <Card style={{ padding: spacing[12] }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: spacing[8], color: colors.muted }}>Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything affecting today’s training?"
              style={{
                width: '100%',
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.text,
                padding: spacing[10],
                resize: 'vertical',
              }}
            />
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[8] }}>
          <Button
            type="button"
            disabled={stepIndex === 0}
            variant="outline"
            onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
            style={{ minHeight: touchTargetMin }}
          >
            Back
          </Button>
          {stepIndex < STEPS.length - 1 ? (
            <Button
              type="button"
              disabled={!canContinueStep}
              onClick={() => setStepIndex((s) => Math.min(STEPS.length - 1, s + 1))}
              style={{ minHeight: touchTargetMin }}
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!canSubmit}
              style={{ minHeight: touchTargetMin + 4 }}
            >
              {submitting ? 'Saving...' : 'Submit check-in'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
