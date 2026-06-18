import React from 'react';
import Button from '@/ui/Button';
import { touchTargetMin } from '@/ui/tokens';

/**
 * Program / prep / cadence shortcuts for the OS action rail.
 * Parent owns navigation targets and haptics.
 */
export default function ClientDetailOsQuickActions({
  onAdjustMacros,
  onAdjustTraining,
  onAdjustPeakTools,
  onAdjustWaterSodium,
  onFocusCoachNotes,
  onRequestCheckin,
  onAssignProgram,
}) {
  return (
    <>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onAdjustMacros}>
        Adjust macros
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onAdjustTraining}>
        Adjust training
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onAdjustPeakTools}>
        Adjust cardio / peak tools
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onAdjustWaterSodium}>
        Adjust water & sodium
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onFocusCoachNotes}>
        Add note (coach notes)
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onRequestCheckin}>
        Request check-in
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={onAssignProgram}>
        Assign program
      </Button>
    </>
  );
}
