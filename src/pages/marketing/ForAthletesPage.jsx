/**
 * For athletes: hero, features, social proof, CTA (Train on Atlas).
 */
import React from 'react';
import { Hero, Features, SocialProof, CTA } from './MarketingSections';

const FEATURES = [
  { heading: 'Your program in one place', body: 'See today’s workout, follow your plan, and log sessions without switching apps.' },
  { heading: 'Weekly check-ins', body: 'Submit check-ins so your coach can adjust your plan and keep you on track.' },
  { heading: 'Message your coach', body: 'Ask questions and get feedback without leaving the app.' },
];

export default function ForAthletesPage() {
  return (
    <>
      <Hero
        title="Train with your coach, not the chaos"
        subtitle="One app for your program, check-ins, and messages. Built for athletes who want to show up."
        primaryCtaLabel="Train on Atlas"
        primaryCtaTo="/auth"
      />
      <Features title="What you get" items={FEATURES} />
      <SocialProof
        title="Athletes use Atlas to"
        quote="Stay on program and in touch with my coach. No more lost spreadsheets or missed check-ins."
        attribution="Athletes on Atlas"
      />
      <CTA
        title="Get started with your coach"
        primaryCtaLabel="Train on Atlas"
        primaryCtaTo="/auth"
      />
    </>
  );
}
