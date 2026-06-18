import { describe, expect, it } from 'vitest';
import { ACTIVE_SIGNAL_STATUSES, canCalleeUseOfferRow } from '@/hooks/useWebRTC';

describe('useWebRTC signalling guards', () => {
  it('allows active offer rows for ringing/accepted/in_progress', () => {
    for (const status of ACTIVE_SIGNAL_STATUSES) {
      expect(
        canCalleeUseOfferRow({ sdp_offer: 'offer', sdp_answer: null, status })
      ).toBe(true);
    }
  });

  it('rejects rows without offer or with answer already set', () => {
    expect(canCalleeUseOfferRow({ sdp_offer: null, sdp_answer: null, status: 'ringing' })).toBe(false);
    expect(canCalleeUseOfferRow({ sdp_offer: 'offer', sdp_answer: 'answer', status: 'ringing' })).toBe(false);
  });

  it('rejects terminal statuses', () => {
    expect(canCalleeUseOfferRow({ sdp_offer: 'offer', sdp_answer: null, status: 'completed' })).toBe(false);
    expect(canCalleeUseOfferRow({ sdp_offer: 'offer', sdp_answer: null, status: 'cancelled' })).toBe(false);
    expect(canCalleeUseOfferRow({ sdp_offer: 'offer', sdp_answer: null, status: 'declined' })).toBe(false);
  });
});

