import React from 'react';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ClientProgramPanel from '@/components/clients/ClientProgramPanel';
import { ClipboardList } from 'lucide-react';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { spacing } from '@/ui/tokens';

export default function ClientProgramTab(props) {
  const {
    activeBlockSummary,
    clientPlanForDetail,
    dashboardData,
    clientId,
    navigate,
    lightHaptic,
    programsList,
    assignmentMeta,
    hasNewerVersion,
    latestVersion,
    changeLog,
    formatShortDate,
    safeFormatDate,
    nutritionLatestWeek,
    nutritionWeeks,
    nutritionLoading,
    nutritionError,
    openAdjustWeek,
    loadNutrition,
    setAssignSheetOpen,
    setExportSheetOpen,
    authUser,
    trainerId,
    assignProgramToClient,
    addProgramChangeLog,
    logAuditEvent,
    clientSectionGap,
  } = props;
  const tabGap = clientSectionGap ?? sectionGap;
  return (
    <>
      <p style={{ ...sectionLabel }}>Active program</p>
      <div style={{ marginBottom: tabGap }}>
        {activeBlockSummary?.title || clientPlanForDetail?.name ? (
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <p className="text-[15px] font-medium">{activeBlockSummary?.title ?? clientPlanForDetail?.name ?? 'Current program'}</p>
            <p className="text-[13px]">{dashboardData?.current_week != null && dashboardData?.total_weeks != null ? `Week ${dashboardData.current_week} of ${dashboardData.total_weeks}` : 'No week set'}</p>
          </Card>
        ) : (
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <EmptyState
              title="No program assigned"
              description="Assign or create a program to get started."
              icon={ClipboardList}
              actionLabel="Assign program"
              onAction={async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
            />
          </Card>
        )}
      </div>

      <div id="os-program" style={{ marginBottom: tabGap }}>
        <ClientProgramPanel
          clientId={clientId}
          clientPlanForDetail={clientPlanForDetail}
          programsList={programsList}
          assignmentMeta={assignmentMeta}
          activeBlockSummary={activeBlockSummary}
          hasNewerVersion={hasNewerVersion}
          latestVersion={latestVersion}
          changeLog={changeLog}
          formatShortDate={formatShortDate}
          safeFormatDate={safeFormatDate}
          nutritionLatestWeek={nutritionLatestWeek}
          nutritionWeeks={nutritionWeeks}
          nutritionLoading={nutritionLoading}
          nutritionError={nutritionError}
          onAssignFromLibrary={() => setAssignSheetOpen(true)}
          onAssignProgram={async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${clientId}`); }}
          onViewProgram={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-viewer?clientId=${clientId}&blockId=${activeBlockSummary.blockId}`); } : undefined}
          onAdjustProgram={activeBlockSummary?.blockId ? async () => { await lightHaptic(); navigate(`/program-builder?clientId=${clientId}&blockId=${activeBlockSummary.blockId}&source=client_detail`); } : undefined}
          onCreateProgram={async () => { await lightHaptic(); navigate(`/programbuilder?clientId=${clientId}`); }}
          onOpenNutritionPlan={async () => { await lightHaptic(); if (clientId) navigate(`/clients/${clientId}/nutrition`); }}
          onAdjustWeek={openAdjustWeek}
          onRetryNutrition={loadNutrition}
          onExport={async () => { await lightHaptic(); setExportSheetOpen(true); }}
          onUpdateToday={async () => {
            const effectiveDate = new Date().toISOString().slice(0, 10);
            assignProgramToClient(clientId, latestVersion.id, effectiveDate);
            addProgramChangeLog({ clientId, programId: latestVersion.id, programName: latestVersion.name, effectiveDate, action: 'updated' });
            logAuditEvent({ actorUserId: authUser?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: latestVersion.id, action: 'program_updated', after: { clientId, programId: latestVersion.id, effectiveDate } });
            setAssignSheetOpen(false);
          }}
          onUpdateNextWeek={async () => {
            const nextMon = new Date();
            nextMon.setDate(nextMon.getDate() + ((1 + 7 - nextMon.getDay()) % 7));
            const effectiveDate = nextMon.toISOString().slice(0, 10);
            assignProgramToClient(clientId, latestVersion.id, effectiveDate);
            addProgramChangeLog({ clientId, programId: latestVersion.id, programName: latestVersion.name, effectiveDate, action: 'updated_next_week' });
            logAuditEvent({ actorUserId: authUser?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: latestVersion.id, action: 'program_updated', after: { clientId, programId: latestVersion.id, effectiveDate } });
            setAssignSheetOpen(false);
          }}
          lightHaptic={lightHaptic}
        />
      </div>
    </>
  );
}
