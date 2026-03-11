/**
 * Single selector: all reviewable items for a client in one timeline.
 * Status: active = needs_review, waiting = scheduled/not due (MVP: empty), done = reviewed.
 *
 * Ruthless rules (enforced here):
 * - No spam: one entry per check-in, one per posing submission; no duplicate peak-week items.
 * - Posing awaiting review is review-workflow only (included in feed; not duplicated in inbox as spam).
 * - Peak week daily items are not added to this feed (handled by inbox separately; unique by clientId+date).
 * - Never auto-show modals on trainer role (handled in UI; this layer is data-only).
 */
import { getClientById, getClientCheckIns, getClients } from '@/data/selectors';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { listMedia } from '@/lib/repos/compPrepRepo';
import { getPoseById } from '@/lib/repos/poseLibraryRepo';

/** @typedef {'active' | 'waiting' | 'done'} SegmentStatus */
/** @typedef {'checkin' | 'posing' | 'photo'} FilterType */

/**
 * @typedef {{
 *   id: string
 *   clientId: string
 *   type: 'checkin' | 'posing' | 'photo'
 *   createdAt: string
 *   status: 'needs_review' | 'reviewed'
 *   title: string
 *   subtitle?: string
 *   summaryLines: string[]
 * }} FeedItem
 */

/**
 * Get review feed for one client. Sorted by createdAt desc.
 * @param {string} clientId
 * @param {{ status?: SegmentStatus, filterType?: FilterType | null }} options
 * @returns {FeedItem[]}
 */
export function getClientReviewFeed(clientId, options = {}) {
  const { status = 'active', filterType = null } = options;
  const client = getClientById(clientId);
  if (!client) return [];

  const items = [];

  // --- Check-ins: only submitted; one per check-in (ruthless: no duplicates) ---
  if (filterType === null || filterType === 'checkin') {
    const checkIns = getClientCheckIns(clientId);
    const submitted = checkIns
      .filter((c) => c.status === 'submitted')
      .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
    for (const c of submitted) {
      const isReviewed = getCheckinReviewed(c.id);
      const itemStatus = isReviewed ? 'reviewed' : 'needs_review';
      if (status === 'waiting') continue; // MVP: waiting is empty
      if (status === 'active' && itemStatus !== 'needs_review') continue;
      if (status === 'done' && itemStatus !== 'reviewed') continue;
      const createdAt = c.submitted_at || c.created_date;
      const summaryLines = [];
      if (c.weight_kg != null) summaryLines.push(`${c.weight_kg} kg`);
      if (c.adherence_pct != null) summaryLines.push(`${c.adherence_pct}% adherence`);
      if (c.steps != null) summaryLines.push(`${c.steps.toLocaleString()} steps`);
      if (summaryLines.length === 0) summaryLines.push('Submitted');
      items.push({
        id: c.id,
        clientId,
        type: 'checkin',
        createdAt,
        status: itemStatus,
        title: client.full_name || 'Client',
        subtitle: createdAt ? new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
        summaryLines,
      });
    }
  }

  // --- Posing: one per media (ruthless: posing awaiting review is review workflow only) ---
  if (filterType === null || filterType === 'posing') {
    const mediaList = listMedia(clientId, { category: 'posing' });
    for (const m of mediaList) {
      const itemStatus = m.reviewedAt ? 'reviewed' : 'needs_review';
      if (status === 'waiting') continue;
      if (status === 'active' && itemStatus !== 'needs_review') continue;
      if (status === 'done' && itemStatus !== 'reviewed') continue;
      const pose = m.poseId ? getPoseById(m.poseId) : null;
      const poseName = pose?.name ?? m.poseId ?? 'Posing';
      items.push({
        id: m.id,
        clientId: m.clientId,
        type: 'posing',
        createdAt: m.createdAt,
        status: itemStatus,
        title: client.full_name || 'Client',
        subtitle: poseName,
        summaryLines: ['Media submitted'],
      });
    }
  }

  // --- Photos: MVP empty (no local progress photo review data yet) ---
  if (filterType === null || filterType === 'photo') {
    // Future: add progress photo sets when data layer exists
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

/**
 * Get all clients' review feeds for global Review Center (MVP: flat list by client).
 * @param {{ status?: SegmentStatus, filterType?: FilterType | null }} options
 * @returns {{ clientId: string, clientName: string, items: FeedItem[] }[]}
 */
export function getAllReviewFeeds(options = {}) {
  const clients = getClients();
  return clients.map((c) => ({
    clientId: c.id,
    clientName: c.full_name || 'Client',
    items: getClientReviewFeed(c.id, options),
  })).filter((g) => g.items.length > 0);
}
