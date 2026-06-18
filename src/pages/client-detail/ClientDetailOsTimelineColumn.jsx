import React from 'react';
import Card from '@/ui/Card';
import SkeletonCard from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';
import { timelineDateLabel, timelineIconForBadge } from '@/pages/client-detail/clientDetailUtils';

/**
 * Left column OS timeline — merged check-in + performance events.
 * Data: parent merges `mergeClientOsTimeline` before passing `rows`.
 */
export default function ClientDetailOsTimelineColumn({ timelineLoading, mergedOsTimeline, standardCard }) {
  if (timelineLoading) {
    return (
      <div className="space-y-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (!mergedOsTimeline.length) {
    return (
      <EmptyState
        title="No events yet"
        description="Check-ins and activity will show here as the client engages."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2" id="os-timeline">
      {mergedOsTimeline.map((row) => {
        const createdAt = row.created_at;
        const label = timelineDateLabel(createdAt, new Date());
        const Icon = timelineIconForBadge(row.badge);
        return (
          <Card
            key={row.id}
            style={{
              ...standardCard,
              padding: spacing[12],
              display: 'flex',
              gap: spacing[12],
              alignItems: 'flex-start',
            }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.surfaceElevated, color: colors.primary }}
            >
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                  {row.title}
                </p>
                <span className="text-xs" style={{ color: colors.muted }}>
                  {label}
                </span>
              </div>
              {row.description ? (
                <p className="text-xs" style={{ color: colors.muted }}>
                  {row.description}
                </p>
              ) : null}
              <span
                className="inline-flex mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: colors.surfaceElevated,
                  color: colors.muted,
                }}
              >
                {row.badge}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
