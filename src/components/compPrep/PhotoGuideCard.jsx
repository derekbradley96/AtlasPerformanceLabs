import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Camera } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const PHASE_ADJUSTMENTS = {
  off_season: 'Use consistent lighting and angle; focus on repeatability for later comparison.',
  prep: 'Same time of day each week; avoid dramatic lighting changes so progress is clear.',
  peak_week: 'If taking final reference shots, use the same setup as earlier prep for before/after.',
  show_day: 'Warm-up and pump before photos; use natural stage-like lighting if possible.',
};

export default function PhotoGuideCard({ phase }) {
  const [expanded, setExpanded] = useState(false);
  const phaseKey = (phase || '').toLowerCase().replace(/\s/g, '');
  const phaseTip = PHASE_ADJUSTMENTS[phaseKey] ?? PHASE_ADJUSTMENTS.prep;

  return (
    <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: colors.text }}>
          <Camera size={18} />
          How to take your check-in photos
        </h2>
        {expanded ? <ChevronUp size={20} style={{ color: colors.muted }} /> : <ChevronDown size={20} style={{ color: colors.muted }} />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 text-sm" style={{ color: colors.muted }}>
          <div>
            <strong className="text-white">Lighting</strong>
            <p>Use even, front-facing light (e.g. a window or soft lamp in front). Avoid harsh shadows and backlight. Same lighting each week for accurate comparison.</p>
          </div>
          <div>
            <strong className="text-white">Camera height</strong>
            <p>Phone or camera at chest to waist height, level with the body. Slightly above can shorten legs; too low distorts proportions.</p>
          </div>
          <div>
            <strong className="text-white">Distance</strong>
            <p>Far enough to capture full body (head to feet) without distortion. About 2–3 metres works for full-body shots.</p>
          </div>
          <div>
            <strong className="text-white">Required angles</strong>
            <p>Front, back, and both sides. Same order every time so weekly comparisons line up.</p>
          </div>
          <div>
            <strong className="text-white">Phase-specific</strong>
            <p>{phaseTip}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
