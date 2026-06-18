/**
 * Cross-roster coaching insights (integrated coach home).
 * @param {{ id: string; name?: string; full_name?: string }[]} clients
 * @param {Record<string, { overall?: number; breakdown?: Record<string, number | null | undefined> }>} momentumData
 */

function clientName(c) {
  return String(c?.name || c?.full_name || 'Client').trim() || 'Client';
}

function rosterInsightSortKey(sev) {
  if (sev === 'high') return 0;
  if (sev === 'medium') return 1;
  if (sev === 'positive') return 3;
  return 2;
}

/**
 * @param {{ id: string; name?: string; full_name?: string }[]} clients
 * @param {Record<string, { overall?: number; breakdown?: Record<string, number | null | undefined>; sleep_score?: number; steps_score?: number; checkin_score?: number; total_score?: number }>} momentumData
 */
export function generateRosterInsights(clients, momentumData) {
  const insights = [];
  const roster = Array.isArray(clients) ? clients.filter((c) => c?.id) : [];

  const highStressClients = roster.filter((c) => {
    const m = momentumData[c.id];
    const b = m?.breakdown || {};
    const sleep = b.sleep ?? b.sleep_score ?? m?.sleep_score;
    const energy = b.energy ?? b.steps_score ?? m?.steps_score;
    return (typeof sleep === 'number' && sleep < 60) || (typeof energy === 'number' && energy < 60);
  });
  if (highStressClients.length >= 3) {
    insights.push({
      type: 'roster_stress',
      severity: 'medium',
      title: `${highStressClients.length} clients reporting low energy this week`,
      detail: highStressClients.slice(0, 3).map(clientName).join(', '),
      suggestion: 'Consider recommending a deload or rest day across these clients.',
      action: 'Send group message',
    });
  }

  const missedCheckin = roster.filter((c) => {
    const m = momentumData[c.id];
    const b = m?.breakdown || {};
    const compliance = b.checkin_compliance ?? b.checkins ?? m?.checkin_score;
    return typeof compliance === 'number' && compliance < 50;
  });
  if (missedCheckin.length >= 2) {
    insights.push({
      type: 'checkin_drop',
      severity: 'high',
      title: `${missedCheckin.length} clients haven't checked in this week`,
      detail: missedCheckin.map(clientName).join(', '),
      suggestion: 'A group nudge now catches these before the week ends.',
      action: 'Send nudge to all',
    });
  }

  const highMomentum = roster.filter((c) => (momentumData[c.id]?.overall || 0) >= 80);
  if (roster.length > 0 && highMomentum.length >= Math.floor(roster.length * 0.7)) {
    insights.push({
      type: 'strong_week',
      severity: 'positive',
      title: `Strong week — ${highMomentum.length} clients hitting their targets`,
      detail: 'Your roster is performing well this week.',
      suggestion: 'Great time to collect testimonials or progress photos.',
      action: 'Open result stories',
    });
  }

  return [...insights].sort((a, b) => {
    if (a.severity === 'positive' && b.severity !== 'positive') return 1;
    if (b.severity === 'positive' && a.severity !== 'positive') return -1;
    return rosterInsightSortKey(String(a.severity)) - rosterInsightSortKey(String(b.severity));
  });
}
