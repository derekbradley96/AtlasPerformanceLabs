import { describe, it, expect } from 'vitest';
import { fetchIsAdmin } from '@/lib/internalAccess';

/** Mock chain for the own-row lookup: .select().eq().maybeSingle() */
function clientReturning(row) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row }),
        }),
      }),
    }),
    auth: {
      getUser: async () => ({ data: { user: { id: 'uid-1' } } }),
    },
  };
}

describe('internalAccess', () => {
  it('returns true when own profile has is_admin=true', async () => {
    await expect(fetchIsAdmin(clientReturning({ is_admin: true }), 'uid-1')).resolves.toBe(true);
  });

  it('resolves the uid via auth.getUser when not passed', async () => {
    await expect(fetchIsAdmin(clientReturning({ is_admin: true }))).resolves.toBe(true);
  });

  it('fails closed for missing client, missing row, or false flag', async () => {
    await expect(fetchIsAdmin(null)).resolves.toBe(false);
    await expect(fetchIsAdmin(clientReturning(null), 'uid-1')).resolves.toBe(false);
    await expect(fetchIsAdmin(clientReturning({ is_admin: false }), 'uid-1')).resolves.toBe(false);
  });

  it('fails closed when no uid can be resolved', async () => {
    const client = clientReturning({ is_admin: true });
    client.auth.getUser = async () => ({ data: { user: null } });
    await expect(fetchIsAdmin(client)).resolves.toBe(false);
  });
});
