import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { buildDiscoverUrl } from '@/lib/marketplaceScreenState';

/**
 * Personal tiers were retired, which left this page a single-option "choose your
 * coach matching level" chooser — pure friction between the coach CTA and the
 * marketplace, with stale tier framing. It now redirects straight to coach
 * discovery, preserving the entry source so /discover keeps its contextual hero.
 * The route + all `buildPersonalCoachTierSelectionUrl(...)` entry points still work;
 * they just land on /discover instead of a redundant interstitial.
 */
export default function PersonalCoachTierSelectionPage() {
  const [searchParams] = useSearchParams();
  const source = String(searchParams.get('source') || 'from_general_discovery');
  return <Navigate to={buildDiscoverUrl({ source })} replace />;
}
