/**
 * Optional route/component gate for beta-only features.
 * If the user cannot access the feature, renders fallback (default null) instead of children.
 * Use for selected features only; the app is never fully locked behind beta.
 */
import React from 'react';
import { useBetaFeature } from '@/components/hooks/useBetaFeature';

/**
 * @param {{ featureKey: string, children: React.ReactNode, fallback?: React.ReactNode }} props
 */
export default function RequireBetaFeature({ featureKey, children, fallback = null }) {
  const { allowed } = useBetaFeature(featureKey);
  return allowed ? children : fallback;
}
