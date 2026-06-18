import React from 'react';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ClientAssignmentCard from '@/components/clients/ClientAssignmentCard';
import ClientAnalyticsSnapshot from '@/components/clients/ClientAnalyticsSnapshot';
import ClientHealthCard from '@/components/clients/ClientHealthCard';
import HabitProgressCard from '@/components/habits/HabitProgressCard';
import HabitSnapshotCard from '@/components/habits/HabitSnapshotCard';
import MilestonesCard from '@/components/milestones/MilestonesCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import Button from '@/ui/Button';
import { ClipboardList } from 'lucide-react';
import { journeyStageLabel } from '@/lib/clientJourneyStages';
import { colors, spacing } from '@/ui/tokens';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';

export default function ClientOverviewTab(props) {
  const {
    hasSupabase,
    dashboardLoading,
    dashboardError,
    dashboardData,
    dashboardFetchedAt,
    timeAgo,
    handleOpenSetPhase,
    setPhaseSaving,
    clientId,
    lightHaptic,
    navigate,
    progressMetrics,
    progressMetricsLoading,
    activeBlockSummary,
    retentionRiskRow,
    retentionRiskLoading,
    lifecycleLoading,
    lifecycleRow,
    sectionGap: externalSectionGap,
    journeyStage,
  } = props;
  const tabGap = externalSectionGap ?? sectionGap;

  return (
    <>
      {hasSupabase && (
        <div style={{ marginBottom: tabGap }}>
          <p style={{ ...sectionLabel }}>Overview</p>
          <Card style={{ ...standardCard, padding: spacing[20] }}>
            <h3 className="atlas-card-title" style={{ marginBottom: spacing[12] }}>Master Dashboard</h3>
            {dashboardLoading && <SkeletonCard lines={4} />}
            {!dashboardLoading && dashboardError && (
              <p className="text-sm py-2" style={{ color: colors.destructive }}>{dashboardError}</p>
            )}
            {!dashboardLoading && !dashboardError && dashboardData != null && (
              <>
                {dashboardFetchedAt != null && (
                  <p className="text-[11px] mb-2" style={{ color: colors.muted }}>Updated {timeAgo(dashboardFetchedAt)}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Journey stage</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="m-0" style={{ color: colors.text }}>{journeyStageLabel(journeyStage)}</p>
                      {clientId ? (
                        <button
                          type="button"
                          className="text-xs font-semibold underline"
                          style={{ color: colors.primary, background: 'none', border: 'none', padding: 0 }}
                          onClick={() => { void lightHaptic(); navigate(`/clients/${clientId}/journey`); }}
                        >
                          Update stage →
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Phase</p>
                    <p style={{ color: colors.text }}>{dashboardData.phase ?? dashboardData.phase_type ?? 'No phase set'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Week</p>
                    <p style={{ color: colors.text }}>
                      {dashboardData.current_week != null && dashboardData.total_weeks != null
                        ? `Week ${dashboardData.current_week} of ${dashboardData.total_weeks}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Training compliance</p>
                    <p style={{ color: colors.text }}>{dashboardData.training_adherence != null ? `${dashboardData.training_adherence}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Nutrition compliance</p>
                    <p style={{ color: colors.text }}>{dashboardData.nutrition_adherence != null ? `${dashboardData.nutrition_adherence}%` : '—'}</p>
                  </div>
                </div>
              </>
            )}
            {!dashboardLoading && !dashboardError && (dashboardData == null || !dashboardData.phase) && (
              <EmptyState
                title="No phase set"
                description="Set a training phase to track block and compliance."
                icon={ClipboardList}
                actionLabel="Change phase"
                onAction={handleOpenSetPhase}
              />
            )}
            {!dashboardLoading && (dashboardData != null && dashboardData.phase) && (
              <Button variant="primary" size="sm" onClick={handleOpenSetPhase} disabled={setPhaseSaving} style={{ marginTop: spacing[12] }}>
                {setPhaseSaving ? 'Saving…' : 'Change phase'}
              </Button>
            )}
          </Card>
          {clientId && hasSupabase && <ClientAssignmentCard clientId={clientId} />}
          {clientId && (
            <div style={{ marginBottom: spacing[16] }}>
              <HabitSnapshotCard clientId={clientId} />
              <HabitProgressCard clientId={clientId} />
            </div>
          )}
          {clientId && (
            <div style={{ marginBottom: spacing[16] }}>
              <MilestonesCard clientId={clientId} title="Milestones" showEmptyState={true} variant="coach" />
            </div>
          )}
        </div>
      )}

      {hasSupabase && clientId && (
        <div style={{ marginBottom: tabGap }}>
          <ClientAnalyticsSnapshot
            metrics={progressMetrics}
            loading={progressMetricsLoading}
            clientId={clientId}
            onAdjustProgram={activeBlockSummary?.blockId
              ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); }
              : async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
          />
          <div style={{ marginTop: spacing[10] }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await lightHaptic();
                navigate(`/prep-comparison?clientId=${encodeURIComponent(clientId)}&source=client-detail`);
              }}
            >
              View comparison
            </Button>
          </div>
        </div>
      )}

      {hasSupabase && clientId && (
        <div style={{ marginBottom: tabGap }}>
          <ClientHealthCard
            clientId={clientId}
            lifecycleStage={lifecycleRow?.effective_stage ?? lifecycleRow?.lifecycle_stage}
            riskBand={retentionRiskRow?.risk_band}
            riskScore={retentionRiskRow?.risk_score}
            reasons={retentionRiskRow?.reasons ?? []}
            loading={retentionRiskLoading || lifecycleLoading}
          />
        </div>
      )}
    </>
  );
}
