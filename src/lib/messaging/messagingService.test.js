import { describe, it, expect } from 'vitest';
import { normalizeThread } from '@/data/messagingService';

describe('normalizeThread', () => {
  it('sets id from thread.id', () => {
    const t = normalizeThread({ id: 'abc', coach_id: 'c1', client_id: 'cl1' });
    expect(t.id).toBe('abc');
    expect(t.client_id).toBe('cl1');
    expect(t.trainer_id).toBe('c1');
  });

  it('unread_count defaults to 0', () => {
    const t = normalizeThread({ id: 'abc', coach_id: 'c', client_id: 'x' });
    expect(t.unread_count).toBe(0);
  });

  it('handles null thread gracefully', () => {
    expect(() => normalizeThread(null)).not.toThrow();
    expect(normalizeThread(null)).toBeNull();
  });

  it('handles non-object gracefully', () => {
    expect(normalizeThread(undefined)).toBeNull();
  });

  it('last_message_preview defaults to empty string', () => {
    const t = normalizeThread({ id: 'abc', coach_id: 'c', client_id: 'x' });
    expect(typeof t.last_message_preview).toBe('string');
    expect(t.last_message_preview).toBe('');
  });
});
