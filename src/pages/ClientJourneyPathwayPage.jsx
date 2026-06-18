import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, sectionGap, standardCard } from '@/ui/pageLayout';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { JOURNEY_STAGES, journeyStageIndex, journeyStageLabel, suggestJourneyStageUpgrade } from '@/lib/clientJourneyStages';
import { evaluateMilestones } from '@/lib/milestoneEvaluation';
import { hapticNavigation } from '@/lib/haptics';
import { toast } from 'sonner';

const DEFAULT_STAGE = 'foundation';

export default function ClientJourneyPathwayPage() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const coachId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [stage, setStage] = useState(DEFAULT_STAGE);
  const [saving, setSaving] = useState(false);
  const [poseSuggestOpen, setPoseSuggestOpen] = useState(false);

  const load = useCallback(async () => {
    if (!hasSupabase || !clientId || !coachId) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: row, error } = await sb
        .from('clients')
        .select('id, name, full_name, journey_stage, coach_id, trainer_id, phase, created_at')
        .eq('id', clientId)
        .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        setClient(null);
        return;
      }
      setClient(row);
      const st = String(row.journey_stage || DEFAULT_STAGE).trim() || DEFAULT_STAGE;
      setStage(JOURNEY_STAGES.some((s) => s.id === st) ? st : DEFAULT_STAGE);

      const { data: ch } = await sb
        .from('checkins')
        .select('id, status, weight, weight_kg, submitted_at, created_date, adherence_pct, metrics')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false })
        .limit(40);
      setCheckins(Array.isArray(ch) ? ch : []);
    } catch {
      toast.error('Could not load journey');
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  const evaluation = useMemo(() => {
    if (!client) return { newMilestones: [] };
    return evaluateMilestones(
      { ...client, created_date: client.created_at },
      checkins,
      [],
      'kg'
    );
  }, [client, checkins]);

  const upgradeHint = useMemo(() => suggestJourneyStageUpgrade(stage, evaluation), [stage, evaluation]);

  const currentIdx = journeyStageIndex(stage);
  const nextStage = currentIdx < JOURNEY_STAGES.length - 1 ? JOURNEY_STAGES[currentIdx + 1] : null;

  const persistStage = async (nextId, { showPoseTip } = {}) => {
    if (!hasSupabase || !clientId || !coachId) return;
    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    try {
      const { error } = await sb.from('clients').update({ journey_stage: nextId }).eq('id', clientId);
      if (error) throw error;
      setStage(nextId);
      if (showPoseTip || nextId === 'competition_curious') {
        setPoseSuggestOpen(true);
      }
      toast.success('Journey stage updated');
    } catch {
      toast.error('Could not save stage');
    } finally {
      setSaving(false);
    }
  };

  const stageActions = (sid) => {
    if (sid === 'foundation') {
      return 'Assign habit programme · Set check-in frequency';
    }
    if (sid === 'competition_curious') {
      return 'Introduce pose library · Discuss timeline';
    }
    if (sid === 'first_prep') {
      return 'Start contest prep · Assign prep protocol';
    }
    return null;
  };

  if (!isCoach(effectiveRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg, color: colors.text }}>
        <p className="m-0">Not authorized.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, ...pageContainer }}>
        <p className="text-sm m-0" style={{ color: colors.muted }}>Loading journey…</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, ...pageContainer }}>
        <p className="m-0">Client not found.</p>
        <Button type="button" className="mt-3" variant="secondary" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, ...pageContainer, paddingBottom: spacing[24] }}>
      <div style={{ marginBottom: sectionGap }}>
        <button type="button" onClick={() => { hapticNavigation(); navigate(-1); }} className="text-sm font-semibold" style={{ color: colors.primary, background: 'none', border: 'none', padding: 0 }}>
          ← Back
        </button>
        <h1 className="text-xl font-bold mt-2 m-0" style={{ color: colors.text }}>Client journey</h1>
        <p className="text-sm m-0 mt-1" style={{ color: colors.muted }}>{client.name || client.full_name || 'Client'}</p>
      </div>

      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }} htmlFor="journey-stage-select">Current stage (coach)</label>
        <select
          id="journey-stage-select"
          className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: colors.border, background: colors.surface1, color: colors.text }}
          value={stage}
          disabled={saving}
          onChange={(e) => {
            const v = e.target.value;
            void persistStage(v, { showPoseTip: v === 'competition_curious' });
          }}
        >
          {JOURNEY_STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {upgradeHint ? (
          <p className="text-xs m-0 mt-2" style={{ color: colors.warning }}>
            Suggested: consider moving to <strong>{journeyStageLabel(upgradeHint.suggestedId)}</strong> — {upgradeHint.reason}
          </p>
        ) : null}
      </Card>

      {poseSuggestOpen ? (
        <Card style={{ ...standardCard, padding: spacing[14], marginBottom: sectionGap, border: `1px solid ${colors.primary}`, background: colors.primarySubtle }}>
          <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>
            Consider introducing posing practice — assign the beginner pose library to this client.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button type="button" onClick={() => { hapticNavigation(); navigate(`/comp-prep/pose-library`); }}>Open pose library</Button>
            <Button type="button" variant="outline" onClick={() => setPoseSuggestOpen(false)}>Dismiss</Button>
          </div>
        </Card>
      ) : null}

      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>Pathway</p>
        <div className="overflow-x-auto mt-3 pb-2">
          <div className="flex gap-1 min-w-max items-stretch">
            {JOURNEY_STAGES.map((s, i) => {
              const active = s.id === stage;
              const past = i < currentIdx;
              return (
                <div
                  key={s.id}
                  className="flex flex-col items-center"
                  style={{ minWidth: 72 }}
                  title={s.milestones.join(' · ')}
                >
                  <div
                    className="rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      width: 28,
                      height: 28,
                      background: active ? colors.warning : past ? colors.successSubtle : colors.surface2,
                      color: active ? '#0f172a' : colors.text,
                      border: `2px solid ${active ? colors.warning : colors.border}`,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-[10px] font-semibold mt-1 text-center" style={{ color: active ? colors.warning : colors.muted }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        {nextStage ? (
          <p className="text-xs m-0 mt-2" style={{ color: colors.muted }} title={nextStage.milestones.join(' · ')}>
            Next: <span style={{ color: colors.text }}>{nextStage.label}</span>
            {' '}
            — milestones remaining: {nextStage.milestones.slice(0, 2).join(', ')}…
          </p>
        ) : null}
      </Card>

      <Card style={{ ...standardCard, padding: spacing[16] }}>
        <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>{journeyStageLabel(stage)}</p>
        <p className="text-sm m-0 mt-2" style={{ color: colors.text }}>{JOURNEY_STAGES.find((s) => s.id === stage)?.description}</p>
        <p className="text-xs m-0 mt-2" style={{ color: colors.muted }}>Typical: {JOURNEY_STAGES.find((s) => s.id === stage)?.typicalWeeks}</p>
        <ul className="text-xs mt-3 mb-0 pl-4" style={{ color: colors.muted }}>
          {(JOURNEY_STAGES.find((s) => s.id === stage)?.milestones || []).map((m) => (
            <li key={m} style={{ marginBottom: 4 }}>{m}</li>
          ))}
        </ul>
        {stageActions(stage) ? (
          <p className="text-xs font-semibold m-0 mt-3" style={{ color: colors.primary }}>Coach actions: {stageActions(stage)}</p>
        ) : null}
      </Card>
    </div>
  );
}
