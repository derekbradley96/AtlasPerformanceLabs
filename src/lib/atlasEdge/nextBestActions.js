/**
 * Atlas Edge: Next Best Actions (NBA) — top 3 actions from existing data.
 * Priority: peak_week due today > overdue payments > check-ins review > posing review > unread messages > new leads.
 * Grouped by category (counts), not per client.
 */
import { getTrainerReviewCounts } from '@/features/reviewEngine/getTrainerReviewFeed';
import { getCloseoutCounts } from '@/lib/inboxService';
import { getThreadsForTrainer } from '@/data/selectors';

const PRIORITY_ORDER = [
  { key: 'peak_week', filter: 'comp_prep', title: 'Peak week due today', subtitle: 'Comp prep daily updates' },
  { key: 'payments_overdue', filter: 'payments', title: 'Overdue payments', subtitle: 'Follow up on late payments' },
  { key: 'checkin_review', filter: 'reviews', title: 'Check-ins needing review', subtitle: 'Review submitted check-ins' },
  { key: 'posing_review', filter: 'comp_prep', title: 'Posing awaiting review', subtitle: 'Review posing submissions' },
  { key: 'unread_messages', filter: 'messages', title: 'Unread messages', subtitle: 'Reply to clients' },
  { key: 'new_leads', filter: 'leads', title: 'New leads', subtitle: 'Follow up on leads' },
];

/**
 * @param {string} trainerId
 * @returns {{ title: string, subtitle: string, count: number, filter: string }[]} Top 3 actions (max 3)
 */
export function getNextBestActions(trainerId) {
  const counts = getTrainerReviewCounts(trainerId);
  const closeout = getCloseoutCounts(trainerId);
  const threads = getThreadsForTrainer(trainerId);
  const unreadSum = (threads || []).reduce((s, t) => s + (t.unread_count || 0), 0);

  const values = {
    peak_week: counts.peakWeekDueToday ?? 0,
    payments_overdue: counts.paymentsOverdue ?? 0,
    checkin_review: counts.checkinsDue ?? 0,
    posing_review: (counts.posingReviewsPending ?? 0) + (counts.missingMandatoryPosesClients ?? 0),
    unread_messages: unreadSum > 0 ? unreadSum : (counts.unreadMessages ?? 0),
    new_leads: closeout.newLeads ?? 0,
  };

  const withCount = PRIORITY_ORDER.map((item) => ({
    ...item,
    count: values[item.key] ?? 0,
  })).filter((a) => a.count > 0);

  return withCount.slice(0, 3);
}
