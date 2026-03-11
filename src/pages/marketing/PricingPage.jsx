/**
 * Pricing: hero, simple pricing copy, CTA.
 */
import React from 'react';
import { Hero, Features, CTA } from './MarketingSections';

const FEATURES = [
  { heading: 'Coaches', body: 'Pricing is set by your coach or studio. Ask them for details or start a free trial.' },
  { heading: 'Athletes', body: 'Access your program, check-ins, and messaging through your coach\'s plan.' },
];

export default function PricingPage() {
  return (
    <>
      <Hero
        title="Simple pricing"
        subtitle="Atlas is used by coaches and studios who set their own plans. Get started and invite your first client or connect with your coach."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo="/auth"
        secondaryCtaLabel="Train on Atlas"
        secondaryCtaTo="/auth"
      />
      <Features title="How it works" items={FEATURES} />
      <CTA
        title="Ready to start?"
        primaryCtaLabel="Start Coaching"
        primaryCtaTo="/auth"
        secondaryCtaLabel="Train on Atlas"
        secondaryCtaTo="/auth"
      />
    </>
  );
}
