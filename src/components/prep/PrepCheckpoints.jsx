/**
 * Prep checkpoints: milestones (e.g. 12w, 8w, 4w, peak week) derived from show_date.
 * Uses contest_preps (show_date) or v_client_prep_header. Renders nothing when no active prep.
 */
import React, { useState, useEffect } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { Check, Circle } from 'lucide-react';

const MILESTONE_WEEKS = [12, 8, 4, 2];

async function fetchPrepCheckpoints(clientId) {
  if (!hasSupabase || !clientId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('v_client_prep_header')
      .select('show_date, days_out')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data?.show_date) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function getCheckpoints(showDate, daysOut) {
  if (!showDate) return [];
  const out = [];
  MILESTONE_WEEKS.forEach((w) => {
    const daysAtMilestone = w * 7;
    out.push({ label: `${w} weeks out`, weeks: w, daysAtMilestone, passed: daysOut != null && daysOut < daysAtMilestone });
  });
  out.push({ label: 'Peak week', weeks: 0, daysAtMilestone: 7, passed: daysOut != null && daysOut <= 7 });
  return out;
}

export default function PrepCheckpoints({ clientId }) {
  const [prep, setPrep] = useState(null);

  useEffect(() => {
    if (!clientId) {
      setPrep(null);
      return;
    }
    let cancelled = false;
    fetchPrepCheckpoints(clientId).then((row) => {
      if (!cancelled) setPrep(row);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  if (!prep?.show_date) return null;

  const daysOut = prep.days_out != null ? Number(prep.days_out) : null;
  const checkpoints = getCheckpoints(prep.show_date, daysOut);

  return (
    <Card style={{ marginBottom: spacing[12], padding: spacing[16] }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
        Prep milestones
      </p>
      <ul className="space-y-2">
        {checkpoints.map((cp) => (
          <li key={cp.label} className="flex items-center gap-2 text-sm">
            {cp.passed ? (
              <Check size={14} style={{ color: colors.success, flexShrink: 0 }} />
            ) : (
              <Circle size={14} style={{ color: colors.muted, flexShrink: 0 }} />
            )}
            <span style={{ color: cp.passed ? colors.muted : colors.text }}>{cp.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
