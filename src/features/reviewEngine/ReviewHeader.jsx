import React from 'react';
import Card from '@/ui/Card';
import { colors } from '@/ui/tokens';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * @param {{ clientName: string, typeLabel: string, dateOrSubtitle: string }} props
 */
export default function ReviewHeader({ clientName, typeLabel, dateOrSubtitle }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{clientName || 'Client'}</p>
      <p className="text-[13px] mt-1" style={{ color: colors.muted }}>{typeLabel} · {dateOrSubtitle}</p>
    </Card>
  );
}

export { formatDate };
