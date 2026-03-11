import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClientById } from '@/data/selectors';
import {
  getSubmissionsByClient,
  getLatestApprovedSubmission,
  getSubmission,
  approveSubmission,
  requestChangesSubmission,
} from '@/lib/intake/intakeSubmissionRepo';
import { getTemplate } from '@/lib/intake/intakeTemplateRepo';
import { setClientIntakeProfile } from '@/lib/intake/clientIntakeProfileStore';
import { addIntakeRequestMessage } from '@/lib/intake/intakeRequestMessageStore';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight, notificationSuccess } from '@/lib/haptics';

export default function ClientIntake() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const [client, setClient] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [requestChangesMessage, setRequestChangesMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  const load = useCallback(() => {
    if (!clientId) return;
    setClient(getClientById(clientId));
    setSubmissions(getSubmissionsByClient(clientId));
    const latest = getLatestApprovedSubmission(clientId);
    setSelectedId(null);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = selectedId ? getSubmission(selectedId) : submissions[0] ?? null;
  const template = selected ? getTemplate(selected.templateId) : null;
  const latestApproved = getLatestApprovedSubmission(clientId);

  const handleApprove = useCallback(() => {
    if (!selected?.id || !clientId || selected.clientId !== clientId) return;
    impactLight();
    approveSubmission(selected.id);
    const flags = selected.flags ?? {};
    setClientIntakeProfile(clientId, {
      phase: flags.phase ?? undefined,
      equipmentProfile: flags.equipmentLimits ?? undefined,
      injuries: flags.injuries ?? undefined,
      preferences: flags.preferences ?? undefined,
      baselineMetrics: flags.baselineMetrics ?? undefined,
    });
    toast.success('Intake approved');
    notificationSuccess();
    load();
  }, [selected, clientId, load]);

  const handleRequestChanges = useCallback(() => {
    if (!selected?.id) return;
    requestChangesSubmission(selected.id);
    if (requestChangesMessage.trim() && selected.clientId && trainerId) {
      addIntakeRequestMessage({
        clientId: selected.clientId,
        trainerId,
        body: `Intake update requested: ${requestChangesMessage.trim()}`,
      });
    }
    setShowRequestModal(false);
    setRequestChangesMessage('');
    toast.success('Marked as needs changes');
    impactLight();
    load();
  }, [selected?.id, selected?.clientId, trainerId, requestChangesMessage, load]);

  if (!trainerId || !clientId) {
    return (
      <div className="p-6 text-slate-400">
        <p>Invalid client.</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-slate-400">
        <p>Client not found.</p>
      </div>
    );
  }

  const canApprove = selected && (selected.status === 'submitted' || selected.status === 'needs_changes');
  const canRequestChanges = selected && (selected.status === 'submitted' || selected.status === 'needs_changes');

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))` }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
        Intake · {client.full_name ?? 'Client'}
      </h2>

      {latestApproved && (
        <Card style={{ padding: spacing[12], marginBottom: spacing[16] }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            Last approved: {latestApproved.approvedAt ? new Date(latestApproved.approvedAt).toLocaleDateString() : '—'}
          </p>
        </Card>
      )}

      {submissions.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            No intake submissions yet. Share an onboarding link with this client.
          </p>
        </Card>
      ) : (
        <>
          {submissions.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                Submission
              </label>
              <select
                value={selectedId ?? submissions[0]?.id ?? ''}
                onChange={(e) => setSelectedId(e.target.value || null)}
                className="w-full rounded-lg border bg-slate-800/50 px-3 py-2"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                {submissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.updatedAt).toLocaleString()} · {s.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selected && (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{
                    background: selected.status === 'approved' ? 'rgba(34,197,94,0.2)' : selected.status === 'submitted' || selected.status === 'needs_changes' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.1)',
                    color: selected.status === 'approved' ? '#4ade80' : selected.status === 'submitted' || selected.status === 'needs_changes' ? '#60a5fa' : colors.muted,
                  }}
                >
                  {selected.status}
                </span>
                {selected.submittedAt && (
                  <span className="text-xs" style={{ color: colors.muted }}>
                    Submitted {new Date(selected.submittedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {selected.flags && (selected.flags.readinessRedFlags?.length > 0 || selected.flags.injuries?.length > 0 || selected.flags.equipmentLimits?.length > 0) && (
                <div className="mb-4 p-3 rounded-lg bg-slate-800/50">
                  <h4 className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                    Extracted
                  </h4>
                  {selected.flags.readinessRedFlags?.length > 0 && (
                    <p className="text-xs mb-1" style={{ color: '#f87171' }}>
                      Readiness: {selected.flags.readinessRedFlags.join('; ')}
                    </p>
                  )}
                  {selected.flags.injuries?.length > 0 && (
                    <p className="text-xs mb-1" style={{ color: colors.muted }}>
                      Injuries: {selected.flags.injuries.join('; ')}
                    </p>
                  )}
                  {selected.flags.equipmentLimits?.length > 0 && (
                    <p className="text-xs" style={{ color: colors.muted }}>
                      Equipment: {selected.flags.equipmentLimits.join('; ')}
                    </p>
                  )}
                </div>
              )}

              <h4 className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                Answers
              </h4>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {template?.sections?.map((sec) =>
                  (sec.questions ?? []).map((q) => {
                    const val = selected.answers?.[q.id];
                    const display = val === undefined || val === null ? '—' : Array.isArray(val) ? val.join(', ') : String(val);
                    return (
                      <div key={q.id} className="text-sm">
                        <span style={{ color: colors.muted }}>{q.label}: </span>
                        <span style={{ color: colors.text }}>{display}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                {canApprove && (
                  <Button onClick={handleApprove}>
                    Approve
                  </Button>
                )}
                {canRequestChanges && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setShowRequestModal(true)}
                    >
                      Request changes
                    </Button>
                    {showRequestModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                        <Card style={{ padding: spacing[16], maxWidth: 400, width: '100%' }}>
                          <h3 className="font-semibold mb-2" style={{ color: colors.text }}>
                            Request changes
                          </h3>
                          <p className="text-sm mb-3" style={{ color: colors.muted }}>
                            Optionally add a message to send to the client (saved to thread).
                          </p>
                          <textarea
                            value={requestChangesMessage}
                            onChange={(e) => setRequestChangesMessage(e.target.value)}
                            placeholder="What should they update?"
                            rows={3}
                            className="w-full rounded border bg-slate-800/50 px-3 py-2 text-sm mb-4"
                            style={{ borderColor: colors.border, color: colors.text }}
                          />
                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setShowRequestModal(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleRequestChanges}>
                              Mark needs changes
                            </Button>
                          </div>
                        </Card>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
