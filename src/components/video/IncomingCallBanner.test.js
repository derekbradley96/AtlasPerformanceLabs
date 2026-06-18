import { describe, expect, it } from 'vitest';
import { shouldClearIncomingForStatus } from '@/components/video/IncomingCallBanner';

describe('IncomingCallBanner status clearing guard', () => {
  it('clears banner for terminal/transition statuses only when call is not active', () => {
    expect(shouldClearIncomingForStatus('completed', false)).toBe(true);
    expect(shouldClearIncomingForStatus('cancelled', false)).toBe(true);
    expect(shouldClearIncomingForStatus('declined', false)).toBe(true);
    expect(shouldClearIncomingForStatus('accepted', false)).toBe(true);
    expect(shouldClearIncomingForStatus('in_progress', false)).toBe(true);
  });

  it('does not clear active call state while call is active', () => {
    expect(shouldClearIncomingForStatus('accepted', true)).toBe(false);
    expect(shouldClearIncomingForStatus('in_progress', true)).toBe(false);
  });

  it('does not clear for ringing', () => {
    expect(shouldClearIncomingForStatus('ringing', false)).toBe(false);
  });
});

