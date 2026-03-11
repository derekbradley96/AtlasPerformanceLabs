/**
 * Client Detail – Program segment: program summary, actions, and Nutrition subsection.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';
import { UtensilsCrossed, Dumbbell } from 'lucide-react';

export default function ClientProgramPanel({
  clientId,
  clientPlanForDetail,
  programsList = [],
  assignmentMeta,
  activeBlockSummary,
  hasNewerVersion,
  latestVersion,
  changeLog = [],
  formatShortDate,
  safeFormatDate,
  nutritionLatestWeek,
  nutritionWeeks = [],
  nutritionLoading,
  nutritionError,
  onAssignFromLibrary,
  onAssignProgram,
  onViewProgram,
  onAdjustProgram,
  onCreateProgram,
  onOpenNutritionPlan,
  onAdjustWeek,
  onRetryNutrition,
  onExport,
  onUpdateToday,
  onUpdateNextWeek,
  lightHaptic,
}) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
      {/* Active program block summary (program_block_assignments + block) */}
      {activeBlockSummary ? (
        <Card style={{ padding: spacing[16] }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Active program</p>
          <p className="text-[15px] font-semibold" style={{ color: colors.text, marginBottom: 4 }}>{activeBlockSummary.programName}</p>
          <p className="text-xs mt-1" style={{ color: colors.muted }}>
            Start {formatShortDate ? formatShortDate(activeBlockSummary.startDate) : activeBlockSummary.startDate}
            {activeBlockSummary.totalWeeks != null && (
              <> · Week {activeBlockSummary.currentWeek} of {activeBlockSummary.totalWeeks}</>
            )}
            {activeBlockSummary.trainingDaysInWeek != null && activeBlockSummary.trainingDaysInWeek > 0 && (
              <> · {activeBlockSummary.trainingDaysInWeek} training day{activeBlockSummary.trainingDaysInWeek !== 1 ? 's' : ''} this week</>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {onViewProgram && (
              <Button variant="primary" onClick={async () => { await lightHaptic?.(); onViewProgram?.(); }}>View Program</Button>
            )}
            {onAdjustProgram && (
              <Button variant="secondary" onClick={async () => { await lightHaptic?.(); onAdjustProgram?.(); }}>Adjust Program</Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Legacy program summary (versioned plan) */}
          <Card style={{ padding: spacing[16] }}>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Client plan (versioned)</p>
            {clientPlanForDetail ? (
              <>
                <p className="text-[15px] font-medium" style={{ color: colors.text }}>v{clientPlanForDetail.version} · Effective {formatShortDate(clientPlanForDetail.effectiveDate)}</p>
                {clientPlanForDetail.notes && <p className="text-sm mt-1" style={{ color: colors.muted }}>{clientPlanForDetail.notes}</p>}
              </>
            ) : (
              <p className="text-sm" style={{ color: colors.muted }}>No plan yet.</p>
            )}
            <Button variant="secondary" onClick={async () => { await lightHaptic?.(); onCreateProgram?.(); }} style={{ marginTop: spacing[12] }}>
              Create plan for this client
            </Button>
          </Card>

          {hasNewerVersion && latestVersion && (
            <Card style={{ padding: spacing[12], background: colors.primarySubtle, border: `1px solid ${colors.primary}` }}>
              <p className="text-[13px] font-medium" style={{ color: colors.text }}>Program updated</p>
              <p className="text-[12px] mt-0.5" style={{ color: colors.muted }}>A newer version ({latestVersion.name} v{latestVersion.version ?? 1}) is available.</p>
              <div className="flex gap-2 mt-3">
                <Button variant="primary" onClick={async () => { await lightHaptic?.(); onUpdateToday?.(); }} style={{ flex: 1 }}>Update today</Button>
                <Button variant="secondary" onClick={async () => { await lightHaptic?.(); onUpdateNextWeek?.(); }} style={{ flex: 1 }}>Update next week</Button>
              </div>
            </Card>
          )}

          {programsList.length === 0 ? (
            <EmptyState
              title="No program assigned"
              description="Assign a program block for this client or create one in Program Builder."
              icon={Dumbbell}
              actionLabel="Assign Program"
              onAction={async () => { await lightHaptic?.(); onAssignProgram?.(); }}
            />
          ) : (
            <>
              {programsList.map((prog) => (
                <Card key={prog.id}>
                  <p className="text-xs" style={{ color: colors.muted, marginBottom: 4 }}>Current program</p>
                  <p className="text-[15px] font-semibold" style={{ color: colors.text, marginBottom: 4 }}>{prog.name}</p>
                  <p className="text-[12px]" style={{ color: colors.muted }}>v{prog.version ?? 1} · Updated {assignmentMeta?.updatedAt ? formatShortDate(assignmentMeta.updatedAt) : '—'}</p>
                  {assignmentMeta?.effectiveDate && (
                    <>
                      <p className="text-xs mt-3" style={{ color: colors.muted, marginBottom: 4 }}>Start date</p>
                      <p className="text-[15px]" style={{ color: colors.text }}>{formatShortDate(assignmentMeta.effectiveDate)}</p>
                    </>
                  )}
                </Card>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={async () => { await lightHaptic?.(); onCreateProgram?.(); }}>Create for this client</Button>
                <Button variant="secondary" onClick={async () => { await lightHaptic?.(); onAssignFromLibrary?.(); }}>Assign from Library</Button>
                {onAssignProgram && (
                  <Button variant="secondary" onClick={async () => { await lightHaptic?.(); onAssignProgram?.(); }}>Assign Program</Button>
                )}
                <Button variant="secondary" onClick={async () => { await lightHaptic?.(); onExport?.(); }}>Export</Button>
              </div>
              {changeLog.length > 0 && (
                <Card style={{ padding: spacing[16] }}>
                  <p className="text-xs font-medium mb-3" style={{ color: colors.muted }}>Change log</p>
                  <div className="space-y-2">
                    {changeLog.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="flex justify-between text-sm">
                        <span style={{ color: colors.text }}>{entry.programName} – {entry.action}</span>
                        <span style={{ color: colors.muted }}>{formatShortDate(entry.effectiveDate)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Nutrition section (nested inside Program) */}
      <Card style={{ padding: spacing[16], marginTop: spacing[8] }}>
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed size={18} style={{ color: colors.muted }} />
          <p className="text-sm font-semibold" style={{ color: colors.text }}>Nutrition</p>
        </div>
        {nutritionLoading && (
          <p className="text-sm py-4" style={{ color: colors.muted }}>Loading nutrition…</p>
        )}
        {nutritionError && !nutritionLoading && (
          <>
            <p className="text-sm" style={{ color: colors.destructive }}>{nutritionError}</p>
            <Button variant="secondary" size="sm" onClick={() => typeof onRetryNutrition === 'function' && onRetryNutrition()} style={{ marginTop: spacing[8] }}>Retry</Button>
          </>
        )}
        {!nutritionLoading && !nutritionError && (
          <>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Latest week</p>
            {nutritionLatestWeek ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]" style={{ color: colors.text }}>
                {nutritionLatestWeek.calories != null && <span>{nutritionLatestWeek.calories} cal</span>}
                {nutritionLatestWeek.protein != null && <span>P: {nutritionLatestWeek.protein}g</span>}
                {nutritionLatestWeek.carbs != null && <span>C: {nutritionLatestWeek.carbs}g</span>}
                {nutritionLatestWeek.fats != null && <span>F: {nutritionLatestWeek.fats}g</span>}
                {nutritionLatestWeek.phase && <span className="w-full mt-1 text-xs" style={{ color: colors.muted }}>{nutritionLatestWeek.phase}</span>}
                {[nutritionLatestWeek.calories, nutritionLatestWeek.protein, nutritionLatestWeek.carbs, nutritionLatestWeek.fats].every((v) => v == null) && !nutritionLatestWeek.phase && (
                  <span style={{ color: colors.muted }}>No macros set</span>
                )}
              </div>
            ) : (
              <p className="text-sm py-2" style={{ color: colors.muted }}>No week yet. Tap “Adjust week” to add.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={async () => { await lightHaptic?.(); clientId && navigate(`/clients/${clientId}/nutrition`); }}>
                Open Nutrition plan
              </Button>
              <Button variant="primary" size="sm" onClick={async () => { await lightHaptic?.(); onAdjustWeek?.(); }}>
                Adjust week
              </Button>
              {Array.isArray(nutritionWeeks) && nutritionWeeks.length > 0 && (
                <button
                  type="button"
                  onClick={async () => { await lightHaptic?.(); clientId && navigate(`/clients/${clientId}/nutrition`); }}
                  className="text-sm font-medium px-3 py-2 rounded-lg active:opacity-80"
                  style={{ color: colors.accent }}
                >
                  View history
                </button>
              )}
            </div>
            {Array.isArray(nutritionWeeks) && nutritionWeeks.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>History</p>
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
                  {nutritionWeeks.slice(0, 5).map((w, i) => (
                    <div
                      key={w?.id ?? i}
                      style={{
                        padding: spacing[12],
                        borderBottom: i < Math.min(5, nutritionWeeks.length) - 1 ? `1px solid ${colors.border}` : 'none',
                      }}
                    >
                      <p className="text-[13px] font-medium" style={{ color: colors.text }}>{safeFormatDate?.(w?.week_start) ?? '—'}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs mt-0.5" style={{ color: colors.muted }}>
                        {w?.calories != null && <span>{w.calories} cal</span>}
                        {w?.protein != null && <span>P: {w.protein}g</span>}
                        {w?.carbs != null && <span>C: {w.carbs}g</span>}
                        {w?.fats != null && <span>F: {w.fats}g</span>}
                        {w?.phase && <span>{w.phase}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
