import { describe, it, expect } from 'vitest';
import {
  computeReviewPriorityScore,
  normalizeClientPhaseForPriority,
} from '@/lib/intelligence/reviewPriority';

/** Fixed clock so due-date / show-date logic is stable. */
const FIXED_NOW = new Date('2026-05-14T12:00:00.000Z');

describe('computeReviewPriorityScore (pure)', () => {
  it('check-in review with high health risk scores above retention with low risk', () => {
    const checkin = computeReviewPriorityScore({
      type: 'CHECKIN_REVIEW',
      healthRisk: 'high',
      now: FIXED_NOW,
    });
    const retention = computeReviewPriorityScore({
      type: 'RETENTION_RISK',
      healthRisk: 'low',
      now: FIXED_NOW,
    });
    expect(checkin).toBeGreaterThan(retention);
  });

  it('due today adds more weight than future due', () => {
    const today = FIXED_NOW.toISOString().slice(0, 10);
    const dueToday = computeReviewPriorityScore({
      type: 'CHECKIN_REVIEW',
      healthRisk: 'low',
      dueAt: today,
      now: FIXED_NOW,
    });
    const dueLater = computeReviewPriorityScore({
      type: 'CHECKIN_REVIEW',
      healthRisk: 'low',
      dueAt: '2026-12-01',
      now: FIXED_NOW,
    });
    expect(dueToday).toBeGreaterThan(dueLater);
  });

  it('caps total score at 200', () => {
    const score = computeReviewPriorityScore({
      type: 'PEAK_WEEK_DUE',
      healthRisk: 'high',
      clientPhase: 'peak_week',
      showDate: '2026-05-15',
      dueAt: '2026-05-14',
      unreadCount: 999,
      now: FIXED_NOW,
    });
    expect(score).toBeLessThanOrEqual(200);
  });

  it('UNREAD_MESSAGES adds capped bonus from unreadCount', () => {
    const none = computeReviewPriorityScore({
      type: 'UNREAD_MESSAGES',
      now: FIXED_NOW,
    });
    const many = computeReviewPriorityScore({
      type: 'UNREAD_MESSAGES',
      unreadCount: 100,
      now: FIXED_NOW,
    });
    expect(many).toBeGreaterThan(none);
    const delta = many - none;
    expect(delta).toBeLessThanOrEqual(15);
  });
});

describe('normalizeClientPhaseForPriority (pure)', () => {
  it('maps prep phase', () => {
    expect(normalizeClientPhaseForPriority('prep', null, FIXED_NOW)).toBe('prep');
  });

  it('peak week when show within 7 days', () => {
    expect(normalizeClientPhaseForPriority(null, '2026-05-16', FIXED_NOW)).toBe('peak_week');
  });
});
