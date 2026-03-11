/**
 * For coaches: hero, features, social proof, CTA (Start Coaching).
 */
import React from 'react';
import { Hero, Features, SocialProof, CTA } from './MarketingSections';

const FEATURES = [
  { heading: 'Program builder', body: 'Create blocks, weeks, and days. Assign to clients and adjust from check-in review.' },
  { heading: 'Review center', body: 'See check-ins and pose checks in one queue. Add notes and adjust plans without the back-and-forth.' },
  { heading: 'Client health', body: 'Spot at-risk clients and overdue check-ins so you can reach out before they drop off.' },
];

export default function ForCoachesPage() {
  return (
    <>
      <Hero
        title="Built for coaches who run the show"
        subtitle="Programs, check-ins, messaging, and retention tools. Less admin, more coaching."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo="/auth"
      />
      <Features title="What you get" items={FEATURES} />
      <SocialProof
        title="Coaches use Atlas to"
        quote="Keep programs and check-ins in one place so I can focus on my athletes, not spreadsheets."
        attribution="Transformation & competition prep coaches"
      />
      <CTA
        title="Start coaching on Atlas"
        primaryCtaLabel="Start Coaching"
        primaryCtaTo="/auth"
      />
    </>
  );
}
