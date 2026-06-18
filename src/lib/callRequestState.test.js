import { describe, expect, it } from 'vitest';
import {
  acceptIncomingVideoCall,
  finalizeCallOnHangup,
  insertOutgoingVideoCall,
  markCallInProgress,
  resolveTerminalCallStatus,
} from '@/lib/callRequestState';

function createMockSupabase() {
  const rows = [];
  let idSeq = 1;

  const api = {
    __getRow(id) {
      return rows.find((row) => row.id === id) || null;
    },
    from(table) {
      if (table !== 'checkin_call_requests') throw new Error(`Unexpected table: ${table}`);
      const state = {
        op: null,
        payload: null,
        eqFilter: {},
        inFilter: {},
      };
      const chain = {
        insert(payload) {
          state.op = 'insert';
          state.payload = payload;
          return chain;
        },
        update(payload) {
          state.op = 'update';
          state.payload = payload;
          return chain;
        },
        select() {
          return chain;
        },
        eq(field, value) {
          state.eqFilter[field] = value;
          return chain;
        },
        in(field, values) {
          state.inFilter[field] = values;
          if (state.op === 'update') {
            const targetId = state.eqFilter.id;
            const row = rows.find((candidate) => candidate.id === targetId);
            if (row) {
              const allowed = state.inFilter.status;
              if (!Array.isArray(allowed) || allowed.includes(row.status)) {
                Object.assign(row, state.payload || {});
              }
            }
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (state.op === 'insert') {
            const next = { id: `call-${idSeq++}`, ...(state.payload || {}) };
            rows.push(next);
            return Promise.resolve({ data: next, error: null });
          }
          if (state.op === 'select') {
            const targetId = state.eqFilter.id;
            return Promise.resolve({ data: rows.find((row) => row.id === targetId) || null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  };

  return api;
}

describe('callRequestState lifecycle', () => {
  it('follows ringing -> accepted -> in_progress -> completed', async () => {
    const supabase = createMockSupabase();
    const inserted = await insertOutgoingVideoCall({
      supabase,
      coachId: 'coach-1',
      clientId: 'client-1',
      callerName: 'Coach',
    });
    expect(inserted?.status).toBe('ringing');

    await acceptIncomingVideoCall({ supabase, callRequestId: inserted.id });
    expect(supabase.__getRow(inserted.id)?.status).toBe('accepted');

    await markCallInProgress({ supabase, callRequestId: inserted.id });
    expect(supabase.__getRow(inserted.id)?.status).toBe('in_progress');

    await finalizeCallOnHangup({
      supabase,
      callRequestId: inserted.id,
      connectionState: 'connected',
    });
    expect(supabase.__getRow(inserted.id)?.status).toBe('completed');
  });

  it('uses cancelled terminal status when call never connected', async () => {
    const supabase = createMockSupabase();
    const inserted = await insertOutgoingVideoCall({
      supabase,
      coachId: 'coach-1',
      clientId: 'client-1',
      callerName: 'Coach',
    });
    await finalizeCallOnHangup({
      supabase,
      callRequestId: inserted.id,
      connectionState: 'connecting',
    });
    expect(supabase.__getRow(inserted.id)?.status).toBe('cancelled');
    expect(resolveTerminalCallStatus('connected')).toBe('completed');
    expect(resolveTerminalCallStatus('connecting')).toBe('cancelled');
  });

  it('does not promote declined calls back to in_progress', async () => {
    const supabase = createMockSupabase();
    const inserted = await insertOutgoingVideoCall({
      supabase,
      coachId: 'coach-1',
      clientId: 'client-1',
      callerName: 'Coach',
    });
    supabase.__getRow(inserted.id).status = 'declined';
    await markCallInProgress({ supabase, callRequestId: inserted.id });
    expect(supabase.__getRow(inserted.id)?.status).toBe('declined');
  });
});

