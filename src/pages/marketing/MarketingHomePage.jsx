/**
 * Marketing home: product-first narrative for coaches, clients, and serious personal users.
 */
import React, { useEffect } from 'react';
import { trackPage } from '@/lib/analytics';
import { Link } from 'react-router-dom';
import { Hero, CTA, AudienceSwitch } from './MarketingSections';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors } from '@/ui/tokens';

const WHAT_ATLAS_DOES = [
  {
    heading: 'For coaches',
    body: 'Build per-set programmes, review check-ins in 90 seconds with AI-drafted responses, flag at-risk clients before they cancel, and track exactly who needs you today.',
  },
  {
    heading: 'For clients',
    body: "See your coach's targets for every set. Scan barcodes to log food. Submit your check-in with progress photos. Everything your coach needs, in one tap.",
  },
  {
    heading: 'For personal users',
    body: 'Train to a real programme with progressive overload. Scan any barcode — free, always. Track macros with interpreted guidance, not raw numbers.',
  },
];

const BUILT_FOR = [
  {
    heading: 'Transformation coaching',
    body: 'Weekly check-in reviews, at-risk client alerts, macro adjustment queue, and a revenue forecast that tells you which clients might leave next month.',
  },
  {
    heading: 'Competition prep',
    body: 'Peak week protocol deployment, pose check submission and markup, division judging criteria, show day checklist, and a countdown strip for every athlete.',
  },
  {
    heading: 'Serious self-coaching',
    body: 'An adaptive programme that adjusts load based on your actual performance. Plateau detection with 3 specific fixes. Weekly effort score every Sunday.',
  },
];

const WHY_ATLAS = [
  {
    heading: 'No other app tracks RIR per set',
    body: 'Reps in reserve on every set tells your coach exactly how close to failure you trained. MFP, Trainerize, TrueCoach — none of them have this.',
  },
  {
    heading: 'Interpreted data, not raw numbers',
    body: "Atlas doesn't show you 142g protein and leave you guessing. It tells you: '33g short — try chicken or a shake before your evening session.'",
  },
  {
    heading: 'Start free, grow into it',
    body: 'Basic is free forever with 10% commission. Upgrade to Pro at 10 clients, Elite at 12. You never pay more than you earn.',
  },
];

const ROLE_VALUE = [
  {
    heading: 'Coach',
    points: ['Programs', 'Nutrition', 'Check-ins', 'Review Center', 'Messaging', 'Billing and roster control'],
  },
  {
    heading: 'Client',
    points: ['Today view', 'Nutrition targets', 'Check-ins', 'Messaging', 'Progress clarity'],
  },
  {
    heading: 'Personal',
    points: ['Free training tools', 'Tracking and logging', 'Programs, nutrition, and progress'],
  },
];

function ProductGrid({ title, subtitle, items }) {
  return (
    <section className="px-4 py-14 sm:py-18 md:py-20 max-w-6xl mx-auto">
      <h2 className="text-[1.65rem] sm:text-3xl font-bold text-center mb-3 sm:mb-4 leading-tight" style={{ color: colors.text }}>
        {title}
      </h2>
      {subtitle ? (
        <p className="text-center text-[0.95rem] sm:text-lg mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed" style={{ color: colors.muted }}>
          {subtitle}
        </p>
      ) : null}
      <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.heading}
            className="rounded-2xl border p-5 sm:p-6 md:p-7"
            style={{ borderColor: colors.border, background: colors.surface1 }}
          >
            <h3 className="text-[1.02rem] sm:text-lg font-semibold mb-2.5 sm:mb-3 leading-snug" style={{ color: colors.text }}>{item.heading}</h3>
            <p className="text-[0.92rem] sm:text-base leading-relaxed" style={{ color: colors.muted }}>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RoleValueSection() {
  return (
    <section className="px-4 py-14 sm:py-18 md:py-20 border-t" style={{ borderColor: colors.border, background: colors.surface }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[1.65rem] sm:text-3xl font-bold text-center mb-8 sm:mb-10 leading-tight" style={{ color: colors.text }}>
          One system, clear value for every side
        </h2>
        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {ROLE_VALUE.map((role) => (
            <article key={role.heading} className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: colors.border, background: colors.surface1 }}>
              <h3 className="text-[1.02rem] sm:text-lg font-semibold mb-3.5 sm:mb-4" style={{ color: colors.text }}>{role.heading}</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                {role.points.map((point) => (
                  <li key={point} className="text-[0.92rem] sm:text-base leading-relaxed" style={{ color: colors.muted }}>
                    • {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function MarketingHomePage() {
  usePageMeta({
    title: 'Bodybuilding coaching software — prep, programmes, free barcode scan',
    description:
      'Atlas: per-set programme targets, check-ins with AI-drafted coach replies, peak week, posing, and a free barcode scanner. Built for bodybuilding — not generic fitness.',
    canonical: 'https://atlasperformancelabs.co.uk/',
  });

  useEffect(() => {
    trackPage('marketing_home');
  }, []);

  return (
    <>
      <Hero
        audienceNav={<AudienceSwitch active="coach" />}
        eyebrow="Coaching, training and nutrition — done properly"
        title="Free barcode scanning. Competition prep built in. The coaching platform your competitors don't have."
        subtitle="Programs with per-set targets. Check-ins that become coaching evidence. Peak week tools. Posing library. And a barcode scanner that's always free — because MyFitnessPal shouldn't have put theirs behind a paywall."
        primaryCtaLabel="Start coaching — it's free"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="I train solo — start free →"
        secondaryCtaTo="/personal"
        screenshotSrc="mockup"
      />
      <div className="text-center -mt-2 sm:-mt-3 mb-7 sm:mb-8">
        <Link to="/pricing" className="text-sm font-medium underline-offset-4 hover:underline" style={{ color: colors.muted }}>
          See Pricing
        </Link>
      </div>

      <ProductGrid
        title="What Atlas does"
        subtitle="Concrete workflows for coaches, clients, and personal athletes — not a feature laundry list."
        items={WHAT_ATLAS_DOES}
      />

      <ProductGrid
        title="Built for transformation and competition coaching"
        subtitle="Every module exists because bodybuilding coaching demanded it — not because a generic fitness app needed another tab."
        items={BUILT_FOR}
      />

      <ProductGrid
        title="Why Atlas"
        subtitle="Differentiators your roster feels on week one — not slogans."
        items={WHY_ATLAS}
      />

      <RoleValueSection />

      {/* Testimonials removed until real user quotes obtained.
          See docs/TESTIMONIALS_TODO.md to re-add.
          Do NOT use placeholder names. */}

      <CTA
        title="Serious coaching needs a serious system"
        subtitle="Atlas gives coaches, clients, and serious personal users one place to execute with clarity."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="Start Free (Personal)"
        secondaryCtaTo={SIGNUP_PUBLIC_PATH}
      />
    </>
  );
}
