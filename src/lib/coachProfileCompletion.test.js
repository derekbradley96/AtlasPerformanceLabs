import { describe, it, expect } from 'vitest';
import { computeCoachProfileCompletion, COACH_PROFILE_COMPLETION_TOTAL_FIELDS } from '@/lib/coachProfileCompletion';

describe('computeCoachProfileCompletion', () => {
  it('returns 0% when listing and profile are empty', () => {
    const { completion_percentage, coach_profile_completion } = computeCoachProfileCompletion(null, null);
    expect(completion_percentage).toBe(0);
    expect(Object.values(coach_profile_completion).every((v) => v === false)).toBe(true);
  });

  it('returns 100% when all eight signals are present', () => {
    const listing = {
      bio: 'a'.repeat(40),
      headline: 'x'.repeat(12),
      pricing_summary: 'y'.repeat(8),
      accepts_transformation: true,
      listing_details: {
        featured_tags: ['Fat loss'],
        years_coaching: 3,
        response_time_label: 'Replies within 24 hours',
        pricing_from_amount: 100,
      },
    };
    const profile = {
      avatar_url: 'https://example.com/a.jpg',
      stripe_account_id: 'acct_123',
    };
    const { completion_percentage } = computeCoachProfileCompletion(listing, profile);
    expect(completion_percentage).toBe(100);
  });

  it('uses eight fields for denominator', () => {
    expect(COACH_PROFILE_COMPLETION_TOTAL_FIELDS).toBe(8);
  });
});
