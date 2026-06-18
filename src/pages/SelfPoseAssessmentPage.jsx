import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { poseLibraryData } from '@/lib/data/poseLibraryData';
import { JUDGING_CRITERIA } from '@/lib/divisionJudgingCriteria';
import { buildSelfAssessmentChecklist } from '@/lib/poseSelfAssessmentUtils';
import { getExerciseById } from '@/data/exercises/exerciseLibrary';

const DIVISION_ENTRIES = Object.keys(JUDGING_CRITERIA).map((key) => ({
  value: key,
  label: key.replace(/_/g, ' '),
}));

function divisionToLibraryLabels(divisionKey) {
  const k = String(divisionKey || '').toLowerCase();
  if (k === 'bikini') return ['BIKINI'];
  if (k === 'figure') return ['FIGURE', 'WELLNESS'];
  if (k === 'mens_physique') return ['PHYSIQUE'];
  if (k === 'classic_physique') return ['CLASSIC'];
  if (k === 'bodybuilding') return ['BODYBUILDING'];
  return ['BIKINI', 'FIGURE', 'PHYSIQUE', 'CLASSIC', 'BODYBUILDING', 'WELLNESS'];
}

function filterPosesForDivision(divisionKey) {
  const labels = divisionToLibraryLabels(divisionKey);
  return Object.values(poseLibraryData).filter((p) =>
    (p.divisions || []).some((d) => labels.includes(String(d).toUpperCase()))
  );
}

