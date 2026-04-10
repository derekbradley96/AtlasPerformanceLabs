const OWNER_EMAIL_ALLOWLIST = ['derekbradley96@gmail.com'];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeId(value) {
  return String(value || '').trim();
}

function getAuthIdentity(authUser) {
  if (!authUser) return { id: '', email: '' };
  return {
    id: normalizeId(authUser.id),
    email: normalizeEmail(authUser.email || authUser.user_metadata?.email),
  };
}

export function isOwnerUser(authUser) {
  const { email } = getAuthIdentity(authUser);
  if (!email) return false;
  return OWNER_EMAIL_ALLOWLIST.includes(email);
}

export function isInternalAdmin(authUser) {
  return isOwnerUser(authUser);
}

