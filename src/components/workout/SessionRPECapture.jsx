import React, { useMemo, useState } from 'react';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import Card from '@/ui/Card';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';

const RPE_LABELS = {
  1: 'Very easy - felt like a warm-up',
  2: 'Easy - lots left in the tank',
  3: 'Light - could do much more',
  4: 'Moderate - could have done more',
  5: 'Moderate-hard - felt challenging',
  6: 'Hard - well within limits',
  7: 'Hard - pushed close to limits',
  8: 'Very hard - gave close to max effort',
  9: 'Near max - almost nothing left',
  10: 'Max effort - completely empty',
};

export default function SessionRPECapture({ onSkip, onSubmit, saving = false }) {
  const [selectedRpe, setSelectedRpe] = useState(null);
  const helperText = useMemo(() => (selectedRpe !== null ? RPE_LABELS[selectedRpe] || '' : ''), [selectedRpe]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: spacing[16], background: colors.bg }}>
      <Card style={{ width: '100%', maxWidth: 560, padding: spacing[16], border: `1px solid ${colors.border}` }}>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: colors.text }}>Session complete 🎯</p>
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.muted }}>One last question before your summary:</p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 16, color: colors.text }}>Overall, how hard was that session?</p>

        <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
          {[1, 2].map((row) => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: spacing[8] }}>
              {Array.from({ length: 5 }, (_, idx) => idx + 1 + (row - 1) * 5).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setSelectedRpe(value);
                  }}
                  style={{
                    minWidth: 56,
                    minHeight: 56,
                    borderRadius: 999,
                    border: `1px solid ${selectedRpe === value ? colors.primary : colors.border}`,
                    background: selectedRpe === value ? colors.primary : colors.surface2,
                    color: selectedRpe === value ? '#fff' : colors.text,
                    fontWeight: 700,
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          ))}
        </div>
        {selectedRpe !== null && (
          <p style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing[8] }}>
            {helperText}
          </p>
        )}
        <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
          <button
            type="button"
            onClick={() => {
              if (selectedRpe == null) return;
              hapticSuccess();
              onSubmit?.(selectedRpe);
            }}
            disabled={selectedRpe == null || saving}
            style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, opacity: selectedRpe == null || saving ? 0.6 : 1 }}
          >
            Done - view summary
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.muted, fontWeight: 600 }}
          >
            Skip
          </button>
        </div>
      </Card>
    </div>
  );
}
