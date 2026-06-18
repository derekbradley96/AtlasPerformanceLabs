import React from 'react';
import { ClipboardList } from 'lucide-react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import SkeletonCard from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import ClientAnalyticsSnapshot from '@/components/clients/ClientAnalyticsSnapshot';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, sectionGap, standardCard } from '@/ui/pageLayout';

/**
 * Progress + prescribed targets + today’s logging snapshot + active training block summary.
 * Data lives in ClientDetail queries; this module is presentation + navigation only.
 */
export default function ClientDetailProgressPlanToday({
  sinceCheckinChips,
  hasSupabase,
  clientId,
  progressMetrics,
  progressMetricsLoading,
  onAdjustProgramFromSnapshot,
  nutritionLatestWeek,
  osPrepRow,
  onEditMacrosAndTargets,
  clientDailySnapshotLoading,
  clientTodayLines,
  onOpenNutritionPlan,
  activeBlockSummary,
  dashboardData,
  clientPlanForDetail,
  onAdjustProgramBlock,
  onViewProgram,
  onAssignProgram,
}) {
  return (
    <>
      {sinceCheckinChips.length > 0 && (
        <>
          <p style={{ ...sectionLabel }}>Since last check-in</p>
          <Card style={{ ...standardCard, padding: spacing[14], marginBottom: sectionGap }}>
            <div className="flex flex-wrap gap-2">
              {sinceCheckinChips.map((chip) => (
                <span
                  key={chip.id}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: colors.surface2,
                    border: `1px solid ${colors.border}`,
                    color:
                      chip.tone === 'down'
                        ? colors.warning
                        : chip.tone === 'up'
                          ? colors.success
                          : colors.text,
                  }}
                >
                  <span style={{ color: colors.muted }}>{chip.label}: </span>
                  {chip.text}
                </span>
              ))}
            </div>
          </Card>
        </>
      )}

      <p style={{ ...sectionLabel }}>Progress snapshot</p>
      {hasSupabase && clientId && (
        <div style={{ marginBottom: sectionGap }}>
          <ClientAnalyticsSnapshot
            metrics={progressMetrics}
            loading={progressMetricsLoading}
            clientId={clientId}
            onAdjustProgram={onAdjustProgramFromSnapshot}
          />
        </div>
      )}

      <p style={{ ...sectionLabel }}>Current plan targets</p>
      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Macros</p>
            <p style={{ color: colors.text }}>
              {nutritionLatestWeek
                ? [
                    nutritionLatestWeek.calories != null ? `${nutritionLatestWeek.calories} cal` : null,
                    nutritionLatestWeek.protein != null ? `P ${nutritionLatestWeek.protein}g` : null,
                    nutritionLatestWeek.carbs != null ? `C ${nutritionLatestWeek.carbs}g` : null,
                    nutritionLatestWeek.fats != null ? `F ${nutritionLatestWeek.fats}g` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Water target</p>
            <p style={{ color: colors.text }}>{osPrepRow?.water_target_ml != null ? `${osPrepRow.water_target_ml} ml` : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Sodium target</p>
            <p style={{ color: colors.text }}>{osPrepRow?.sodium_target_mg != null ? `${osPrepRow.sodium_target_mg} mg` : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Day type</p>
            <p style={{ color: colors.text }}>{osPrepRow?.day_type || '—'}</p>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Precision notes</p>
            <p style={{ color: colors.text }}>{osPrepRow?.coach_precision_notes || '—'}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" style={{ marginTop: spacing[12] }} onClick={onEditMacrosAndTargets}>
          Edit macros & targets
        </Button>
      </Card>

      <p style={{ ...sectionLabel }}>Today snapshot</p>
      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
        {clientDailySnapshotLoading ? (
          <SkeletonCard lines={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Workout</p>
                <p style={{ color: colors.text }}>{clientTodayLines?.workout ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Steps</p>
                <p style={{ color: colors.text }}>{clientTodayLines?.steps ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Food</p>
                <p style={{ color: colors.text }}>{clientTodayLines?.food ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Water / sodium</p>
                <p style={{ color: colors.text }}>{clientTodayLines?.water ?? '—'}</p>
              </div>
            </div>
            {clientId ? (
              <Button variant="ghost" size="sm" className="h-auto p-0 mt-3 -ml-1" onClick={onOpenNutritionPlan}>
                Open nutrition plan
              </Button>
            ) : null}
            <p className="text-[10px] m-0 mt-2" style={{ color: colors.muted }}>
              Day boundary uses your device date. Client may be in another timezone.
            </p>
          </>
        )}
      </Card>

      <p style={{ ...sectionLabel }}>Active program</p>
      <div style={{ marginBottom: sectionGap }}>
        {activeBlockSummary?.title || clientPlanForDetail?.name ? (
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <p className="text-[15px] font-medium" style={{ color: colors.text, marginBottom: spacing[8] }}>
              {activeBlockSummary?.title ?? clientPlanForDetail?.name ?? 'Current program'}
            </p>
            <p className="text-[13px]" style={{ color: colors.muted, marginBottom: spacing[12] }}>
              {dashboardData?.current_week != null && dashboardData?.total_weeks != null
                ? `Week ${dashboardData.current_week} of ${dashboardData.total_weeks}`
                : 'No week set'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={onAdjustProgramBlock}>
                Adjust program
              </Button>
              <Button variant="secondary" size="sm" onClick={onViewProgram}>
                View program
              </Button>
            </div>
          </Card>
        ) : (
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <EmptyState
              title="No program assigned"
              description="Assign or create a program to get started."
              icon={ClipboardList}
              actionLabel="Assign program"
              onAction={onAssignProgram}
            />
          </Card>
        )}
      </div>
    </>
  );
}
