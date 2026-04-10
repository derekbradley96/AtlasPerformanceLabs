/**
 * Client marketing page: clear client experience and coaching value.
 */
import React from 'react';
import { Hero, Features, CTA } from './MarketingSections';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { colors } from '@/ui/tokens';

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

const FEELS_LIKE = [
  {
    heading: 'Clear daily direction',
    body: 'Your Today view shows training, nutrition, and actions in one place.',
  },
  {
    heading: 'Fast coach feedback',
    body: 'You submit updates and get responses in the same system, without friction.',
  },
  {
    heading: 'Visible progress',
    body: 'You can see trends and momentum instead of guessing if things are working.',
  },
];

const HOW_IT_WORKS = [
  {
    heading: '1) Follow your plan',
    body: 'Open Atlas and execute the program your coach assigned.',
  },
  {
    heading: '2) Hit your nutrition targets',
    body: 'Track your intake against clear goals so adherence stays realistic.',
  },
  {
    heading: '3) Submit check-ins',
    body: 'Share updates consistently so your coach can review and adjust fast.',
  },
  {
    heading: '4) Keep momentum',
    body: 'Message your coach, act on feedback, and keep progress moving week to week.',
  },
];

const BENEFITS = [
  {
    heading: 'More consistency',
    body: 'Structure removes decision fatigue and keeps your training week stable.',
  },
  {
    heading: 'Better accountability',
    body: 'You know what is expected, and your coach sees what needs attention quickly.',
  },
  {
    heading: 'Better results',
    body: 'Clear execution plus faster adjustments improves the quality of your progress.',
  },
];

export default function ForClientsPage() {
  return (
    <>
      <Hero
        title="Coaching that actually keeps you on track"
        subtitle="Follow your plan, submit check-ins, and get clear feedback in one place so progress feels consistent, not chaotic."
        primaryCtaLabel="Start now"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="See pricing"
        secondaryCtaTo="/pricing"
      />

      <Features title="Coaching shouldn&apos;t feel like this" items={SHOULDNT_FEEL_LIKE} />

      <section className="px-4 py-14 sm:py-18 border-t" style={{ borderColor: colors.border, background: colors.surface }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[1.65rem] sm:text-3xl font-bold text-center mb-3 sm:mb-4 leading-tight" style={{ color: colors.text }}>
            What Atlas feels like
          </h2>
          <p className="text-center text-[0.95rem] sm:text-lg mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed" style={{ color: colors.muted }}>
            One clear flow for your training and communication so you can focus on execution.
          </p>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {FEELS_LIKE.map((item) => (
              <article key={item.heading} className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: colors.border, background: colors.surface1 }}>
                <h3 className="text-[1.02rem] sm:text-lg font-semibold mb-2.5 sm:mb-3 leading-snug" style={{ color: colors.text }}>
                  {item.heading}
                </h3>
                <p className="text-[0.92rem] sm:text-base leading-relaxed" style={{ color: colors.muted }}>
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Features title="How it works" items={HOW_IT_WORKS} gridClassName="grid gap-4 sm:gap-5 md:grid-cols-2 max-w-5xl mx-auto" />
      <Features title="Benefits" items={BENEFITS} />

      <CTA
        title="Train with clarity, not confusion"
        subtitle="Use one system with your coach so every week has a clear direction."
        primaryCtaLabel="Get started"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="View pricing"
        secondaryCtaTo="/pricing"
      />
    </>
  );
}
