/**
 * Coaches marketing: business-value narrative focused on outcomes and workflow.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { Hero, Features, Testimonials, CTA } from './MarketingSections';
import { FOR_COACHES_TESTIMONIALS } from './marketingTestimonialsData';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors } from '@/ui/tokens';

const REPLACES = [
  {
    heading: 'Spreadsheets + notes',
    body: 'Program edits, check-in comments, and client decisions stay in one timeline instead of scattered docs.',
  },
  {
    heading: 'Messaging apps',
    body: 'Client conversations, context, and follow-ups stay tied to execution, not buried in random threads.',
  },
  {
    heading: 'Manual check-in chasing',
    body: 'Atlas centralizes submissions and review so you coach from signal, not from reminders and admin.',
  },
  {
    heading: 'Guesswork on who is slipping',
    body: 'Flags and trend insights show at-risk clients early, so retention actions happen before drop-off.',
  },
];

const OPERATING_FLOW = [
  {
    heading: '1) Build programs',
    body: 'Create and assign structured training plans quickly, then adjust blocks as clients progress.',
  },
  {
    heading: '2) Set nutrition',
    body: 'Set targets and nutrition direction inside the same system so training and food stay aligned.',
  },
  {
    heading: '3) Client execution in Today view',
    body: 'Clients open one clear daily view for workouts, nutrition, and required actions.',
  },
  {
    heading: '4) Check-ins + review workflow',
    body: 'Collect check-ins, review fast, and turn feedback into immediate next-step actions.',
  },
  {
    heading: '5) Messaging with context',
    body: 'Coach inside the thread with relevant history, not disconnected messages across multiple apps.',
  },
  {
    heading: '6) Flags + insights',
    body: 'See readiness, adherence, and trend signals so you can intervene early and keep results moving.',
  },
];

const COACHING_MODES = [
  {
    heading: 'Built for transformation coaching',
    body: 'Drive adherence with clear daily actions, structured accountability, and fast review loops that keep clients bought in.',
  },
  {
    heading: 'Built for competition prep',
    body: 'Run posing and prep workflows with tighter feedback cycles, cleaner status visibility, and better peak-week control.',
  },
];

const SWITCH_OUTCOMES = [
  'You recover coaching time every week by cutting admin loops.',
  'You hold tighter control of client quality as roster size grows.',
  'You reduce drop-off with earlier intervention on risk signals.',
  'You deliver a premium, structured experience clients stay for.',
];

const BUSINESS_OUTCOMES = [
  {
    heading: 'Retention',
    body: 'Better visibility and faster interventions keep more clients progressing month to month.',
  },
  {
    heading: 'Perceived value',
    body: 'A professional coaching system justifies your service level and reduces price objections.',
  },
  {
    heading: 'Scalability',
    body: 'Standardized workflows let you support more clients without adding chaos or burning out.',
  },
  {
    heading: 'Pricing power',
    body: 'When delivery quality is consistent and outcomes are clear, higher-ticket coaching is easier to sustain.',
  },
];

function ReplacementIntro() {
  return (
    <section className="px-4 pt-10 sm:pt-12 pb-2 text-center max-w-4xl mx-auto">
      <p className="text-[0.96rem] sm:text-base leading-relaxed" style={{ color: colors.muted }}>
        Atlas replaces your entire coaching stack so delivery, communication, and client control happen in one operating system.
      </p>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="px-4 py-14 sm:py-18 max-w-6xl mx-auto">
      <h2 className="text-[1.65rem] sm:text-3xl font-bold text-center mb-3 sm:mb-4 leading-tight" style={{ color: colors.text }}>
        How coaching runs inside Atlas
      </h2>
      <p className="text-center text-[0.95rem] sm:text-lg mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed" style={{ color: colors.muted }}>
        Every part of delivery stays connected so you can coach with speed, consistency, and control.
      </p>
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {OPERATING_FLOW.map((step) => (
          <article
            key={step.heading}
            className="rounded-2xl border p-5 sm:p-6"
            style={{ borderColor: colors.border, background: colors.surface1 }}
          >
            <h3 className="text-[1.02rem] sm:text-lg font-semibold mb-2.5 sm:mb-3 leading-snug" style={{ color: colors.text }}>
              {step.heading}
            </h3>
            <p className="text-[0.92rem] sm:text-base leading-relaxed" style={{ color: colors.muted }}>
              {step.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OutcomesListSection() {
  return (
    <section
      id="what-changes"
      className="px-4 py-14 sm:py-18 border-t"
      style={{ borderColor: colors.border, background: colors.surface }}
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="text-[1.65rem] sm:text-3xl font-bold text-center mb-8 sm:mb-10 leading-tight" style={{ color: colors.text }}>
          What changes when you switch
        </h2>
        <ul className="space-y-4 sm:space-y-5">
          {SWITCH_OUTCOMES.map((line) => (
            <li key={line} className="flex gap-3.5 items-start">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(59,130,246,0.2)' }}
                aria-hidden
              >
                <Check className="w-3.5 h-3.5" style={{ color: colors.primary }} strokeWidth={2.5} />
              </span>
              <span className="text-[0.98rem] sm:text-lg leading-snug" style={{ color: colors.text }}>
                {line}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function ForCoachesPage() {
  usePageMeta({
    title: 'Coaching Software for Online Fitness Coaches',
    description:
      'Run your coaching business without spreadsheets. Build programs, set nutrition, review check-ins, track clients, and grow your roster — all in one system.',
    canonical: 'https://atlasperformancelabs.co.uk/for-coaches',
  });

  return (
    <>
      <Hero
        title="Run your entire coaching business from one system"
        subtitle="Programs, nutrition, check-ins, messaging, and client tracking in one place, built for transformation and competition coaches who want to scale without chaos."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="See Pricing"
        secondaryCtaTo="/pricing"
      />
      <ReplacementIntro />
      <Features id="what-replaces" title="What this replaces" items={REPLACES} />
      <WorkflowSection />
      <Features
        title="Built for transformation and competition coaching"
        items={COACHING_MODES}
        gridClassName="grid gap-4 sm:gap-5 md:grid-cols-2 max-w-5xl mx-auto"
      />
      <OutcomesListSection />
      <Features title="Make more from every client" items={BUSINESS_OUTCOMES} />
      <Testimonials
        title="Built for real coaches"
        testimonials={FOR_COACHES_TESTIMONIALS}
      />
      <CTA
        title="Serious coaching needs a serious system"
        subtitle="Run delivery, communication, and client control in one place."
        primaryCtaLabel="Start Coaching"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="View Pricing"
        secondaryCtaTo="/pricing"
      />
    </>
  );
}
