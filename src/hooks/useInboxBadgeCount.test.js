import { describe, expect, it } from 'vitest';
import { computeInboxBadgeCount } from './useInboxBadgeCount';

describe('computeInboxBadgeCount', () => {
  it('sums unread counts across threads', () => {
    const value = computeInboxBadgeCount([
      { id: 't1', unread_count: 2 },
      { id: 't2', unreadCount: 3 },
      { id: 't3', unread_count: 0 },
    ]);
    expect(value).toBe(5);
  });

  it('excludes locally deleted thread ids', () => {
    const value = computeInboxBadgeCount(
      [
        { client_id: 'c1', unread_count: 4 },
        { client_id: 'c2', unread_count: 1 },
      ],
      new Set(['c1'])
    );
    expect(value).toBe(1);
  });
});

