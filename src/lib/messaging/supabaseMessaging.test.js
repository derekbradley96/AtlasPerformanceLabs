import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureThread,
  getMessages,
  sendMessage,
  markThreadRead,
  getUnreadCount,
  normalizeThread,
  dedupeThreadsByClientId,
  filterThreadsForClientInbox,
  fetchThreadForCoachClient,
} from './supabaseMessaging';

vi.mock('@/services/analyticsService', () => ({
  trackMessageSent: vi.fn(),
}));

vi.mock('@/services/notificationTriggers', () => ({
  notifyMessageReceived: vi.fn(),
}));

function createSelectChain({ data, error = null }) {
  const payload = { data, error };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(payload)),
    single: vi.fn(() => Promise.resolve(payload)),
    then(onFulfilled, onRejected) {
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(payload).catch(onRejected);
    },
  };
  return chain;
}

function createInsertChain({ data, error = null }) {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data, error })),
    _insertPayload: null,
  };
  const baseInsert = chain.insert;
  chain.insert = vi.fn((payload) => {
    chain._insertPayload = payload;
    return baseInsert(payload);
  });
  return chain;
}

function createUpdateChain({ error = null }) {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => Promise.resolve({ error })),
  };
  return chain;
}

describe('ensureThread', () => {
  let mockFrom;
  let mockSupabase;

  beforeEach(() => {
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    vi.clearAllMocks();
  });

  it('returns existing thread when found', async () => {
    const existingThread = { id: 'thread-1', coach_id: 'coach-1', client_id: 'client-1', updated_at: '2026-05-01T12:00:00Z' };
    mockFrom.mockReturnValue(createSelectChain({ data: [existingThread] }));

    const result = await ensureThread({ supabase: mockSupabase, coachId: 'coach-1', clientId: 'client-1' });
    expect(result).toEqual(existingThread);
  });

  it('creates new thread when none exists', async () => {
    const newThread = { id: 'thread-2', coach_id: 'coach-1', client_id: 'client-2' };
    mockFrom
      .mockReturnValueOnce(createSelectChain({ data: [] }))
      .mockReturnValueOnce(createInsertChain({ data: newThread }));

    const result = await ensureThread({ supabase: mockSupabase, coachId: 'coach-1', clientId: 'client-2' });
    expect(result).toEqual(newThread);
  });

  it('throws when supabase is null', async () => {
    await expect(ensureThread({ supabase: null, coachId: 'a', clientId: 'b' })).rejects.toThrow();
  });

  it('throws when coachId is missing', async () => {
    await expect(ensureThread({ supabase: mockSupabase, coachId: null, clientId: 'b' })).rejects.toThrow();
  });
});

describe('fetchThreadForCoachClient', () => {
  it('returns one row when duplicates exist (no PGRST116)', async () => {
    const rows = [
      { id: 't-old', coach_id: 'coach-1', client_id: 'client-1', updated_at: '2026-05-01T10:00:00Z' },
      { id: 't-new', coach_id: 'coach-1', client_id: 'client-1', updated_at: '2026-05-02T10:00:00Z' },
    ];
    const mockFrom = vi.fn(() => createSelectChain({ data: rows }));
    const supabase = { from: mockFrom };
    const result = await fetchThreadForCoachClient({ supabase, coachId: 'coach-1', clientId: 'client-1' });
    expect(result?.id).toBe('t-new');
  });
});

describe('sendMessage', () => {
  let mockFrom;
  let mockSupabase;

  beforeEach(() => {
    mockFrom = vi.fn();
    mockSupabase = {
      from: mockFrom,
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: { user: { id: 'coach-1' } } }, error: null }),
        ),
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'coach-1' } }, error: null })),
      },
    };
    vi.clearAllMocks();
  });

  it('sends message and returns message metadata', async () => {
    const savedMsg = { id: 'msg-1', created_at: '2026-05-01T10:00:00Z' };
    const threadRow = { id: 'thread-1', coach_id: 'coach-1', client_id: 'client-1' };

    mockFrom
      .mockReturnValueOnce(createSelectChain({ data: threadRow }))
      .mockReturnValueOnce(createInsertChain({ data: savedMsg }))
      .mockReturnValueOnce(createUpdateChain({}))
      .mockReturnValueOnce(createSelectChain({ data: threadRow }));

    const result = await sendMessage({
      supabase: mockSupabase,
      threadId: 'thread-1',
      senderRole: 'coach',
      text: 'Hello',
    });

    expect(result).toEqual({
      id: 'msg-1',
      created_date: '2026-05-01T10:00:00Z',
    });
  });

  it('throws when threadId is missing', async () => {
    await expect(sendMessage({ supabase: mockSupabase, threadId: null, senderRole: 'coach', text: 'Hi' })).rejects.toThrow();
  });

  it('persists reply_to_id when replyToId is set', async () => {
    const savedMsg = { id: 'msg-2', created_at: '2026-05-01T10:01:00Z' };
    const threadRow = { id: 'thread-1', coach_id: 'coach-1', client_id: 'client-1' };
    const insertChain = createInsertChain({ data: savedMsg });

    mockFrom
      .mockReturnValueOnce(createSelectChain({ data: threadRow }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(createUpdateChain({}))
      .mockReturnValueOnce(createSelectChain({ data: threadRow }));

    await sendMessage({
      supabase: mockSupabase,
      threadId: 'thread-1',
      senderRole: 'coach',
      text: 'Reply body',
      replyToId: 'msg-parent',
    });

    expect(insertChain._insertPayload).toMatchObject({
      reply_to_id: 'msg-parent',
    });
  });
});