async function fetchPoseHistory(profileId, poseId, division) {
  if (!hasSupabase || !profileId || !poseId) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('pose_self_assessments')
    .select('overall_score, assessed_at')
    .eq('profile_id', profileId)
    .eq('pose_id', poseId)
    .eq('division', division)
    .order('assessed_at', { ascending: true });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export default function SelfPoseAssessmentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [division, setDivision] = useState('bikini');
  const [poseId, setPoseId] = useState('');
  const [scores, setScores] = useState({});
  const [submitted, setSubmitted] = useState(null);

  const poses = useMemo(() => filterPosesForDivision(division), [division]);
  const checklist = useMemo(() => {
    if (!poseId) return null;
    return buildSelfAssessmentChecklist(division, poseId);
  }, [division, poseId]);

  const { data: history = [] } = useQuery({
    queryKey: ['pose-self-history', user?.id, poseId, division],
    queryFn: () => fetchPoseHistory(user.id, poseId, division),
    enabled: Boolean(hasSupabase && user?.id && poseId),
  });

  const progressLine = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const a = Number(first.overall_score);
    const b = Number(last.overall_score);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const max = (checklist?.items.length || 5) * 3;
    const t0 = new Date(first.assessed_at).getTime();
    const t1 = new Date(last.assessed_at).getTime();
    const weeks = Math.max(1, Math.round((t1 - t0) / (7 * 86400000)));
    return `Your score moved from ${a}/${max} to ${b}/${max} over about ${weeks} week${weeks === 1 ? '' : 's'}.`;
  }, [history, checklist?.items.length]);

  const weakAreas = submitted?.weakAreas || [];
  const poseLinks = submitted?.pose?.poseExerciseLinks || [];

  const setScore = (id, v) => setScores((prev) => ({ ...prev, [id]: v }));

  const runSubmit = async () => {
    if (!checklist || !user?.id || !hasSupabase) return;
    const items = checklist.items;
    const missing = items.some((it) => scores[it.id] == null);
    if (missing) return;
    const overall = items.reduce((acc, it) => acc + Number(scores[it.id]), 0);
    const pairs = items.map((it) => ({ id: it.id, text: it.text, score: Number(scores[it.id]) }));
    const sorted = [...pairs].sort((x, y) => x.score - y.score);
    const weak = sorted.slice(0, 3);
    const pose = poseLibraryData[poseId];
    setSubmitted({ overall, max: items.length * 3, weakAreas: weak, pose });

    const sb = getSupabase();
    if (sb) {
      const checklist_scores = {};
      items.forEach((it) => {
        checklist_scores[it.id] = Number(scores[it.id]);
      });
      await sb.from('pose_self_assessments').insert({
        profile_id: user.id,
        pose_id: poseId,
        division,
        checklist_scores,
        overall_score: overall,
      });
      qc.invalidateQueries({ queryKey: ['pose-self-history', user.id, poseId, division] });
    }
  };

  const resetFlow = () => {
    setPoseId('');
    setScores({});
    setSubmitted(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <TopBar title="Pose self-assessment" onBack={() => navigate(-1)} showBack />
      <div style={{ padding: `${spacing[12]}px ${shell.pagePaddingH}px ${spacing[24]}px` }}>
        <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
          Score your mandatory poses against division criteria. Use it weekly to see what to improve next.
        </p>

        <Card style={{ padding: spacing[14], marginBottom: spacing[12] }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>
            Division
            <select
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                setPoseId('');
                setScores({});
                setSubmitted(null);
              }}
              style={{
                marginTop: 6,
                width: '100%',
                minHeight: 44,
                borderRadius: radii.input,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.text,
                padding: '0 10px',
              }}
            >
              {DIVISION_ENTRIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </Card>

        <Card style={{ padding: spacing[14], marginBottom: spacing[12] }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>
            Pose
            <select
              value={poseId}
              onChange={(e) => {
                setPoseId(e.target.value);
                setScores({});
                setSubmitted(null);
              }}
              style={{
                marginTop: 6,
                width: '100%',
                minHeight: 44,
                borderRadius: radii.input,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.text,
                padding: '0 10px',
              }}
            >
              <option value="">Select a pose</option>
              {poses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </Card>

        {progressLine ? (
          <p style={{ fontSize: 13, color: colors.muted, margin: `0 0 ${spacing[12]}px` }}>{progressLine}</p>
        ) : null}

        {checklist && !submitted ? (
          <Card style={{ padding: spacing[14] }}>
            <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase' }}>
              Checklist ({checklist.plane})
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {checklist.items.map((it) => (
                <li key={it.id} style={{ marginBottom: spacing[12] }}>
                  <p style={{ margin: `0 0 ${spacing[6]}px`, fontSize: 13 }}>{it.text}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: spacing[8] }}>
                    {[
                      { v: 1, l: 'Needs work' },
                      { v: 2, l: 'Getting there' },
                      { v: 3, l: 'Good' },
                    ].map(({ v, l }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setScore(it.id, v)}
                        style={{
                          minHeight: 44,
                          borderRadius: radii.button,
                          border: `1px solid ${shell.cardBorder}`,
                          background: scores[it.id] === v ? colors.primarySubtle : colors.surface1,
                          color: colors.text,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {v} — {l}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" style={{ marginTop: spacing[12] }} onClick={runSubmit}>
              Save assessment
            </Button>
          </Card>
        ) : null}

        {submitted ? (
          <Card style={{ padding: spacing[14] }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Overall: {submitted.overall}/{submitted.max}</h2>
            <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted }}>
              Three areas to prioritise (lowest scores):
            </p>
            <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 18, fontSize: 13 }}>
              {weakAreas.map((w) => (
                <li key={w.id}>{w.text}</li>
              ))}
            </ul>
            <p style={{ margin: `${spacing[14]}px 0 0`, fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase' }}>
              Exercises that support this pose
            </p>
            <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 18, fontSize: 13 }}>
              {poseLinks.slice(0, 8).map((link) => {
                const ex = getExerciseById(link.exerciseId);
                const name = ex?.name || link.exerciseId;
                return (
                  <li key={link.exerciseId}>
                    <strong>{name}</strong> — {link.reason}
                  </li>
                );
              })}
            </ul>
            <Button type="button" variant="outline" style={{ marginTop: spacing[14] }} onClick={resetFlow}>
              Assess another pose
            </Button>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
