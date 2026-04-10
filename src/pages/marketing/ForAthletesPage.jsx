/**
 * Personal marketing: emotional clarity, optional Enhanced guidance.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { Hero, Features, SocialProof, CTA } from './MarketingSections';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { colors } from '@/ui/tokens';

const FEELS_LIKE = [
  {
    heading: 'Always know what to do',
    body: 'Open your training and see clear next actions instead of guessing every session.',
  },
  {
    heading: 'Stay consistent',
    body: 'Logging, structure, and visible progress make it easier to keep showing up week after week.',
  },
  {
    heading: 'Upgrade only when ready',
    body: 'Start with Personal Basic free, then move to Enhanced when you want smarter guidance.',
  },
];

const STALL_REASONS = [
  'No clear plan for what to do each day',
  'Inconsistent logging and skipped feedback loops',
  'Too much guessing, not enough structure',
  'Changing direction every week without data',
];

const BASIC_ENHANCED = [
  {
    heading: 'Personal Basic (Free)',
    body: 'Logging, programs, and tracking for your training with full manual control.',
  },
  {
    heading: 'Personal Enhanced (£14.99)',
    body: 'Auto builder, smart suggestions, and guidance that helps you move faster with less guesswork.',
  },
];

function WhyProgressStallsSection() {
  return (
    <section className="px-4 py-14 sm:py-18 border-t" style={{ borderColor: colors.border, background: colors.surface }}>
      <div className="max-w-5xl mx-auto grid gap-5 md:grid-cols-2 md:gap-6">
        <article className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: colors.border, background: colors.surface1 }}>
          <h2 className="text-[1.28rem] sm:text-2xl font-bold mb-4 leading-tight" style={{ color: colors.text }}>
            Why most people don&apos;t progress
          </h2>
          <ul className="space-y-2.5">
            {STALL_REASONS.map((reason) => (
              <li key={reason} className="text-[0.95rem] sm:text-base leading-relaxed" style={{ color: colors.muted }}>
                • {reason}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: colors.border, background: colors.surface1 }}>
          <h3 className="text-[1.15rem] sm:text-xl font-semibold mb-3 leading-tight" style={{ color: colors.text }}>
            Atlas fixes that
          </h3>
          <p className="text-[0.95rem] sm:text-base leading-relaxed mb-4" style={{ color: colors.muted }}>
            You get one place for your plan, your logs, and your progress so decisions are based on what is actually happening.
          </p>
          <div className="space-y-2.5">
            {[
              'Clear training structure you can follow',
              'A consistent logging rhythm that keeps momentum',
              'Smarter guidance available when you want it',
            ].map((point) => (
              <p key={point} className="flex items-start gap-2.5 text-[0.95rem] sm:text-base leading-relaxed" style={{ color: colors.text }}>
                <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: colors.primary }} strokeWidth={2.5} />
                <span>{point}</span>
              </p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function ClickMomentSection() {
  return (
    <section className="px-4 py-14 sm:py-18 border-t" style={{ borderColor: colors.border }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-[1.55rem] sm:text-3xl font-bold mb-3 leading-tight" style={{ color: colors.text }}>
          The moment everything clicks
        </h2>
        <p className="text-[0.97rem] sm:text-lg leading-relaxed" style={{ color: colors.muted }}>
          Your training stops feeling random. You know what to do, you execute, and you can actually see progress building over time.
        </p>
      </div>
    </section>
  );
}

export default function ForAthletesPage() {
  return (
    <>
      <Hero
        title="Train properly, not randomly"
        subtitle="Log your training, follow a clear plan, and actually stay consistent. Start free, upgrade only when you want smarter guidance."
        primaryCtaLabel="Start free"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="See pricing"
        secondaryCtaTo="/pricing"
      />
      <Features title="What using Atlas actually feels like" items={FEELS_LIKE} />
      <WhyProgressStallsSection />
      <Features title="Basic vs Enhanced" items={BASIC_ENHANCED} gridClassName="grid gap-4 sm:gap-5 md:grid-cols-2 max-w-5xl mx-auto" />
      <ClickMomentSection />
      <SocialProof
        title="Why people stay with it"
        quote="I finally stopped winging it. I open Atlas, do the work, and stay on track."
      />
      <CTA
        title="Just start, you don&apos;t need to commit yet"
        subtitle="Use Personal Basic free. Upgrade to Enhanced only when you want smarter help."
        primaryCtaLabel="Start free"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="See pricing"
        secondaryCtaTo="/pricing"
      />
    </>
  );
}
