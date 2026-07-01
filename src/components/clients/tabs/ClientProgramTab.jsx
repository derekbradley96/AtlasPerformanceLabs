import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ClientProgramPanel from '@/components/clients/ClientProgramPanel';
import { ClipboardList, History, ChevronDown, ChevronUp } from 'lucide-react';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { spacing, colors, radii } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

export default function ClientProgramTab(props) {
  const {
    activeBlockSummary,
    clientPlanForDetail,
    dashboardData,
    clientId,
    clientUserId,
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
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const { data: personalBlocks = [], isLoading: personalBlocksLoading } = useQuery({
    queryKey: ['client-personal-blocks', clientUserId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !clientUserId) return [];
      const { data } = await supabase
        .from('program_blocks')
        .select('id, title, total_weeks, created_at, coach_notes')
        .eq('owner_profile_id', clientUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(clientUserId && hasSupabase),
    staleTime: 300000,
  });
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

      {(personalBlocksLoading || personalBlocks.length > 0) && (
        <div style={{ marginBottom: tabGap }}>
          <button
            type="button"
            onClick={() => setHistoryExpanded((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[6],
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: spacing[12],
              width: '100%',
            }}
          >
            <History size={14} color={colors.primary} />
            <span style={{ ...sectionLabel, margin: 0, flex: 1, textAlign: 'left' }}>Pre-coaching training history</span>
            {historyExpanded ? <ChevronUp size={14} color={colors.muted} /> : <ChevronDown size={14} color={colors.muted} />}
          </button>
          {historyExpanded && (
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              <p style={{ fontSize: 11, color: colors.muted, marginBottom: spacing[12], marginTop: 0 }}>
                Programs this client built and tracked before joining your roster.
              </p>
              {personalBlocksLoading ? (
                <SkeletonCard lines={3} />
              ) : personalBlocks.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>No self-built programs found.</p>
              ) : (
                personalBlocks.map((block, i) => (
                  <div
                    key={block.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing[8]}px 0`,
                      borderBottom: i < personalBlocks.length - 1 ? `0.5px solid ${colors.border}` : 'none',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, color: colors.text, margin: 0, fontWeight: 500 }}>
                        {block.title || 'Untitled program'}
                      </p>
                      {block.total_weeks ? (
                        <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>{block.total_weeks} weeks</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/program-builder?blockId=${block.id}`)}
                      style={{
                        fontSize: 11,
                        color: colors.primary,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: `${spacing[4]}px ${spacing[8]}px`,
                      }}
                    >
                      View →
                    </button>
                  </div>
                ))
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
