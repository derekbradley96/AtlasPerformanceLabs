import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabaseApi', async () => {
  const actual = await vi.importActual('@/lib/supabaseApi');
  return {
    ...actual,
    invokeSupabaseFunction: vi.fn(async () => ({ data: null, error: 'skip-edge' })),
  };
});
import { applyInviteCodeForUser } from '@/lib/inviteConversion';

function createSupabaseStub({
  inviteCoachId = 'coach-1',
  existingClient = null,
  existingClientSequence = null,
  insertErrorsSequence = null,
  profileRoleUpdateError = null,
} = {}) {
  const calls = { profileRoleUpdates: 0, clientUpdates: 0 };
  const existingQueue = Array.isArray(existingClientSequence)
    ? [...existingClientSequence]
    : [existingClient];
  const insertQueue = Array.isArray(insertErrorsSequence)
    ? [...insertErrorsSequence]
    : [];

  const nextExistingClient = () => {
    if (existingQueue.length <= 1) return existingQueue[0] ?? null;
    return existingQueue.shift() ?? null;
  };

  const nextInsertError = () => {
    if (!insertQueue.length) return null;
    return insertQueue.shift() ?? null;
  };

  return {
    __calls: calls,
    async rpc(name) {
      if (name === 'validate_invite_code') {
        return {
          data: inviteCoachId ? { valid: true, coach_id: inviteCoachId } : null,
          error: null,
        };
      }
      return { data: null, error: null };
    },
    from(table) {
      return {
        select() {
          return {
            eq(column, value) {
              if (table === 'profiles' && column === 'referral_code') {
                return {
                  in() {
                    return {
                      async maybeSingle() {
                        return { data: inviteCoachId ? { id: inviteCoachId, role: 'coach' } : null, error: null };
                      },
                    };
                  },
                };
              }
              if (table === 'clients' && column === 'user_id') {
                return {
                  async maybeSingle() {
                    return { data: nextExistingClient(), error: null };
                  },
                };
              }
              if (table === 'profiles' && column === 'id') {
                return Promise.resolve({ data: null, error: null });
              }
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(values) {
          return {
            eq(column) {
              if (table === 'clients' && column === 'id') {
                calls.clientUpdates += 1;
                return {
                  select() {
                    return {
                      async maybeSingle() {
                        return { data: { id: nextExistingClient()?.id ?? 'client-1', ...values }, error: null };
                      },
                    };
                  },
                };
              }
              if (table === 'profiles' && column === 'id') {
                calls.profileRoleUpdates += 1;
                return Promise.resolve({ data: null, error: profileRoleUpdateError });
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        insert(values) {
          return {
            select() {
              return {
                async maybeSingle() {
                  const insertError = nextInsertError();
                  if (insertError) return { data: null, error: insertError };
                  return { data: { id: 'client-created', ...values }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('applyInviteCodeForUser', () => {
  it('updates existing client and returns coach link', async () => {
    const supabase = createSupabaseStub({
      inviteCoachId: 'coach-123',
      existingClient: { id: 'client-1', user_id: 'user-1', coach_id: null, trainer_id: null },
    });
    const result = await applyInviteCodeForUser({
      supabase,
      user: { id: 'user-1', role: 'personal', user_type: 'personal' },
      inviteCode: 'ATLAS123',
    });
    expect(result.coach_id).toBe('coach-123');
    expect(result.was_personal).toBe(true);
    expect(result.clientProfile?.id).toBe('client-1');
  });

  it('throws on invalid invite code', async () => {
    const supabase = createSupabaseStub({ inviteCoachId: null });
    await expect(
      applyInviteCodeForUser({
        supabase,
        user: { id: 'user-1', role: 'personal' },
        inviteCode: 'INVALID',
      })
    ).rejects.toThrow('Invalid invite code');
  });

  it('maps RLS insert failures to actionable error', async () => {
    const supabase = createSupabaseStub({
      existingClient: null,
      insertErrorsSequence: [{ code: '42501', message: 'new row violates row-level security policy' }],
    });
    await expect(
      applyInviteCodeForUser({
        supabase,
        user: { id: 'user-1', role: 'personal' },
        inviteCode: 'ATLAS123',
      })
    ).rejects.toThrow('Could not connect coach link yet');
  });

  it('handles duplicate insert race by re-reading and updating', async () => {
    const supabase = createSupabaseStub({
      inviteCoachId: 'coach-new',
      existingClientSequence: [
        null,
        { id: 'client-race', user_id: 'user-1', coach_id: 'coach-old', trainer_id: 'coach-old' },
        { id: 'client-race', user_id: 'user-1', coach_id: 'coach-old', trainer_id: 'coach-old' },
      ],
      insertErrorsSequence: [{ code: '23505', message: 'duplicate key value violates unique constraint "clients_user_id_key"' }],
    });

    const result = await applyInviteCodeForUser({
      supabase,
      user: { id: 'user-1', role: 'personal' },
      inviteCode: 'ATLAS123',
    });
    expect(result.clientProfile?.id).toBe('client-race');
    expect(result.coach_id).toBe('coach-new');
    expect(supabase.__calls.clientUpdates).toBe(1);
  });

  it('rejects self-invite code usage', async () => {
    const supabase = createSupabaseStub({ inviteCoachId: 'user-1' });
    await expect(
      applyInviteCodeForUser({
        supabase,
        user: { id: 'user-1', role: 'personal' },
        inviteCode: 'ATLAS123',
      }),
    ).rejects.toThrow('You cannot use your own invite code');
  });

  it('does not rewrite profile role when user_type already indicates client', async () => {
    const supabase = createSupabaseStub({
      inviteCoachId: 'coach-123',
      existingClient: { id: 'client-1', user_id: 'user-1', coach_id: null, trainer_id: null },
    });
    await applyInviteCodeForUser({
      supabase,
      user: { id: 'user-1', user_type: 'client' },
      inviteCode: 'ATLAS123',
    });
    expect(supabase.__calls.profileRoleUpdates).toBe(0);
  });
});

