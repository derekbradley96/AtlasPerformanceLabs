import { describe, expect, it } from 'vitest';
import {
  normalizeReviewQueueFilterParam,
  buildReviewQueueUrl,
  buildReviewNextDoneUrl,
  REVIEW_QUEUE_PATH,
  REVIEW_NEXT_PATH,
} from './coachReviewRoutes';

describe('coachReviewRoutes', () => {
  it('normalizeReviewQueueFilterParam maps legacy global keys', () => {
    expect(normalizeReviewQueueFilterParam(null)).toBe(null);
    expect(normalizeReviewQueueFilterParam('all')).toBe(null);
    expect(normalizeReviewQueueFilterParam('reviews')).toBe('checkins');
    expect(normalizeReviewQueueFilterParam('comp_prep')).toBe('posing');
    expect(normalizeReviewQueueFilterParam('payments')).toBe('billing');
    expect(normalizeReviewQueueFilterParam('retention')).toBe('at_risk');
    expect(normalizeReviewQueueFilterParam('leads')).toBe(null);
  });

  it('passes through queue-native filter keys', () => {
    expect(normalizeReviewQueueFilterParam('critical')).toBe('critical');
    expect(normalizeReviewQueueFilterParam('at_risk')).toBe('at_risk');
    expect(normalizeReviewQueueFilterParam('messages')).toBe('messages');
  });

  it('buildReviewQueueUrl adds filter and sort', () => {
    expect(buildReviewQueueUrl({})).toBe(REVIEW_QUEUE_PATH);
    expect(buildReviewQueueUrl({ filter: 'checkins' })).toBe(`${REVIEW_QUEUE_PATH}?filter=checkins`);
    expect(buildReviewQueueUrl({ filter: 'at_risk', sort: 'newest' })).toBe(`${REVIEW_QUEUE_PATH}?filter=at_risk&sort=newest`);
    expect(buildReviewQueueUrl({ sort: 'priority' })).toBe(REVIEW_QUEUE_PATH);
  });

  it('buildReviewNextDoneUrl points at review-next done state', () => {
    expect(buildReviewNextDoneUrl()).toBe(`${REVIEW_NEXT_PATH}?done=1`);
  });
});
