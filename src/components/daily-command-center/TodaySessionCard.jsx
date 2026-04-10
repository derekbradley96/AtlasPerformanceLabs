import React from 'react';
import PrimaryActionCard from '@/components/daily-command-center/PrimaryActionCard';

export default function TodaySessionCard({
  title,
  body,
  primaryAction,
  secondaryAction = null,
  secondaryActions = null,
  icon = null,
  helperText = '',
}) {
  return (
    <div>
      <PrimaryActionCard
        title={title}
        body={body}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        secondaryActions={secondaryActions}
        icon={icon}
      />
      {helperText ? (
        <p style={{ margin: '8px 2px 0', fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
