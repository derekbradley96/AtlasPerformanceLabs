/**
 * Marketing for coached athletes and clients: one execution loop with your coach.
 */
import React from 'react';
import { Hero, Features, Testimonials, CTA } from './MarketingSections';
import { FOR_CLIENTS_TESTIMONIALS } from './marketingTestimonialsData';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';

const CLIENT_FEATURES = [
  {
    heading: 'Your workout, exactly as your coach wrote it',
    body: 'Per-set weight and RIR targets beside your input — so every set matches the prescription.',
  },
  {
    heading: 'Barcode scanner — free, always',
    body: 'Scan any packaged food in seconds and stay on your macro plan without another subscription.',
  },
  {
    heading: 'Check-in in 3 minutes',
    body: 'Photo, weight, notes, submit. Your coach sees it instantly and can respond in the same thread.',
  },
  {
    heading: 'Progress that means something',
    body: 'Atlas turns the scale into a sentence: “Down 0.6kg this week — on track for your goal.” Not just a number.',
  },
  {
    heading: 'Competition prep built in',
    body: 'For athletes in prep: show countdown, posing timer, peak week protocol, and a first-timer guide when you need it.',
  },
];

const SHOULDNT_FEEL_LIKE = [
  {
    heading: 'Confusing check-ins',
    body: 'You should not wonder where to submit updates or what your coach wants.',
  },
  {
    heading: 'Scattered messages',
    body: 'Coaching guidance should not be buried across random apps and threads.',
  },
  {
    heading: 'No clear daily focus',
    body: 'Training works better when you know exactly what to do today.',
  },
];

export default function ForClientsPage() {
  usePageMeta({
    title: 'For athletes and clients — train and check in with your coach in Atlas',
    description:
      "Your coach's per-set targets, free barcode scanning, 3-minute check-ins, interpreted progress, and prep tools — one app, one loop.",
    canonical: 'https://atlasperformancelabs.co.uk/for-clients',
  });

  return (
    <>
      <Hero
        title="Your coach assigns it. You execute it. Atlas keeps the loop clean."
        subtitle="Programs with your coach's targets for every set. Nutrition tracking with a free barcode scanner. Check-ins that take 3 minutes. Progress that's interpreted, not just logged."
        primaryCtaLabel="Get started"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="See pricing"
        secondaryCtaTo="/pricing"
      />

      <Features title="What you get in the athlete app" items={CLIENT_FEATURES} />

      <Features title="Coaching shouldn&apos;t feel like this" items={SHOULDNT_FEEL_LIKE} />

      <Testimonials title="What athletes say" testimonials={FOR_CLIENTS_TESTIMONIALS} />

      <CTA
        title="Train with clarity, not confusion"
        subtitle="One system with your coach so every week has a clear direction — from the gym floor to check-in day."
        primaryCtaLabel="Get started"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="View pricing"
        secondaryCtaTo="/pricing"
      />
    </>
  );
}
