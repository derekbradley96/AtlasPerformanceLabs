import React from 'react';

const CAPTIONS = {
  'coach-home': 'Your daily coaching command centre',
  workout: 'Per-set targets. Your actuals beside them.',
  barcode: 'Scan any barcode — free, always.',
  nutrition: 'Interpreted macros, not raw numbers.',
  posing: 'Competition prep built in.',
  progress: 'Before and after, with context.',
};

export default function ScreenshotCaption() {
  const params = new URLSearchParams(window.location.search);
  const showCaption = params.get('caption');
  const screenKey = params.get('screen');

  if (!showCaption) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: 'center',
        padding: '12px 24px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        fontSize: 18,
        fontWeight: 700,
        color: '#fff',
        zIndex: 9999,
      }}
    >
      {CAPTIONS[screenKey] || ''}
    </div>
  );
}
