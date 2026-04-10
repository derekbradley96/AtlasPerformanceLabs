/**
 * Personal Basic: short post-workout reflection → fatigue → next-session adjustment (stored on profile).
 */
import React, { useState } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { computeMergedPostWorkoutAdjustment, savePersonalBasicNextWorkoutAdjustment } from '@/lib/personalBasicAdjustment';
import { fetchPersonalAdaptationContext } from '@/lib/personalAdaptationContext';
import { postWorkoutReinforcementLine } from '@/lib/personalAdaptationLayer';
import { fetchMergedPersonalNutritionTargets, getPersonalProteinProgressPercent } from '@/lib/personalNutritionProfile';
import { getLocalDateKey } from '@/lib/readinessCheckinApi';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function LikertRow({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: spacing[14] }}>
      <div className="flex justify-between items-baseline" style={{ marginBottom: spacing[6] }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{label}</span>
        <span style={{ fontSize: 12, color: colors.muted }}>{value}/5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: colors.primary }}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value}
      />
      <div className="flex justify-between" style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

export default function PersonalBasicPostWorkoutCheckIn({
  profileId,
  workoutSessionId,
  onSaved,
  adaptationTier = 'basic',
}) {
  const [energy, setEnergy] = useState(3);
  const [recovery, setRecovery] = useState(3);
  const [performance, setPerformance] = useState(3);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!profileId || busy) return;
    if (!hasSupabase) {
      toast.error('Connect to save');
      return;
    }
    const supabase = getSupabase();
    setBusy(true);
    try {
      const { error: insErr } = await supabase.from('personal_checkins').insert({
        user_id: profileId,
        energy,
        recovery,
        performance,
        workout_session_id: workoutSessionId || null,
      });
      if (insErr) throw insErr;

      const ctx = await fetchPersonalAdaptationContext(profileId);
      const tier = adaptationTier === 'enhanced' ? 'enhanced' : 'basic';
      const adj = computeMergedPostWorkoutAdjustment({
        ...ctx,
        tier,
        energy,
        recovery,
        performance,
      });
      if (adj) {
        await savePersonalBasicNextWorkoutAdjustment(profileId, {
          ...adj,
          sets_delta: adj.sets_delta,
          message_key: adj.message_key,
          tier,
        });
      }

      const mergedTargets = await fetchMergedPersonalNutritionTargets(profileId);
      const proteinPct = getPersonalProteinProgressPercent(profileId, getLocalDateKey(), mergedTargets);
      const reinforce = postWorkoutReinforcementLine({
        messageKey: adj?.message_key,
        proteinPct,
      });
      if (reinforce) {
        toast.message(reinforce);
      }

      setSaved(true);
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Could not save check-in');
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: colors.muted, textAlign: 'center' }}>
        Thanks — your next session will reflect this.
      </p>
    );
  }

  return (
    <div
      style={{
        textAlign: 'left',
        borderRadius: radii.card,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
        padding: spacing[14],
        marginBottom: spacing[16],
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 0.5, marginBottom: spacing[10] }}>
        Quick reflection
      </p>
      <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
        How did this session feel? This helps tune your next workout automatically.
      </p>
      <LikertRow label="Energy" value={energy} onChange={setEnergy} />
      <LikertRow label="Recovery" value={recovery} onChange={setRecovery} />
      <LikertRow label="Performance" value={performance} onChange={setPerformance} />
      <button
        type="button"
        disabled={busy}
        onClick={handleSave}
        style={{
          width: '100%',
          minHeight: touchTargetMin,
          borderRadius: radii.button,
          border: 'none',
          background: colors.primary,
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.85 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {busy ? <Loader2 className="animate-spin" size={18} /> : null}
        Save reflection
      </button>
    </div>
  );
}
