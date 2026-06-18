import { describe, it, expect } from 'vitest';
import {
  canModifyOwnUnreadMessage,
  canReplyToMessage,
  getMessageMenuCapabilities,
  isMessageReadByRecipient,
  isOutgoingMessage,
} from './messageInteractionRules';

describe('messageInteractionRules', () => {
  const thread = {
    coach_last_read_at: '2026-05-21T16:00:00Z',
    client_last_read_at: null,
  };

  it('detects coach outgoing', () => {
    expect(isOutgoingMessage({ sender: 'coach' }, false)).toBe(true);
    expect(isOutgoingMessage({ sender: 'client' }, false)).toBe(false);
  });

  it('detects unread by recipient for coach message', () => {
    const msg = { created_date: '2026-05-21T15:00:00Z', sender: 'coach' };
    expect(isMessageReadByRecipient(msg, thread, false)).toBe(false);
    expect(
      isMessageReadByRecipient(msg, { ...thread, client_last_read_at: '2026-05-21T16:05:00Z' }, false),
    ).toBe(true);
  });

  it('allows modify when own and unread', () => {
    const msg = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      created_date: '2026-05-21T15:00:00Z',
      sender: 'coach',
      body: 'hello',
      type: 'text',
    };
    expect(canModifyOwnUnreadMessage(msg, thread, false)).toBe(true);
    expect(canReplyToMessage(msg)).toBe(true);
    const caps = getMessageMenuCapabilities(msg, thread, false);
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
  });
});
