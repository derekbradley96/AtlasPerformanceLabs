/**
 * Estimated weekly coach time from engagement signals (rough heuristic for reporting).
 * @param {Record<string, unknown>} client
 * @param {{
 *   checkinsReviewed?: number;
 *   messagesSent?: number;
 *   programmeUpdates?: number;
 *   poseChecksReviewed?: number;
 * }} weekData
 */
export function estimateClientTimeMinutes(client, weekData) {
  void client;
  const w = weekData && typeof weekData === 'object' ? weekData : {};
  let minutes = 0;
  minutes += (Number(w.checkinsReviewed) || 0) * 8;
  minutes += (Number(w.messagesSent) || 0) * 2;
  minutes += (Number(w.programmeUpdates) || 0) * 15;
  minutes += (Number(w.poseChecksReviewed) || 0) * 10;
  return minutes;
}

/**
 * @param {Array<Record<string, unknown> & { id: string; isPrep?: boolean }>} clients
 * @param {Record<string, { checkinsReviewed?: number; messagesSent?: number; programmeUpdates?: number; poseChecksReviewed?: number }>} weekDataByClientId
 */
export function buildWeeklyTimeReport(clients, weekDataByClientId) {
  const byType = { prep: [], lifestyle: [] };
  let totalPrep = 0;
  let totalLifestyle = 0;

  (Array.isArray(clients) ? clients : []).forEach((client) => {
    const mins = estimateClientTimeMinutes(client, weekDataByClientId[client.id] || {});
    const type = client.isPrep ? 'prep' : 'lifestyle';
    const row = { ...client, estimatedMinutes: mins };
    if (client.isPrep) {
      byType.prep.push(row);
      totalPrep += mins;
    } else {
      byType.lifestyle.push(row);
      totalLifestyle += mins;
    }
  });

  const totalMins = totalPrep + totalLifestyle;
  return {
    byType,
    totalPrep,
    totalLifestyle,
    totalMins,
    prepSharePct: totalMins ? Math.round((totalPrep / totalMins) * 100) : 0,
  };
}
