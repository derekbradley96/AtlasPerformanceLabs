import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isClient, isPersonal } from '@/lib/roles';
import { hasSupabase } from '@/lib/supabaseClient';
import { calculateReadinessScore } from '@/lib/readinessEngine';
import { getAdjustmentSummary } from '@/lib/adaptiveTrainingEngine';
import { createReadinessCheckinWithRecommendation, getLocalDateKey } from '@/lib/readinessCheckinApi';
import { colors, spacing, touchTargetMin, radii } from '@/ui/tokens';
import Card from '@/ui/Card';
import TopBar from '@/components/ui/TopBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SCALE = [1, 2, 3, 4, 5];

function ScaleRow({ label, value, onChange, hints }) {
  return (
    <Card style={{ padding: spacing[12] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12], marginBottom: spacing[8] }}>
        <p style={{ margin: 0, fontSize: 14, color: colors.text, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{value ? `Selected: ${value}` : 'Tap a score'}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: spacing[8] }}>
        {SCALE.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                minHeight: touchTargetMin,
                borderRadius: 10,
                border: `1px solid ${active ? colors.primary : colors.border}`,
                background: active ? colors.primarySubtle : colors.surface2,
                color: active ? colors.primary : colors.text,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {hints ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing[6], fontSize: 11, color: colors.muted }}>
          <span>{hints.left}</span>
          <span>{hints.right}</span>
        </div>
      ) : null}
    </Card>
  );
}

export default function ReadinessCheckinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const returnTo = searchParams.get('return') || '';

  const [sleep, setSleep] = useState(0);
  const [fatigue, setFatigue] = useState(0);
  const [soreness, setSoreness] = useState(0);
  const [stress, setStress] = useState(0);
  const [motivation, setMotivation] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allowed = isClient(effectiveRole) || isPersonal(effectiveRole);
  const canSubmit = sleep && fatigue && soreness && stress && motivation && !submitting;

  const preview = useMemo(() => {
    if (!sleep || !fatigue || !soreness || !stress || !motivation) return null;
    return calculateReadinessScore({
      sleep_score: sleep,
      fatigue_score: fatigue,
      soreness_score: soreness,
      stress_score: stress,
      motivation_score: motivation,
    });
  }, [sleep, fatigue, soreness, stress, motivation]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !user?.id || !allowed) return;
    if (!hasSupabase) {
      toast.error('Readiness check-in requires Supabase connection.');
      return;
    }

    setSubmitting(true);
    try {
      const scores = {
        sleep_score: sleep,
        fatigue_score: fatigue,
        soreness_score: soreness,
        stress_score: stress,
        motivation_score: motivation,
      };

      const { recommendation, recommendationInserted } = await createReadinessCheckinWithRecommendation({
        userId: user.id,
        effectiveRole,
        scores,
        notes,
      });

      if (recommendationInserted && recommendation?.recommendation_type !== 'keep_as_is') {
        toast.success(getAdjustmentSummary(recommendation), { duration: 4500 });
      } else {
        toast.success('Readiness check-in saved.');
      }

      const day = getLocalDateKey();
      queryClient.invalidateQueries({ queryKey: ['readiness-checkin-today'] });
      queryClient.invalidateQueries({ queryKey: ['readiness-checkin-today', user.id, day] });

      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        navigate(returnTo, { replace: true });
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error(err?.cause || err);
      toast.error(err?.message || 'Could not save readiness check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Readiness Check-In" onBack={() => navigate(-1)} />
        <div style={{ padding: spacing[16] }}>
          <p style={{ color: colors.muted }}>This check-in is available for client and personal accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Readiness Check-In" onBack={() => navigate(-1)} />
      <form onSubmit={onSubmit} style={{ padding: spacing[16], paddingBottom: spacing[32], display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
          Quick pre-training check: tap one score for each item.
        </p>

        <ScaleRow label="Sleep" value={sleep} onChange={setSleep} hints={{ left: 'Poor', right: 'Great' }} />
        <ScaleRow label="Fatigue" value={fatigue} onChange={setFatigue} hints={{ left: 'Low fatigue', right: 'High fatigue' }} />
        <ScaleRow label="Soreness" value={soreness} onChange={setSoreness} hints={{ left: 'None', right: 'Severe' }} />
        <ScaleRow label="Stress" value={stress} onChange={setStress} hints={{ left: 'Low', right: 'High' }} />
        <ScaleRow label="Motivation" value={motivation} onChange={setMotivation} hints={{ left: 'Low', right: 'High' }} />

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

        {preview ? (
          <Card style={{ padding: spacing[12], background: colors.surface1 }}>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Readiness preview</p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 18, fontWeight: 700, color: colors.text }}>
              {preview.readiness_score} · {preview.readiness_status.replace(/_/g, ' ')}
            </p>
          </Card>
        ) : null}

        <Button
          type="submit"
          disabled={!canSubmit}
          style={{ minHeight: touchTargetMin + 4 }}
        >
          {submitting ? 'Saving…' : 'Save readiness check-in'}
        </Button>
      </form>
    </div>
  );
}
