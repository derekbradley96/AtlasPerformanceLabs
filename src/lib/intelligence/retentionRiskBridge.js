/**
 * Bridge to retentionRisk.ts for use in JS (Inbox, ClientDetail).
 */
import { computeRetentionRisk } from './retentionRisk';

export function getRetentionRiskForClient(clientId, { getClientById, getClientCheckIns, getThreadByClientId, getMessagesByClientId, getClientMarkedPaid, getAchievementsList } = {}) {
  const client = getClientById?.(clientId);
  if (!client) return { risk: 'low', score0to100: 0, reasons: [] };
  const checkins = getClientCheckIns?.(clientId) ?? [];
  const thread = getThreadByClientId?.(clientId);
  const messages = getMessagesByClientId?.(clientId) ?? [];
  const lastMessageAt = messages.length ? messages[messages.length - 1]?.created_date : thread?.last_message_at ?? null;
  const achievements = getAchievementsList?.(clientId, { byUser: false }) ?? [];
  const lastMilestoneAt = achievements.length
    ? achievements.reduce((max, a) => {
        const d = a.achieved_at ?? a.date ?? a.created_date;
        if (!d) return max;
        const dTime = new Date(d).getTime();
        const maxTime = max ? new Date(max).getTime() : NaN;
        if (Number.isNaN(dTime)) return max;
        return !max || Number.isNaN(maxTime) || dTime > maxTime ? d : max;
      }, null)
    : null;
  const submitted = checkins
    .filter((c) => c.status === 'submitted' && c.adherence_pct != null)
    .sort((a, b) => {
      const tA = new Date(a.submitted_at || a.created_date).getTime();
      const tB = new Date(b.submitted_at || b.created_date).getTime();
      return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
    });
  const last2Avg = submitted.length >= 2 ? (submitted[0].adherence_pct + submitted[1].adherence_pct) / 2 : null;
  const prior2Avg = submitted.length >= 4 ? (submitted[2].adherence_pct + submitted[3].adherence_pct) / 2 : null;
  const overduePayment = client.payment_overdue && !getClientMarkedPaid?.(clientId);

  return computeRetentionRisk({
    adherenceLast2Avg: last2Avg,
    adherencePrior2Avg: prior2Avg,
    unreadCount: thread?.unread_count ?? 0,
    lastMessageAt,
    lastMilestoneAt,
    overduePayment,
  });
}

export { computeRetentionRisk } from './retentionRisk';
