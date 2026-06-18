import { describe, it, expect } from 'vitest';
import { fetchIsAdmin } from '@/lib/internalAccess';

describe('internalAccess', () => {
  it('returns true when profile has is_admin=true', async () => {
    const supabaseClient = {
      from: () => ({
        select: () => ({
          single: async () => ({ data: { is_admin: true } }),
        }),
      }),
    };
    await expect(fetchIsAdmin(supabaseClient)).resolves.toBe(true);
  });

  it('fails closed for missing client/false flag', async () => {
    await expect(fetchIsAdmin(null)).resolves.toBe(false);
    const supabaseClient = {
      from: () => ({
        select: () => ({
          single: async () => ({ data: { is_admin: false } }),
        }),
      }),
    };
    await expect(fetchIsAdmin(supabaseClient)).resolves.toBe(false);
  });
});

