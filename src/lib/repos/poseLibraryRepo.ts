/**
 * Pose library repository. In-memory from seeded data; swap to API later.
 */
import type { Pose, PoseId } from '@/lib/models/poseLibrary';
import { poseLibraryData } from '@/lib/data/poseLibraryData';

export function getAllPoses(): Pose[] {
  if (poseLibraryData == null || typeof poseLibraryData !== 'object') return [];
  return Object.values(poseLibraryData);
}

export function getPoseById(poseId: PoseId): Pose | null {
  if (poseLibraryData == null) return null;
  return poseLibraryData[poseId] ?? null;
}
