import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMessagesThreadPathWithQuery } from '@/lib/messagesPath';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { getSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { Button } from '@/components/ui/button';

function summarizeRows(sessionSets, exerciseNameById) {
  const grouped = new Map();
  for (const s of sessionSets) {
    if (!s?.exercise_id) continue;
    const key = s.exercise_id;
    const row = grouped.get(key) || {
      exerciseId: key,
      name: exerciseNameById.get(key) || 'Exercise',
      setCount: 0,
      prescribedReps: 0,
      prescribedWeight: 0,
      actualReps: 0,
      actualWeight: 0,
    };
    row.setCount += 1;
    row.prescribedReps += Number(s.prescribed_reps) || 0;
    row.prescribedWeight += Number(s.prescribed_weight) || 0;
    row.actualReps += Number(s.reps_done) || 0;
    row.actualWeight += Number(s.weight_done) || 0;
    grouped.set(key, row);
  }
  return Array.from(grouped.values()).map((r) => {
    const avgPrescribedW = r.setCount > 0 ? r.prescribedWeight / r.setCount : 0;
    const avgActualW = r.setCount > 0 ? r.actualWeight / r.setCount : 0;
    const repDeltaPct = r.prescribedReps > 0 ? (r.actualReps - r.prescribedReps) / r.prescribedReps : 0;
    const weightDeltaPct = avgPrescribedW > 0 ? (avgActualW - avgPrescribedW) / avgPrescribedW : 0;
    const lowerPct = Math.min(repDeltaPct, weightDeltaPct);
    const band = lowerPct <= -0.2 ? 'red' : lowerPct <= -0.05 ? 'amber' : 'green';
    return {
      ...r,
      avgPrescribedW,
      avgActualW,
      repDelta: r.actualReps - r.prescribedReps,
      weightDelta: avgActualW - avgPrescribedW,
      band,
    };
  });
}

function interpretRPE(sessionRPE, avgSetRIR) {
  if (sessionRPE >= 9 && avgSetRIR >= 3) {
    return 'High session RPE but per-set RIR suggests sets felt manageable individually. Client may be fatigued systemically - check sleep and recovery data.';
  }
  if (sessionRPE <= 5 && avgSetRIR <= 1) {
    return 'Low session RPE despite sets being taken close to failure. Client may be understating effort - or the programme weight needs increasing.';
  }
  if (sessionRPE >= 8 && avgSetRIR <= 1) {
    return 'High effort across both session and sets. This was a genuinely hard session - ensure 48h recovery before next similar session.';
  }
  if (sessionRPE <= 4 && avgSetRIR >= 3) {
    return 'Easy session overall with comfortable sets. Consider progressing load on the main compound exercises.';
  }
  return 'Session RPE aligns with per-set effort levels - normal training stimulus.';
}

export default function WorkoutReviewPage() {
  const { clientId, sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const supabase = getSupabase();
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);
  const [applyBusyId, setApplyBusyId] = useState(null);

  const { data: session } = useQuery({
    queryKey: ['workout-review-session', sessionId],
    queryFn: async () => {
      const { data } = await supabase.from('workout_sessions').select('*').eq('id', sessionId).maybeSingle();
      return data ?? null;
    },
    enabled: !!sessionId && !!supabase,
  });
  const { data: sessionSets = [] } = useQuery({
    queryKey: ['workout-review-sets', sessionId],
    queryFn: async () => {
      const { data } = await supabase.from('workout_session_sets').select('*').eq('session_id', sessionId).eq('completed', true);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!sessionId && !!supabase,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['workout-review-notes', sessionId],
    queryFn: async () => {
      const { data } = await supabase.from('workout_exercise_notes').select('*').eq('session_id', sessionId).order('created_at', { ascending: false });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!sessionId && !!supabase,
  });
  const { data: exercises = [] } = useQuery({
    queryKey: ['workout-review-exercises', session?.program_day_id],
    queryFn: async () => {
      const { data } = await supabase.from('program_exercises').select('id, day_id, exercise_name, weight_kg, coach_updated_at').eq('day_id', session.program_day_id);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session?.program_day_id && !!supabase,
  });
  const { data: blockMeta } = useQuery({
    queryKey: ['workout-review-block-meta', session?.program_day_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('program_days')
        .select('id, week_id, program_weeks(block_id)')
        .eq('id', session.program_day_id)
        .maybeSingle();
      const blockId = data?.program_weeks?.block_id || null;
      return { blockId };
    },
    enabled: !!session?.program_day_id && !!supabase,
  });

  const exerciseNameById = useMemo(() => new Map(exercises.map((e) => [e.id, e.exercise_name || 'Exercise'])), [exercises]);
  const rows = useMemo(() => summarizeRows(sessionSets, exerciseNameById), [sessionSets, exerciseNameById]);
  const avgSetRIR = useMemo(() => {
    const vals = sessionSets.map((s) => Number(s?.rir_done)).filter((n) => Number.isFinite(n));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [sessionSets]);
  const sessionRpe = session?.session_rpe != null ? Number(session.session_rpe) : null;
  const rpeTone = sessionRpe == null
    ? { color: colors.muted, label: 'Not recorded' }
    : sessionRpe <= 4
      ? { color: colors.success, label: 'Easy session' }
      : sessionRpe <= 7
        ? { color: colors.primary, label: 'Working hard' }
        : sessionRpe <= 9
          ? { color: colors.warning, label: 'High effort - monitor recovery' }
          : { color: colors.danger, label: 'Max session - ensure adequate rest' };

  const adjustmentSuggestions = useMemo(() => {
    if (!sessionSets?.length) return [];
    const byExercise = {};
    sessionSets.forEach((set) => {
      const key = set.exercise_id || set.exercise_name;
      if (!key) return;
      if (!byExercise[key]) byExercise[key] = [];
      byExercise[key].push(set);
    });

    return Object.entries(byExercise)
      .map(([key, setsByExercise]) => {
        void key;
        const prescribed = Number(setsByExercise[0]?.prescribed_weight);
        const actual = setsByExercise.map((s) => Number(s.weight_done)).filter((v) => Number.isFinite(v) && v > 0);
        if (!Number.isFinite(prescribed) || prescribed <= 0 || !actual.length) return null;

        const avgActual = actual.reduce((s, v) => s + v, 0) / actual.length;
        const gap = ((prescribed - avgActual) / prescribed) * 100;
        const rirVals = setsByExercise.map((s) => Number(s.rir_done)).filter((v) => Number.isFinite(v));
        const avgRIR = rirVals.length ? rirVals.reduce((s, v) => s + v, 0) / rirVals.length : null;

        let suggestion = null;
        const programExerciseId = setsByExercise[0]?.exercise_id || null;
        if (gap > 20) {
          suggestion = {
            type: 'reduce',
            exerciseName: setsByExercise[0]?.exercise_name || 'Exercise',
            exerciseId: programExerciseId,
            programExerciseId,
            currentWeight: prescribed,
            suggestedWeight: Math.round(avgActual / 2.5) * 2.5,
            reason: `Client averaged ${avgActual.toFixed(1)}kg vs ${prescribed}kg prescribed (${gap.toFixed(0)}% below).`,
          };
        } else if (gap < 0 && avgRIR != null && avgRIR >= 3) {
          suggestion = {
            type: 'increase',
            exerciseName: setsByExercise[0]?.exercise_name || 'Exercise',
            exerciseId: programExerciseId,
            programExerciseId,
            currentWeight: prescribed,
            suggestedWeight: Math.round((prescribed + 2.5) / 2.5) * 2.5,
            reason: `Client hit all sets above prescribed weight with ${avgRIR.toFixed(1)} RIR - ready to progress.`,
          };
        }
        return suggestion;
      })
      .filter(Boolean);
  }, [sessionSets]);

  const visibleAdjustmentSuggestions = useMemo(
    () => adjustmentSuggestions.filter((_, index) => !dismissedSuggestions.includes(index)),
    [adjustmentSuggestions, dismissedSuggestions]
  );

  const applyAdjustment = (suggestion) => {
    const params = new URLSearchParams({
      clientId: String(clientId || ''),
      blockId: String(blockMeta?.blockId || ''),
      source: 'workout_review',
      focusExercise: String(suggestion?.exerciseId || ''),
      prefillWeightKg: String(suggestion?.suggestedWeight || ''),
    });
    navigate(`/program-builder?${params.toString()}`);
  };

  const dismissSuggestion = (index) => {
    setDismissedSuggestions((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  const SectionLabel = ({ children }) => (
    <p style={{ fontSize: 12, fontWeight: 700, color: colors.muted, margin: 0 }}>{children}</p>
  );

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, padding: spacing[16] }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: spacing[10] }}>
        <h1 style={{ margin: 0, fontSize: 24, color: colors.text }}>Workout review</h1>
        <Card style={{ padding: spacing[12] }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: rpeTone.color }}>
            Session RPE: {sessionRpe != null ? `${sessionRpe}/10` : '—'} {sessionRpe != null ? `- ${rpeTone.label}` : ''}
          </p>
          {sessionRpe != null ? (
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
              {interpretRPE(sessionRpe, avgSetRIR ?? 2)}
            </p>
          ) : null}
        </Card>
        <Card style={{ padding: spacing[12] }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
            Session readiness: Sleep {session?.readiness_sleep ?? '—'}/5, Energy {session?.readiness_energy ?? '—'}/5, Soreness {session?.readiness_soreness ?? '—'}/5
          </p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>
            Low readiness noted - performance gap may reflect recovery rather than programme difficulty.
          </p>
        </Card>
        <Card style={{ padding: spacing[12] }}>
          <div style={{ display: 'grid', gap: spacing[8] }}>
            {rows.map((r) => (
              <div
                key={r.exerciseId}
                style={{
                  borderRadius: radii.card,
                  border: `1px solid ${r.band === 'green' ? colors.success : r.band === 'amber' ? colors.warning : colors.danger}`,
                  padding: spacing[10],
                  background: colors.surface1,
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>{r.name}</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                  Prescribed {r.setCount} x {Math.round(r.prescribedReps / Math.max(1, r.setCount))} @ {Math.round(r.avgPrescribedW * 10) / 10}kg ·
                  Actual {r.setCount} x {Math.round(r.actualReps / Math.max(1, r.setCount))} @ {Math.round(r.avgActualW * 10) / 10}kg
                </p>
              </div>
            ))}
          </div>
        </Card>
        {notes.length > 0 ? (
          <Card style={{ padding: spacing[12] }}>
            <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700 }}>Client notes</p>
            {notes.map((n) => (
              <blockquote key={n.id} style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: spacing[10], borderLeft: `3px solid ${colors.border}`, color: colors.text }}>
                {n.note}
              </blockquote>
            ))}
          </Card>
        ) : null}
        {visibleAdjustmentSuggestions.length > 0 ? (
          <div style={{ marginTop: spacing[16] }}>
            <SectionLabel>Atlas suggestions</SectionLabel>
            {visibleAdjustmentSuggestions.map((s, i) => (
              <Card key={i} style={{ ...standardCard, padding: spacing[12], marginBottom: spacing[8] }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: colors.text, margin: 0 }}>
                  {s.type === 'reduce' ? '↓' : '↑'} {s.exerciseName}
                </p>
                <p style={{ fontSize: 12, color: colors.muted, margin: `${spacing[4]}px 0` }}>{s.reason}</p>
                <p style={{ fontSize: 13, color: colors.primary, margin: 0 }}>
                  {s.currentWeight}kg → {s.suggestedWeight}kg
                </p>
                <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[12] }}>
                  <Button
                    disabled={!!applyBusyId}
                    onClick={() => applyAdjustment(s)}
                  >
                    {applyBusyId === (s.programExerciseId || s.exerciseId) ? 'Applying…' : 'Apply change'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openProgramBuilderWithSuggestion(s)}>
                    Open in builder
                  </Button>
                  <Button variant="ghost" onClick={() => dismissSuggestion(i)}>Dismiss</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: spacing[8] }}>
          <button
            type="button"
            onClick={() => navigate(`/program-builder?clientId=${encodeURIComponent(clientId)}&blockId=${encodeURIComponent(blockMeta?.blockId || '')}`)}
            style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700 }}
          >
            <SlidersHorizontal size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Adjust programme
          </button>
          <button
            type="button"
            onClick={() => navigate(getMessagesThreadPathWithQuery(clientId, { draft: "Saw your note about bench feeling heavy - let's adjust next week." }))}
            style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontWeight: 700 }}
          >
            <MessageSquare size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Send message
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`atlas_workout_reviewed_${sessionId}`, '1');
              navigate(`/clients/${encodeURIComponent(clientId)}`);
            }}
            style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontWeight: 700 }}
          >
            <CheckCircle2 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Log as reviewed
          </button>
        </div>
      </div>
    </div>
  );
}
