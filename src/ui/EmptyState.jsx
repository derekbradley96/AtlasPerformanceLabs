/**
 * Re-export standardised EmptyState. Accepts subtext (maps to description) for backward compatibility.
 */
import React from 'react';
import EmptyStateStandard from '@/components/ui/EmptyState';

export default function EmptyState({ subtext, description, ...rest }) {
  return (
    <EmptyStateStandard
      description={description ?? subtext}
      {...rest}
    />
  );
}
