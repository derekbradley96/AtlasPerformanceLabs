/**
 * Marketplace: hero, features, CTA to discover coaches or start coaching.
 */
import React from 'react';
import { Hero, Features, CTA } from './MarketingSections';

const FEATURES = [
  { heading: 'Find a coach', body: 'Browse coaches on Atlas and start training with a program built for you.' },
  { heading: 'List your practice', body: 'Coaches can list their services so athletes can find and hire them.' },
];

export default function MarketplacePage() {
  return (
    <>
      <Hero
        title="Find your coach or your next athlete"
        subtitle="Discover coaches on Atlas or list your practice and grow your roster."
        primaryCtaLabel="Find a coach"
        primaryCtaTo="/auth"
        secondaryCtaLabel="Start Coaching"
        secondaryCtaTo="/auth"
      />
      <Features title="Marketplace" items={FEATURES} />
      <CTA
        title="Get started"
        primaryCtaLabel="Train on Atlas"
        primaryCtaTo="/auth"
        secondaryCtaLabel="Start Coaching"
        secondaryCtaTo="/auth"
      />
    </>
  );
}
