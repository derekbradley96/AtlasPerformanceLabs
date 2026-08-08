import React, { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { calculatePrepProgress } from '@/lib/prepProgressTracking';
import { resolveViewerBodyweightUnit } from '@/lib/bodyMeasurementUnits';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function pickWeightKg(row) {
  if (!row || typeof row !== 'object') return null;
  const w = row.weight_kg ?? row.weight;
  const n = Number(w);
  return Number.isFinite(n) ? n : null;
}

export default function PrepCheckinReviewProgressCard({ checkin, contestPrep, clientRow }) {
  const ackSentRef = useRef(false);
  const { profile } = useAuth();
  const viewerWeightUnit = resolveViewerBodyweightUnit(profile);

  const currentWeight = useMemo(() => pickWeightKg(checkin), [checkin]);

  const progress = useMemo(() => {
    if (!contestPrep?.show_date || currentWeight == null) return null;
    const startWeight = contestPrep.prep_start_weight_kg != null
      ? Number(contestPrep.prep_start_weight_kg)
      : null;
    const targetWeight = contestPrep.target_stage_weight_kg != null
      ? Number(contestPrep.target_stage_weight_kg)
      : null;
    const startDate = contestPrep.prep_start_date
      || clientRow?.created_at?.slice(0, 10)
      || checkin?.week_start
      || null;
    if (startWeight == null || targetWeight == null || !startDate) return null;
    return calculatePrepProgress({
      startWeight,
      targetWeight,
      currentWeight,
      startDate,
      showDate: contestPrep.show_date,
      viewerWeightUnit,
    });
  }, [checkin, clientRow, contestPrep, currentWeight, viewerWeightUnit]);

  useEffect(() => {
    if (!progress || progress.status !== 'behind' || !checkin?.id || ackSentRef.current) return;
    if (!hasSupabase) return;
    const sb = getSupabase();
    if (!sb) return;
    ackSentRef.current = true;
    void sb.rpc('set_athlete_prep_pace_ack', {
      p_checkin_id: checkin.id,
      p_status: 'behind',
    });
  }, [checkin?.id, progress]);

  if (!progress) return null;

  const sw = Number(contestPrep?.prep_start_weight_kg);
  const tw = Number(contestPrep?.target_stage_weight_kg);
  const totalChange = tw - sw;
  const actualChange = currentWeight - sw;

  const timePct = Math.min(100, Math.max(0, (progress.weeksElapsed / progress.totalWeeks) * 100));
  const weightJourneyPct =
    Number.isFinite(totalChange) && Math.abs(totalChange) > 0.01
      ? Math.min(100, Math.max(0, (actualChange / totalChange) * 100))
      : timePct;

  const colour =
    progress.status === 'on_track' ? '#22C55E' :
      progress.status === 'ahead' ? '#3B82F6' :
        '#F59E0B';

  const labelExtra = progress.status === 'behind'
    ? ' — your coach has been notified and may adjust your plan'
    : '';

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
      <h3 className="font-semibold text-white mb-3">Your prep progress</h3>
      <div className="relative h-3 rounded-full bg-slate-700/80 overflow-hidden mb-4">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-slate-500/50"
          style={{ width: '100%' }}
          aria-hidden
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-slate-400"
          style={{ width: `${timePct}%` }}
        />
        <div
          className="absolute top-1/2 w-2 h-2 rounded-full bg-white border border-slate-900 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${timePct}%` }}
          title="Expected pace (calendar)"
        />
        <div
          className="absolute top-1/2 w-2 h-2 rounded-full border-2 border-white -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${weightJourneyPct}%`, background: colour }}
          title="Weight-change progress vs target"
        />
      </div>
      <p className="text-xs text-slate-400 mb-2">
        Grey bar: full prep timeline · Fill: weeks elapsed · White dot: expected pace · Coloured dot: your trajectory
      </p>
      <p className="text-sm font-semibold" style={{ color: colour }}>
        {progress.statusLabel}
        {labelExtra}
      </p>
    </div>
  );
}
