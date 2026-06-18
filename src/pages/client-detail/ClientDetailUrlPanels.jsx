import React from 'react';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import {
  getSubmissionsByClient,
  getLatestApprovedSubmission,
  approveSubmission,
  requestChangesSubmission,
} from '@/lib/intake/intakeSubmissionRepo';
import { getTemplate } from '@/lib/intake/intakeTemplateRepo';
import { setClientIntakeProfile } from '@/lib/intake/clientIntakeProfileStore';
import { addIntakeRequestMessage } from '@/lib/intake/intakeRequestMessageStore';
import { formatShortDate, safe } from '@/pages/client-detail/clientDetailUtils';

/** Legacy URL-tab nutrition panel (never rendered — parent uses `false &&`). Kept for parity with ClientDetail routing history. */
export function ClientDetailLegacyNutritionUrlBlock({
  nutritionLoading,
  nutritionError,
  loadNutrition,
  nutritionLatestWeek,
  nutritionWeeks,
  lightHaptic,
  navigate,
  clientId,
  openAdjustWeek,
  safeFormatDate,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
      {nutritionLoading && (
        <div className="py-8 text-center text-sm" style={{ color: colors.muted }}>Loading nutrition…</div>
      )}
      {nutritionError && (
        <Card style={{ padding: spacing[16] }}>
          <p className="text-sm" style={{ color: colors.destructive }}>{nutritionError}</p>
          <Button variant="secondary" onClick={loadNutrition} style={{ marginTop: spacing[12] }}>Retry</Button>
        </Card>
      )}
      {!nutritionLoading && !nutritionError && (
        <>
          <Card style={{ padding: spacing[16] }}>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Current macros</p>
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
              <p className="text-sm" style={{ color: colors.muted }}>No week yet. Tap “Adjust this week” to add.</p>
            )}
          </Card>
          <Button
            variant="secondary"
            onClick={async () => { await lightHaptic(); if (clientId) navigate(`/clients/${clientId}/nutrition`); }}
            style={{ minHeight: 44 }}
          >
            Open Nutrition plan
          </Button>
          <Button variant="primary" onClick={async () => { await lightHaptic(); openAdjustWeek(); }} style={{ minHeight: 44 }}>
            Adjust this week
          </Button>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>History</p>
            {nutritionWeeks.length === 0 ? (
              <p className="text-sm py-4" style={{ color: colors.muted }}>No weekly entries yet.</p>
            ) : (
              <div className="app-card overflow-hidden">
                {nutritionWeeks.map((w, i) => (
                  <div
                    key={w.id}
                    style={{
                      padding: spacing[16],
                      borderBottom: i < nutritionWeeks.length - 1 ? `1px solid ${colors.border}` : 'none',
                    }}
                  >
                    <p className="text-[15px] font-medium" style={{ color: colors.text }}>{safeFormatDate(w.week_start)}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs mt-0.5" style={{ color: colors.muted }}>
                      {w.calories != null && <span>{w.calories} cal</span>}
                      {w.protein != null && <span>P: {w.protein}g</span>}
                      {w.carbs != null && <span>C: {w.carbs}g</span>}
                      {w.fats != null && <span>F: {w.fats}g</span>}
                      {w.phase && <span>{w.phase}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function ClientDetailIntakeUrlPanel({ clientId, trainerId, lightHaptic, navigate }) {
  const intakeSubmissionsRaw = safe(() => getSubmissionsByClient(clientId), []);
  const intakeSubmissions = Array.isArray(intakeSubmissionsRaw) ? intakeSubmissionsRaw : [];
  const latestApproved = safe(() => getLatestApprovedSubmission(clientId), null);
  const pending = intakeSubmissions.find((s) => s?.status === 'submitted' || s?.status === 'needs_changes');
  const selectedSub = pending ?? intakeSubmissions[0] ?? null;
  const _intakeTemplate = selectedSub ? safe(() => getTemplate(selectedSub.templateId), null) : null;
  void _intakeTemplate;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
      <Card style={{ padding: spacing[16] }}>
        <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Intake status</p>
        {intakeSubmissions.length === 0 ? (
          <p className="text-sm mb-3" style={{ color: colors.muted }}>No intake submissions yet. Share an onboarding link with this client.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-medium px-2 py-1 rounded"
                style={{
                  background: selectedSub?.status === 'approved' ? colors.successSubtle : selectedSub?.status === 'submitted' || selectedSub?.status === 'needs_changes' ? colors.primarySubtle : colors.surface1,
                  color: selectedSub?.status === 'approved' ? colors.success : selectedSub?.status === 'submitted' || selectedSub?.status === 'needs_changes' ? colors.primary : colors.muted,
                }}
              >
                {selectedSub?.status ?? '—'}
              </span>
              {latestApproved?.approvedAt && (
                <span className="text-xs" style={{ color: colors.muted }}>Last approved: {formatShortDate(latestApproved.approvedAt)}</span>
              )}
            </div>
            {selectedSub?.flags && (selectedSub.flags.readinessRedFlags?.length > 0 || selectedSub.flags.injuries?.length > 0 || selectedSub.flags.equipmentLimits?.length > 0) && (
              <div className="mb-3 p-2 rounded text-xs" style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.muted }}>
                {selectedSub.flags.readinessRedFlags?.length > 0 && <span className="text-red-400">Readiness: {selectedSub.flags.readinessRedFlags.join('; ')} </span>}
                {selectedSub.flags.injuries?.length > 0 && <span>Injuries: {selectedSub.flags.injuries.join('; ')} </span>}
                {selectedSub.flags.equipmentLimits?.length > 0 && <span>Equipment: {selectedSub.flags.equipmentLimits.join('; ')}</span>}
              </div>
            )}
            <Button variant="secondary" onClick={async () => { await lightHaptic(); navigate(`/clients/${clientId}/intake`); }} style={{ marginTop: spacing[8] }}>View full intake</Button>
            {pending && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="primary"
                  onClick={async () => {
                    await lightHaptic();
                    approveSubmission(pending.id);
                    const flags = pending.flags ?? {};
                    setClientIntakeProfile(clientId, {
                      phase: flags.phase ?? undefined,
                      equipmentProfile: flags.equipmentLimits ?? undefined,
                      injuries: flags.injuries ?? undefined,
                      preferences: flags.preferences ?? undefined,
                      baselineMetrics: flags.baselineMetrics ?? undefined,
                    });
                    toast.success('Intake approved');
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await lightHaptic();
                    requestChangesSubmission(pending.id);
                    if (trainerId) addIntakeRequestMessage({ clientId, trainerId, body: 'Your intake needs a few updates. Please review and resubmit.' });
                    toast.success('Marked as needs changes');
                  }}
                >
                  Request changes
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