describe('getMessages', () => {
  let mockFrom;
  let mockSupabase;

  beforeEach(() => {
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    vi.clearAllMocks();
  });

  it('returns messages in ascending order', async () => {
    const messages = [
      { id: 'msg-1', thread_id: 'thread-1', sender_role: 'coach', message_text: 'A', created_at: '2026-05-01T09:00:00Z' },
      { id: 'msg-2', thread_id: 'thread-1', sender_role: 'client', message_text: 'B', created_at: '2026-05-01T10:00:00Z' },
    ];
    mockFrom.mockReturnValue(createSelectChain({ data: messages }));

    const result = await getMessages(mockSupabase, 'thread-1', 50);
    expect(result[0].id).toBe('msg-1');
    expect(result[1].id).toBe('msg-2');
  });

  it('throws on data error from listMessages path', async () => {
    mockFrom.mockReturnValue(createSelectChain({ data: null, error: { message: 'error' } }));
    await expect(getMessages(mockSupabase, 'thread-1')).rejects.toBeTruthy();
  });
});

describe('markThreadRead', () => {
  it('returns early when missing params', async () => {
    await expect(markThreadRead(null, 'thread-1', 'coach')).resolves.toBeUndefined();
  });
});

describe('getUnreadCount', () => {
  let mockFrom;
  let mockSupabase;

  beforeEach(() => {
    mockFrom = vi.fn();
    mockSupabase = { from: mockFrom };
    vi.clearAllMocks();
  });

  it('returns 0 when coach has no threads', async () => {
    mockFrom.mockReturnValue(createSelectChain({ data: [] }));
    const count = await getUnreadCount(mockSupabase, 'coach-1', 'coach');
    expect(count).toBe(0);
  });

  it('returns 0 when missing args', async () => {
    const count = await getUnreadCount(null, null, 'coach');
    expect(count).toBe(0);
  });
});

describe('dedupeThreadsByClientId', () => {
  it('returns one row per client_id', () => {
    const threads = [
      { id: 't1', client_id: 'c1', coach_id: 'coach-a', updated_at: '2026-05-01T10:00:00Z' },
      { id: 't2', client_id: 'c1', coach_id: 'coach-b', updated_at: '2026-05-02T10:00:00Z' },
    ];
    const out = dedupeThreadsByClientId(threads);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('t2');
  });

  it('prefers the active coach when preferredCoachId is set', () => {
    const threads = [
      { id: 't-old', client_id: 'c1', coach_id: 'coach-old', updated_at: '2026-05-10T10:00:00Z' },
      { id: 't-new', client_id: 'c1', coach_id: 'coach-new', updated_at: '2026-05-01T10:00:00Z' },
    ];
    const out = dedupeThreadsByClientId(threads, { preferredCoachId: 'coach-new' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('t-new');
  });
});

describe('filterThreadsForClientInbox', () => {
  it('keeps only threads for the linked coach and dedupes to one row', () => {
    const threads = [
      { id: 't1', client_id: 'c1', coach_id: 'coach-a' },
      { id: 't2', client_id: 'c1', coach_id: 'coach-b' },
      { id: 't3', client_id: 'c1', coach_id: 'coach-a' },
    ];
    const out = filterThreadsForClientInbox(threads, 'coach-a');
    expect(out).toHaveLength(1);
    expect(out[0].coach_id).toBe('coach-a');
  });

  it('falls back to canonical thread when linked coach has no exact match', () => {
    const threads = [{ id: 't1', client_id: 'c1', coach_id: 'coach-old' }];
    expect(filterThreadsForClientInbox(threads, 'coach-new')).toHaveLength(1);
  });
});

describe('normalizeThread', () => {
  it('returns id from thread.id', () => {
    const row = { id: 'thread-uuid', client_id: 'client-1', updated_at: '2024-01-01T00:00:00Z' };
    expect(normalizeThread(row, { last_message_preview: 'hi', unread_count: 0 }).id).toBe('thread-uuid');
  });

  it('handles missing coach_id gracefully', () => {
    const n = normalizeThread({ id: 't1', client_id: 'c1' });
    expect(n.coach_id).toBeNull();
  });

  it('handles missing client_last_read_at gracefully', () => {
    const n = normalizeThread({ id: 't1', coach_id: 'coach-1', client_id: 'c1' });
    expect(n.client_last_read_at).toBeNull();
  });

  it('unread_count defaults to 0', () => {
    expect(normalizeThread({ id: 't1', client_id: 'c1' }).unread_count).toBe(0);
  });
});
