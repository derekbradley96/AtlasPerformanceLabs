/**
 * Marketing home: hero, features, social proof, waitlist form, CTA.
 */
import React from 'react';
import { Hero, Features, SocialProof, CTA } from './MarketingSections';
import WaitlistForm from './WaitlistForm';

const FEATURES = [
  { heading: 'Programs & check-ins', body: 'Build programs, assign to clients, and review weekly check-ins in one place.' },
  { heading: 'Messaging', body: 'Stay in touch with clients and athletes without leaving the app.' },
  { heading: 'Progress & analytics', body: 'Track compliance, momentum, and retention so you can focus on what matters.' },
];

export default function MarketingHomePage() {
  return (
    <>
      <Hero
        title="The coaching platform that scales with you"
        subtitle="Programs, check-ins, messaging, and analytics for coaches and athletes. One place to train, track, and grow."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo="/auth"
        secondaryCtaLabel="Train on Atlas"
        secondaryCtaTo="/auth"
      />
      <Features title="Why Atlas" items={FEATURES} />
      <SocialProof
        title="Trusted by coaches"
        quote="Atlas keeps my clients accountable and my programs in one place."
        attribution="Coach"
      />
      <WaitlistForm />
      <CTA
        title="Ready to get started?"
        subtitle="Create your account and invite your first athlete or coach."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo="/auth"
        secondaryCtaLabel="Train on Atlas"
        secondaryCtaTo="/auth"
      />
    </>
  );
}
