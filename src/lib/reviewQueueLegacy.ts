/**
 * Legacy review queue: getReviewQueue, getReviewQueueForUI, getTopActiveReviewItem.
 * Used by CapacityDashboard and ReviewDetail. New Global Review uses reviewQueue/ (buildTrainerQueue).
 */
import { getTrainerReviewFeed } from '@/features/reviewEngine/getTrainerReviewFeed';
import type { ReviewItem, ReviewItemType, ReviewItemStatus } from '@/lib/types/reviewItem';

const doneOverlay = new Map<string, { status: ReviewItemStatus; updatedAt: string }>();

function feedTypeToReviewType(feedType: string): ReviewItemType {
  switch (feedType) {
    case 'checkin':
      return 'checkin_review';
    case 'posing':
      return 'posing_review';
    case 'missing_poses':
      return 'posing_missing';
    case 'peak_week_due':
      return 'peak_week';
    default:
      return 'checkin_review';
  }
}

/** Dedupe key for feed item. */
export function dedupeKeyForFeedItem(item: { type: string; clientId: string; id?: string; week_start?: string; showDate?: string }): string {
  if (item.type === 'missing_poses') return `posing_missing:${item.clientId}`;
  if (item.type === 'peak_week_due' && item.showDate) return `peak_week:${item.clientId}:${item.showDate}`;
  if (item.type === 'checkin' && item.week_start) return `checkin_pending:${item.clientId}:${item.week_start}`;
  return `${item.type}:${item.clientId}:${item.id ?? ''}`;
}

export function getDedupeKeyForReview(reviewType: string, id: string, clientId: string, weekStart?: string | null): string {
  if (reviewType === 'checkin' && weekStart) return `checkin_pending:${clientId}:${weekStart}`;
  return `${reviewType}:${clientId}:${id}`;
}

export function recomputePriorityScore(
  item: { priorityScore?: number; type?: string; createdAt?: string; showDate?: string },
  clientContext?: { healthScore?: number; riskScore?: number }
): number {
  let score = item.priorityScore ?? 50;
  if (clientContext?.healthScore != null && clientContext.healthScore < 60) score += 15;
  if (clientContext?.riskScore != null && clientContext.riskScore > 50) score += 10;
  if (item.showDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (item.showDate === today) score += 20;
  }
  return Math.min(100, score);
}

export interface UpsertReviewItemParams {
  trainerId: string;
  clientId: string | null;
  type: ReviewItemType;
  status: ReviewItemStatus;
  dueAt: string | null;
  priorityScore: number;
  metadata?: Record<string, unknown>;
  dedupeKey: string;
}

export function upsertReviewItem(params: UpsertReviewItemParams): void {
  doneOverlay.set(params.dedupeKey, { status: params.status, updatedAt: new Date().toISOString() });
}

export function markReviewItemDone(dedupeKey: string): void {
  doneOverlay.set(dedupeKey, { status: 'done', updatedAt: new Date().toISOString() });
}

export function getReviewItemOverlay(dedupeKey: string): { status: ReviewItemStatus; updatedAt: string } | null {
  return doneOverlay.get(dedupeKey) ?? null;
}

function mapFilterToFeedFilter(filterType: string | null): string | null {
  if (!filterType || filterType === 'all') return null;
  if (filterType === 'reviews') return 'checkin';
  if (filterType === 'comp_prep') return 'posing';
  if (filterType === 'payments' || filterType === 'messages' || filterType === 'leads') return null;
  return filterType;
}

export function getReviewQueue(
  trainerId: string,
  status: ReviewItemStatus,
  filterType?: string | null
): ReviewItem[] {
  const feedFilter = mapFilterToFeedFilter(filterType ?? null);
  let feed = getTrainerReviewFeed(trainerId, {
    status: status === 'done' ? 'done' : status === 'waiting' ? 'waiting' : 'active',
    filterType: feedFilter,
    sort: 'priority',
  });

  const now = new Date().toISOString();
  const items: ReviewItem[] = feed.map((f) => {
    const dedupeKey = dedupeKeyForFeedItem(f);
    const overlay = getReviewItemOverlay(dedupeKey);
    const effectiveStatus: ReviewItemStatus =
      overlay?.status === 'done' ? 'done' : status === 'done' ? (f.status === 'reviewed' ? 'done' : 'active') : (f.status === 'needs_review' ? 'active' : 'done');
    return {
      id: f.id,
      trainerId,
      clientId: f.clientId ?? null,
      type: feedTypeToReviewType(f.type),
      status: effectiveStatus,
      dueAt: (f as { showDate?: string }).showDate ?? f.createdAt ?? null,
      priorityScore: f.priorityScore ?? 50,
      dedupeKey,
      metadata: {
        title: f.title,
        subtitle: f.subtitle,
        summaryLines: f.summaryLines,
        feedType: f.type,
        createdAt: f.createdAt,
      },
      createdAt: f.createdAt ?? now,
      updatedAt: overlay?.updatedAt ?? now,
    };
  });

  if (status === 'active') {
    return items.filter((i) => i.status === 'active').sort((a, b) => b.priorityScore - a.priorityScore);
  }
  if (status === 'done') {
    return items.filter((i) => i.status === 'done').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  return items.filter((i) => i.status === 'waiting').sort((a, b) => b.priorityScore - a.priorityScore);
}

export function getTopActiveReviewItem(trainerId: string): ReviewItem | null {
  const queue = getReviewQueue(trainerId, 'active', null);
  return queue.length > 0 ? queue[0] : null;
}

export interface ReviewQueueItemForUI {
  id: string;
  clientId: string | null;
  type: string;
  status: string;
  title: string;
  subtitle?: string | null;
  summaryLines: string[];
  priorityScore: number;
  createdAt: string;
  showDate?: string | null;
  dedupeKey: string;
}

export function getReviewQueueForUI(
  trainerId: string,
  status: ReviewItemStatus,
  filterType?: string | null
): ReviewQueueItemForUI[] {
  const queue = getReviewQueue(trainerId, status, filterType);
  return queue.map((item) => ({
    id: item.id,
    clientId: item.clientId,
    type: (item.metadata?.feedType as string) ?? item.type,
    status: item.status,
    title: (item.metadata?.title as string) ?? 'Item',
    subtitle: (item.metadata?.subtitle as string) ?? null,
    summaryLines: (item.metadata?.summaryLines as string[]) ?? [],
    priorityScore: item.priorityScore,
    createdAt: item.createdAt,
    showDate: item.dueAt,
    dedupeKey: item.dedupeKey,
  }));
}
