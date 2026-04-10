import { describe, it, expect } from 'vitest';
import { getRouteForNotification, getIconForNotificationType } from '@/lib/notificationRoutes';
import { groupNotificationsByCategory } from '@/lib/notificationTaxonomy';

describe('getRouteForNotification', () => {
  it('routes check-in review for coach with client + check-in ids', () => {
    const path = getRouteForNotification(
      {
        type: 'checkin_review',
        data: { client_id: 'c1', checkin_id: 'k1' },
      },
      'coach'
    );
    expect(path).toBe('/clients/c1/checkins/k1');
  });

  it('routes messages for coach with client id', () => {
    expect(
      getRouteForNotification(
        { type: 'message_received', data: { client_id: 'c9', thread_id: 't1' } },
        'coach'
      )
    ).toBe('/messages/c9');
  });

  it('routes messages for client to inbox', () => {
    expect(
      getRouteForNotification({ type: 'message_received', data: {} }, 'client')
    ).toBe('/messages');
  });

  it('routes payment issue to coach billing view', () => {
    expect(
      getRouteForNotification({ type: 'payment_issue', data: { client_id: 'c2' } }, 'coach')
    ).toBe('/clients/c2/billing');
  });

  it('uses entity_id as client for at-risk when data lacks client_id', () => {
    expect(
      getRouteForNotification(
        { type: 'at_risk_client', data: {}, entity_id: 'c3' },
        'coach'
      )
    ).toBe('/clients/c3');
  });
});

describe('grouping / insights routes', () => {
  it('routes review summary for coach to client or analytics', () => {
    expect(
      getRouteForNotification({ type: 'review_summary', data: { client_id: 'c4' } }, 'coach')
    ).toBe('/clients/c4');
    expect(getRouteForNotification({ type: 'review_summary', data: {} }, 'coach')).toBe('/analytics');
  });
});

describe('groupNotificationsByCategory', () => {
  it('splits items into three sections and sorts newest first within bucket', () => {
    const items = [
      { type: 'message_received', created_at: '2026-01-01T10:00:00Z' },
      { type: 'checkin_review', created_at: '2026-01-02T10:00:00Z' },
      { type: 'adherence_drop', created_at: '2026-01-01T12:00:00Z' },
    ];
    const g = groupNotificationsByCategory(items);
    expect(g.action_required.map((x) => x.type)).toEqual(['checkin_review']);
    expect(g.engagement.map((x) => x.type)).toEqual(['message_received']);
    expect(g.insights.map((x) => x.type)).toEqual(['adherence_drop']);
  });
});

describe('getIconForNotificationType', () => {
  it('returns a renderable icon component', () => {
    const A = getIconForNotificationType('message_received');
    const B = getIconForNotificationType('unknown');
    expect(A).toBeTruthy();
    expect(B).toBeTruthy();
    expect(typeof A === 'function' || typeof A === 'object').toBe(true);
  });
});
