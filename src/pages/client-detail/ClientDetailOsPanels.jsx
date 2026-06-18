import React from 'react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { colors, spacing } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { timelineDateLabel, timelineIconForBadge } from '@/pages/client-detail/clientDetailUtils';

export function ClientDetailOsTimelineLeftContent({ timelineLoading, mergedOsTimeline }) {
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

export function ClientDetailOsPriorityRailContent({ topPriorityItem, actionRequiredItems, sectionLabel, cardRhythm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
      {topPriorityItem ? (
        <div>
          <p style={{ ...sectionLabel, marginBottom: cardRhythm.sectionTitleBottom }}>Best next action</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style={{ padding: spacing[10], borderRadius: 10, border: `1px solid ${colors.primary}`, background: colors.primarySubtle }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: colors.text, margin: 0 }}>{topPriorityItem.title}</p>
              <p className="text-xs truncate" style={{ color: colors.muted, margin: `${spacing[2]}px 0 0` }}>{topPriorityItem.body}</p>
            </div>
            <Button size="sm" variant="primary" onClick={topPriorityItem.action}>{topPriorityItem.cta}</Button>
          </div>
        </div>
      ) : null}
      {actionRequiredItems.length > 0 ? (
        <div>
          <p style={{ ...sectionLabel, marginBottom: cardRhythm.sectionTitleBottom }}>Action required</p>
          <div className="flex flex-col gap-2">
            {actionRequiredItems.map((item) => (
              <div key={item.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style={{ padding: spacing[10], borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1 }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: colors.text, margin: 0 }}>{item.title}</p>
                  <p className="text-xs truncate" style={{ color: colors.muted, margin: `${spacing[2]}px 0 0` }}>{item.body}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={item.action}>{item.cta}</Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ClientDetailOsTopQuickActionsContent({
  handleApplyOsAdjustment,
  activeBlockSummaryBlockId,
  clientId,
  navigate,
  focusSection,
  setMethodologySheetOpen,
  lightHaptic,
  touchTargetMin,
}) {
  return (
    <>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={handleApplyOsAdjustment}>
        Adjust macros
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-start"
        style={{ minHeight: touchTargetMin }}
        onClick={activeBlockSummaryBlockId
          ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummaryBlockId}&source=client_detail`); }
          : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
      >
        Adjust training
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); if (clientId) navigate(`/clients/${clientId}/peak-week-editor`); }}>
        Adjust cardio / peak tools
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={handleApplyOsAdjustment}>
        Adjust water & sodium
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={() => focusSection('messages')}>
        Add note (coach notes)
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); focusSection('checkins'); }}>
        Request check-in
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}>
        Assign program
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); setMethodologySheetOpen(true); }}>
        Deploy methodology
      </Button>
      <Button variant="secondary" size="sm" className="w-full justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); navigate('/results-stories'); }}>
        Create story
      </Button>
    </>
  );
}

export function ClientDetailOsIntelligenceRailExtraContent({ intelligenceItems, sectionLabel }) {
  return (
    <div>
      <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Coaching signals</p>
      {intelligenceItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {intelligenceItems.map((item) => (
            <div key={item.key} style={{ padding: spacing[10], borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface2 }}>
              <p className="text-sm font-semibold" style={{ color: colors.text, margin: 0 }}>{item.title}</p>
              <p className="text-xs" style={{ color: colors.muted, margin: `${spacing[4]}px 0 0` }}>{item.body}</p>
              {!!item.suggestedAction && (
                <p className="text-xs font-medium" style={{ color: colors.primary, margin: `${spacing[6]}px 0 0` }}>{item.suggestedAction}</p>
              )}
              <Button size="sm" variant="secondary" style={{ marginTop: spacing[8] }} onClick={item.action}>{item.cta}</Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs m-0" style={{ color: colors.muted }}>More signals appear after check-ins land.</p>
      )}
    </div>
  );
}
