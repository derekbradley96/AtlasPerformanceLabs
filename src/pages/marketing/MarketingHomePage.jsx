/**
 * Marketing home: product-first narrative for coaches, clients, and serious personal users.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Hero, SocialProof, CTA } from './MarketingSections';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { colors } from '@/ui/tokens';

const WHAT_ATLAS_DOES = [
  {
    heading: 'For coaches',
    body: 'Build programs, set nutrition, review check-ins, message clients, and run your roster from one control center.',
  },
  {
    heading: 'For clients',
    body: 'Know exactly what to do today, where to submit, and how to message your coach without confusion.',
  },
  {
    heading: 'For personal users',
    body: 'Train free with manual tools, log progress properly, then upgrade for smarter guidance when it is worth it.',
  },
];

const BUILT_FOR = [
  {
    heading: 'Transformation coaching',
    body: 'Drive accountability with clear compliance, weekly review cadence, and action-first follow-up.',
  },
  {
    heading: 'Competition prep',
    body: 'Manage posing, check-ins, prep feedback, and peak week control in one serious workflow.',
  },
  {
    heading: 'Serious self-coaching',
    body: 'Use real structure, not guesswork: training logs, nutrition targets, readiness, and progress trends.',
  },
];

const WHY_ATLAS = [
  {
    heading: 'Run more clients without losing control',
    body: 'Atlas keeps coaching actions visible so scale does not turn into inbox chaos.',
  },
  {
    heading: 'Review what matters faster',
    body: 'Check-ins, unread messages, payment issues, and at-risk clients land in one priority queue.',
  },
  {
    heading: 'Built for transformation and prep',
    body: 'From lifestyle clients to competition prep, Atlas matches how high-accountability coaching really runs.',
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
    points: ['Free manual training tools', 'Tracking and logging', 'Enhanced upgrade for smart builder and guidance'],
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
  return (
    <>
      <Hero
        eyebrow="Atlas Performance Labs"
        title="The coaching system built for serious transformation and competition results"
        subtitle="Programs, nutrition, check-ins, messaging, review workflows, and progress tracking in one system for coaches, clients, and self-coached users."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="Start Free (Personal)"
        secondaryCtaTo={SIGNUP_PUBLIC_PATH}
      />
      <div className="text-center -mt-2 sm:-mt-3 mb-7 sm:mb-8">
        <Link to="/pricing" className="text-sm font-medium underline-offset-4 hover:underline" style={{ color: colors.muted }}>
          See Pricing
        </Link>
      </div>

      <ProductGrid
        title="What Atlas does"
        subtitle="Atlas removes tool sprawl and keeps execution clear from day one."
        items={WHAT_ATLAS_DOES}
      />

      <ProductGrid
        title="Built for transformation and competition coaching"
        subtitle="Not generic fitness software. Atlas is built around adherence, accountability, and high-stakes prep."
        items={BUILT_FOR}
      />

      <ProductGrid
        title="Why Atlas"
        subtitle="Specific advantages for coaches and clients who care about real outcomes."
        items={WHY_ATLAS}
      />

      <RoleValueSection />

      <SocialProof
        title="What coaches say"
        quote="I stopped juggling five tools and started coaching faster. Atlas shows me exactly who needs action each day."
        attribution="Transformation coach"
      />

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
