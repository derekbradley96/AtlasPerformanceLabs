export type { QueueItem, QueueType, QueueStatus } from './types';
export { buildTrainerQueue, getActiveQueueCount, getActiveQueueItems, getTopActiveQueueItem } from './buildQueue';
export type { BuildTrainerQueueInput } from './buildQueue';
export { setQueueItemState, getQueueItemState, getEffectiveStatus } from './queueStateRepo';
export type { QueueItemState } from './queueStateRepo';
export { computePriorityScore } from './priority';
export type { PriorityContext } from './priority';
export { computeReviewPriorityScore, hasHighPriorityItems, AUTO_OPEN_PRIORITY_THRESHOLD } from '@/lib/intelligence/reviewPriority';

/** Legacy API (getReviewQueue, getReviewQueueForUI, getTopActiveReviewItem, markReviewItemDone, etc.): import from '@/lib/reviewQueueLegacy' to avoid pulling getTrainerReviewFeed into this barrel and potential init-order issues. */
