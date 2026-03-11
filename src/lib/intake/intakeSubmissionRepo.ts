/**
 * Intake submissions persistence (localStorage).
 */
import type { IntakeSubmission, IntakeSubmissionStatus, IntakeFlags } from './intakeTypes';

const KEY = 'atlas_intake_submissions';

function safeGet(): IntakeSubmission[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeSet(list: IntakeSubmission[]) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function listSubmissionsByTrainer(trainerId: string): IntakeSubmission[] {
  return safeGet()
    .filter((s) => s.trainerId === trainerId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listSubmissionsNeedingReview(trainerId: string): IntakeSubmission[] {
  return listSubmissionsByTrainer(trainerId).filter((s) => s.status === 'submitted' || s.status === 'needs_changes');
}

export function getSubmission(id: string): IntakeSubmission | null {
  return safeGet().find((s) => s.id === id) ?? null;
}

export function getSubmissionsByClient(clientId: string): IntakeSubmission[] {
  return safeGet()
    .filter((s) => s.clientId === clientId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getLatestApprovedSubmission(clientId: string): IntakeSubmission | null {
  const approved = safeGet().filter((s) => s.clientId === clientId && s.status === 'approved');
  if (approved.length === 0) return null;
  return approved.sort((a, b) => new Date((b.approvedAt || b.updatedAt)!).getTime() - new Date((a.approvedAt || a.updatedAt)!).getTime())[0];
}

export function createSubmission(
  trainerId: string,
  templateId: string,
  opts: { clientId?: string | null; leadId?: string | null; answers?: Record<string, unknown>; flags?: IntakeFlags }
): IntakeSubmission {
  const now = new Date().toISOString();
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry: IntakeSubmission = {
    id,
    trainerId,
    clientId: opts.clientId ?? null,
    leadId: opts.leadId ?? null,
    templateId,
    status: 'draft',
    answers: opts.answers ?? {},
    flags: opts.flags ?? {},
    submittedAt: null,
    approvedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  const list = safeGet();
  list.push(entry);
  safeSet(list);
  return entry;
}

export function updateSubmission(
  id: string,
  patch: Partial<Pick<IntakeSubmission, 'status' | 'answers' | 'flags' | 'submittedAt' | 'approvedAt' | 'clientId'>>
): IntakeSubmission | null {
  const list = safeGet();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  list[idx] = { ...list[idx], ...patch, updatedAt: now };
  safeSet(list);
  return list[idx];
}

export function submitSubmission(id: string): IntakeSubmission | null {
  return updateSubmission(id, { status: 'submitted', submittedAt: new Date().toISOString() });
}

export function approveSubmission(id: string): IntakeSubmission | null {
  return updateSubmission(id, { status: 'approved', approvedAt: new Date().toISOString() });
}

export function requestChangesSubmission(id: string): IntakeSubmission | null {
  return updateSubmission(id, { status: 'needs_changes' });
}
