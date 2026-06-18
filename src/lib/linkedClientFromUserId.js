/**
 * Demo / offline: find a client row linked to an auth user id across sandbox coach scopes.
 */
import * as sandbox from '@/lib/sandboxStore';

const DEMO_SCOPE_TRAINER_IDS = ['local-trainer', 'local-coach', 'fake-trainer'];

export function getSandboxClientByUserId(userId) {
  if (userId == null || userId === '') return null;
  const u = String(userId);
  for (const tid of DEMO_SCOPE_TRAINER_IDS) {
    for (const c of sandbox.listClients(tid) ?? []) {
      if (c && String(c.user_id ?? c.client_user_id ?? '') === u) return c;
    }
  }
  return null;
}
