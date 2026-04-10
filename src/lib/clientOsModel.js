/**
 * Coach Client OS — shared context + timeline merge + message templates.
 */

/**
 * @param {Record<string, unknown> | null | undefined} client
 */
export function resolveClientOsContext(client) {
  const ctype = String(client?.client_type ?? '').toLowerCase();
  const delivery = String(client?.delivery_context ?? '').toLowerCase();
  const isCompetition =
    ctype === 'competition' || delivery === 'competition' || delivery === 'prep' || delivery === 'integrated';
  return {
    emphasis: isCompetition ? 'competition_prep' : 'transformation',
    showPrepHygiene: isCompetition,
    clientTypeLabel: isCompetition ? 'Competition / prep' : 'Transformation',
  };
}

/**
 * Merge performance timeline events with check-ins (newest first).
 */
export function mergeClientOsTimeline(timelineEvents, checkInsList, formatShortDate) {
  const items = [];
  for (const c of Array.isArray(checkInsList) ? checkInsList : []) {
    if (!c?.id) continue;
    const t = c.submitted_at || c.created_date;
    if (!t) continue;
    items.push({
      id: `checkin-${c.id}`,
      sort: new Date(t).getTime(),
      badge: 'Check-in',
      title: `Check-in · ${typeof formatShortDate === 'function' ? formatShortDate(t) : t}`,
      description: [
        c.adherence_pct != null ? `${c.adherence_pct}% adherence` : null,
        c.status === 'pending' ? 'Pending' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      created_at: t,
    });
  }
  for (const evt of Array.isArray(timelineEvents) ? timelineEvents : []) {
    const createdAt = evt.created_at || evt.date || evt.occurred_at;
    const title = evt.title || evt.summary || evt.event_type || 'Update';
    const description = evt.description || evt.details || evt.event_data?.note || '';
    const badge = evt.badge || evt.event_type || 'Event';
    items.push({
      id: String(evt.id || `${badge}-${createdAt}-${title}`),
      sort: createdAt ? new Date(createdAt).getTime() : 0,
      badge,
      title,
      description,
      created_at: createdAt,
      raw: evt,
    });
  }
  return items.sort((a, b) => b.sort - a.sort);
}

export const CLIENT_OS_MESSAGE_TEMPLATES = [
  { id: 'nudge', label: 'Weekly nudge', body: 'Hey — quick check-in on how the week felt. Any wins or friction I should know about?' },
  { id: 'adherence', label: 'Adherence', body: 'Let’s tighten execution for the next few days — hit the plan as written and we’ll adjust from there if needed.' },
  { id: 'prep', label: 'Prep consistency', body: 'Please keep water and sodium steady day to day so we can read the trend clearly.' },
  { id: 'celebrate', label: 'Celebrate', body: 'Really solid work this week — keep that momentum going.' },
];
