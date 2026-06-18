import React, { useEffect, useState } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

export default function PrepPosingTargetCard({ clientId }) {
  const { user } = useAuth();
  const [prepId, setPrepId] = useState(null);
  const [target, setTarget] = useState(90);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasSupabase || !clientId || !user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb
        .from('contest_preps')
        .select('id, posing_target_weekly_minutes')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      if (data?.id) {
        setPrepId(data.id);
        setTarget(Number(data.posing_target_weekly_minutes) > 0 ? Number(data.posing_target_weekly_minutes) : 90);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId, user?.id]);

  const save = async () => {
    if (!prepId || !hasSupabase) return;
    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    try {
      const v = Math.max(0, Math.min(600, Math.round(Number(target) || 0)));
      await sb.from('contest_preps').update({ posing_target_weekly_minutes: v }).eq('id', prepId);
      setTarget(v);
    } finally {
      setSaving(false);
    }
  };

  if (!clientId || loading || !prepId) return null;

  return (
    <Card style={{ padding: spacing[14], marginBottom: spacing[12] }}>
      <p className="text-xs font-semibold uppercase tracking-wide m-0" style={{ color: colors.muted }}>Posing target</p>
      <p className="text-sm m-0 mt-1" style={{ color: colors.text }}>
        Target posing practice per week (minutes)
      </p>
      <div className="flex gap-2 items-center mt-3">
        <input
          type="number"
          min={0}
          max={600}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: colors.border, background: colors.surface2, color: colors.text }}
        />
        <Button type="button" disabled={saving} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </Card>
  );
}
