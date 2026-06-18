import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  hasSupabase: false,
  getSupabase: () => null,
}));

vi.mock('@/lib/sandboxStore', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    addMessage: vi.fn(() => null),
  };
});

import { normalizeThread } from './messagingService';

describe('normalizeThread', () => {
  it('normalizes id field', () => {
    expect(normalizeThread({ id: 'thread-1', client_id: 'c1' }).id).toBe('thread-1');
  });

  it('provides lastMessage fallback', () => {
    const preview = 'x'.repeat(100);
    const n = normalizeThread({ id: 't', client_id: 'c', last_message: preview });
    expect(n.last_message_preview).toBe(preview.slice(0, 80));
  });

  it('unread_count is numeric', () => {
    expect(normalizeThread({ id: 't', client_id: 'c', unread_count: '3' }).unread_count).toBe(3);
  });
});

describe('sendMessage (no supabase)', () => {
  it('returns null when supabase is not configured', async () => {
    const { sendMessage } = await import('./messagingService');
    const result = await sendMessage('thread-1', 'hello', 'coach-1');
    expect(result).toBeNull();
  });
});
