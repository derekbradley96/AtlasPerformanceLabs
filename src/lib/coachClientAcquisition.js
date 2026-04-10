import { isInternalAdmin } from '@/lib/internalAccess';

/**
 * Manual roster creation (modal add, CSV import UI) is not a production coach path.
 * Production: clients join via coach link / coach code (InviteClient, EnterInviteCode, join flows).
 *
 * When true, show sandbox/manual add, CSV import menu, and similar tooling.
 */
export function showCoachManualClientAcquisitionTools({
  isDemoMode = false,
  isAdminBypass = false,
  profile = null,
  supabaseUser = null,
} = {}) {
  if (isDemoMode) return true;
  if (import.meta.env.DEV) return true;
  if (isAdminBypass) return true;
  const adminFlag = profile?.is_admin;
  if (adminFlag === true || adminFlag === 1) return true;
  if (typeof adminFlag === 'string' && adminFlag.toLowerCase() === 'true') return true;
  if (isInternalAdmin(supabaseUser)) return true;
  return false;
}
