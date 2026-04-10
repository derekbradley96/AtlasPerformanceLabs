import React from 'react';
import SupportInsightCard from '@/components/daily-command-center/SupportInsightCard';

export default function InsightRow({ items = [], columns = '1fr', gap = 12, style = {} }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap, ...style }}>
      {items.map((item, index) => (
        <SupportInsightCard
          key={item.id || `${item.eyebrow || 'insight'}-${index}`}
          eyebrow={item.eyebrow}
          title={item.title}
          body={item.body}
          summary={item.summary}
          action={item.action}
          emphasis={item.emphasis}
        />
      ))}
    </div>
  );
}
