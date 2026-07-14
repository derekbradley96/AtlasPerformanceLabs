import React, { useMemo, useState } from 'react';
import { getPosesForDivision } from '@/lib/compPrep/poseSets';
import { logPosingSession } from '@/lib/posingPractice';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors } from '@/ui/tokens';
import Button from '@/ui/Button';
import BottomSheet from '@/components/ui/BottomSheet';

const DURATIONS = [5, 10, 15, 20, 30];

export default function PosingLogSheet({
  open,
  onClose,
  clientId,
  profileId,
  division,
  onLogged,
}) {
  const [minutes, setMinutes] = useState(15);
  const [selectedPoses, setSelectedPoses] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const poseOptions = useMemo(() => {
    try {
      const list = getPosesForDivision(division || 'Bodybuilding') || [];
      return list.slice(0, 14).map((p) => ({ id: p.id, label: p.name }));
    } catch {
      return [];
    }
  }, [division]);

  // No `if (!open) return null` — BottomSheet owns open/closed so vaul can play
  // its slide-out animation instead of the sheet vanishing on close.
  const togglePose = (id) => {
    setSelectedPoses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!hasSupabase || !clientId || !profileId) return;
    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    try {
      const poses = [...selectedPoses];
      const { error } = await logPosingSession({
        supabase: sb,
        clientId,
        profileId,
        durationMinutes: minutes,
        posespracticed: poses,
        notes: null,
      });
      if (error) throw error;
      onLogged?.();
      onClose?.();
      setSelectedPoses(new Set());
    } catch {
      /* toast optional */
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={() => onClose?.()} title="Log posing session">
      <p className="text-xs m-0" style={{ color: colors.muted }}>Duration</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className="rounded-full px-3 py-2 text-xs font-semibold"
              style={{
                border: `1px solid ${minutes === m ? colors.primary : colors.border}`,
                background: minutes === m ? colors.primarySubtle : colors.surface1,
                color: colors.text,
              }}
            >
              {m} min
            </button>
          ))}
        </div>
        <p className="text-xs mt-4 m-0" style={{ color: colors.muted }}>Poses practiced</p>
        <div className="flex flex-wrap gap-2 mt-2 max-h-40 overflow-y-auto">
          {poseOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePose(p.id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                border: `1px solid ${selectedPoses.has(p.id) ? colors.success : colors.border}`,
                background: selectedPoses.has(p.id) ? colors.successSubtle : colors.surface1,
                color: colors.text,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      <Button className="w-full mt-4" disabled={saving} onClick={() => void submit()}>
        {saving ? 'Saving…' : 'Log posing session'}
      </Button>
      <Button variant="secondary" className="w-full mt-2" type="button" onClick={() => onClose?.()}>
        Cancel
      </Button>
    </BottomSheet>
  );
}
