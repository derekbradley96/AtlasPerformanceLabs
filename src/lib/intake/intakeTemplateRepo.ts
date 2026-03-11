/**
 * Intake templates persistence (localStorage). LOCK: fields match intakeTypes.
 */
import type { IntakeTemplate, IntakeSection } from './intakeTypes';

const KEY = 'atlas_intake_templates';

function safeGet(): IntakeTemplate[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeSet(list: IntakeTemplate[]) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function listTemplatesByTrainer(trainerId: string): IntakeTemplate[] {
  return safeGet()
    .filter((t) => t.trainerId === trainerId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listActiveTemplatesByTrainer(trainerId: string): IntakeTemplate[] {
  return listTemplatesByTrainer(trainerId).filter((t) => t.isActive);
}

export function getTemplate(id: string): IntakeTemplate | null {
  return safeGet().find((t) => t.id === id) ?? null;
}

export function createTemplate(
  trainerId: string,
  payload: Pick<IntakeTemplate, 'name' | 'serviceType' | 'sections'>
): IntakeTemplate {
  const now = new Date().toISOString();
  const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const template: IntakeTemplate = {
    id,
    trainerId,
    name: payload.name || 'Untitled',
    serviceType: payload.serviceType || 'coaching',
    sections: payload.sections ?? [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const list = safeGet();
  list.push(template);
  safeSet(list);
  return template;
}

export function updateTemplate(
  id: string,
  patch: Partial<Pick<IntakeTemplate, 'name' | 'serviceType' | 'sections' | 'isActive'>>
): IntakeTemplate | null {
  const list = safeGet();
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  list[idx] = { ...list[idx], ...patch, updatedAt: now };
  safeSet(list);
  return list[idx];
}

export function duplicateTemplate(id: string, trainerId: string): IntakeTemplate | null {
  const existing = getTemplate(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const newId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const sections = (existing.sections ?? []).map((s) => ({
    ...s,
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    questions: (s.questions ?? []).map((q) => ({
      ...q,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })),
  }));
  const template: IntakeTemplate = {
    ...existing,
    id: newId,
    trainerId,
    name: `${existing.name} (copy)`,
    sections,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const list = safeGet();
  list.push(template);
  safeSet(list);
  return template;
}

export function deleteTemplate(id: string): boolean {
  const list = safeGet().filter((t) => t.id !== id);
  if (list.length === safeGet().length) return false;
  safeSet(list);
  return true;
}

/** Generate onboarding token: base64(trainerId|templateId|campaignTag). */
export function createOnboardingToken(trainerId: string, templateId: string, campaignTag?: string): string {
  const payload = [trainerId, templateId, campaignTag ?? ''].join('|');
  return btoa(unescape(encodeURIComponent(payload)));
}

/** Decode token to { trainerId, templateId, campaignTag }. */
export function decodeOnboardingToken(token: string): { trainerId: string; templateId: string; campaignTag: string } | null {
  try {
    const decoded = decodeURIComponent(escape(atob(token)));
    const parts = decoded.split('|');
    return {
      trainerId: parts[0] ?? '',
      templateId: parts[1] ?? '',
      campaignTag: parts[2] ?? '',
    };
  } catch {
    return null;
  }
}
