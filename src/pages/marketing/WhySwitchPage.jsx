import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hero } from './MarketingSections';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors, radii, spacing } from '@/ui/tokens';

const FEATURES = [
  {
    category: 'Nutrition',
    rows: [
      {
        feature: 'Barcode scanning',
        atlas: { value: 'Free forever', tick: true },
        mfp: { value: 'Premium only (£/mo)', tick: false },
        trainerize: { value: 'Basic', tick: true },
        truecoach: { value: 'None', tick: false },
        ptdistinction: { value: 'Basic', tick: true },
        mypthub: { value: 'Basic', tick: true },
        hexfit: { value: 'Yes', tick: true },
      },
      {
        feature: 'Interpreted data ("you\'re 33g short — try chicken")',
        atlas: { value: 'Yes — goal aware', tick: true },
        mfp: { value: 'Raw numbers only', tick: false },
        trainerize: { value: 'Raw numbers only', tick: false },
        truecoach: { value: 'None', tick: false },
        ptdistinction: { value: 'Basic', tick: false },
        mypthub: { value: 'Raw numbers only', tick: false },
        hexfit: { value: 'Basic', tick: false },
      },
      {
        feature: 'Coach can see client food diary live',
        atlas: { value: 'Yes — real-time', tick: true },
        mfp: { value: 'No coaching layer', tick: false },
        trainerize: { value: 'Limited', tick: false },
        truecoach: { value: 'No', tick: false },
        ptdistinction: { value: 'Yes', tick: true },
        mypthub: { value: 'Yes', tick: true },
        hexfit: { value: 'Yes', tick: true },
      },
      {
        feature: 'Macro adjustment suggestions (AI-driven)',
        atlas: { value: 'Yes — one-tap approval', tick: true },
        mfp: { value: 'No', tick: false },
        trainerize: { value: 'No', tick: false },
        truecoach: { value: 'No', tick: false },
        ptdistinction: { value: 'No', tick: false },
        mypthub: { value: 'No', tick: false },
        hexfit: { value: 'No', tick: false },
      },
    ],
  },
  {
    category: 'Bodybuilding & Comp Prep',
    rows: [
      {
        feature: 'Competition prep tools (peak week, posing)',
        atlas: { value: 'Built in — all divisions', tick: true },
        mfp: { value: 'None', tick: false },
        trainerize: { value: 'None', tick: false },
        truecoach: { value: 'None', tick: false },
        ptdistinction: { value: 'None', tick: false },
        mypthub: { value: 'None', tick: false },
        hexfit: { value: 'None', tick: false },
      },
      {
        feature: 'RIR (reps in reserve) tracking',
        atlas: { value: 'Yes — per set', tick: true },
        mfp: { value: 'No', tick: false },
        trainerize: { value: 'No', tick: false },
        truecoach: { value: 'No', tick: false },
        ptdistinction: { value: 'No', tick: false },
        mypthub: { value: 'No', tick: false },
        hexfit: { value: 'No', tick: false },
      },
      {
        feature: 'Pose library with judging criteria',
        atlas: { value: 'Yes — all federations', tick: true },
        mfp: { value: 'None', tick: false },
        trainerize: { value: 'None', tick: false },
        truecoach: { value: 'None', tick: false },
        ptdistinction: { value: 'None', tick: false },
        mypthub: { value: 'None', tick: false },
        hexfit: { value: 'None', tick: false },
      },
      {
        feature: 'Tempo training (3-1-1 metronome)',
        atlas: { value: 'Yes — live timer', tick: true },
        mfp: { value: 'None', tick: false },
        trainerize: { value: 'No', tick: false },
        truecoach: { value: 'No', tick: false },
        ptdistinction: { value: 'No', tick: false },
        mypthub: { value: 'No', tick: false },
        hexfit: { value: 'Basic', tick: false },
      },
    ],
  },
  {
    category: 'Coaching workflow',
    rows: [
      {
        feature: 'Check-in review with AI draft response',
        atlas: { value: 'Yes — one-tap send', tick: true },
        mfp: { value: 'No coaching layer', tick: false },
        trainerize: { value: 'Manual only', tick: false },
        truecoach: { value: 'Yes — manual', tick: true },
        ptdistinction: { value: 'Yes — manual', tick: true },
        mypthub: { value: 'Yes — manual', tick: true },
        hexfit: { value: 'Yes — manual', tick: true },
      },
      {
        feature: 'Churn prediction (at-risk client alerts)',
        atlas: { value: 'Yes — 2-3 weeks early', tick: true },
        mfp: { value: 'None', tick: false },
        trainerize: { value: 'No', tick: false },
        truecoach: { value: 'No', tick: false },
        ptdistinction: { value: 'No', tick: false },
        mypthub: { value: 'No', tick: false },
        hexfit: { value: 'No', tick: false },
      },
      {
        feature: 'Coach commission model (start free)',
        atlas: { value: 'Free + 10% (upgrade anytime)', tick: true },
        mfp: { value: 'No coaching product', tick: false },
        trainerize: { value: 'From £19/mo', tick: true },
        truecoach: { value: 'From $19/mo', tick: true },
        ptdistinction: { value: 'From $19/mo', tick: true },
        mypthub: { value: 'From £13/mo', tick: true },
        hexfit: { value: 'From €39/mo', tick: true },
      },
      {
        feature: 'Live programme edits notify client instantly',
        atlas: { value: 'Yes — real-time', tick: true },
        mfp: { value: 'No', tick: false },
        trainerize: { value: 'No', tick: false },
        truecoach: { value: 'No', tick: false },
        ptdistinction: { value: 'No', tick: false },
        mypthub: { value: 'No', tick: false },
        hexfit: { value: 'No', tick: false },
      },
    ],
  },
];

const COMPETITORS = ['atlas', 'mfp', 'trainerize', 'truecoach', 'ptdistinction', 'mypthub', 'hexfit'];

const COMP_LABELS = {
  atlas: 'Atlas',
  mfp: 'MyFitnessPal',
  trainerize: 'Trainerize',
  truecoach: 'TrueCoach',
  ptdistinction: 'PT Distinction',
  mypthub: 'MyPTHub',
  hexfit: 'Hexfit',
};

const COMPETITOR_DETAILS = {
  mfp: {
    name: 'MyFitnessPal',
    tagline: 'Built for casual dieting. Not for bodybuilders.',
    verdict:
      'MFP is the world\'s biggest calorie counter. It\'s also going backwards. Barcode scanning went behind a paywall in 2022. The API was closed. New features stopped. If you\'re tracking macros for a physique goal, you\'re using a tool that hasn\'t improved in years — and now charges for features that used to be free.',
    theyWin: [
      'Larger food database (14m+ items)',
      'More widely recognised brand',
      'Restaurant meal database',
    ],
    weWin: [
      'Barcode scanning is free — always',
      'We know what RIR means',
      'Your food diary connects to your coach',
      'Macro targets are goal-aware, not generic',
      'Competition prep built in — peak week, posing, federations',
      'Your data is interpreted, not just displayed',
    ],
    switchCta: 'Import your MFP diary →',
    switchTo: '/import/mfp',
    switchDetail:
      'Export your MFP food diary as CSV and import it into Atlas in under 2 minutes. Your history comes with you.',
  },
  trainerize: {
    name: 'Trainerize',
    tagline: 'Good for general PT. Not built for bodybuilding.',
    verdict:
      'Trainerize is a solid general personal training platform. But it was built for gym-floor PTs, not online bodybuilding coaches. There\'s no RIR tracking, no comp prep workflow, no pose library, and no intelligence layer that flags which clients are about to quit. At £19/mo minimum with no free tier, new coaches pay before they\'ve earned anything.',
    theyWin: [
      'Established brand with large user base',
      'Strong exercise video library',
      'Better calendar/scheduling features',
      'Zapier integrations',
    ],
    weWin: [
      'Free to start — pay commission only when clients pay you',
      'Competition prep, posing, peak week built in',
      'RIR and tempo tracking per set',
      'Churn prediction alerts you 2-3 weeks before a client leaves',
      'AI-drafted check-in responses save hours per week',
      'Pillar rating system for your marketplace profile',
    ],
    switchCta: null,
    switchDetail: null,
  },
  truecoach: {
    name: 'TrueCoach',
    tagline: 'Clean product. Missing everything bodybuilding needs.',
    verdict:
      'TrueCoach has a clean, well-designed interface and good client communication tools. But it has no nutrition tracking beyond basic logging, no bodybuilding-specific features, and no intelligence layer. It\'s a programme delivery tool, not a coaching operating system. At $19/mo minimum with no commission-based starter plan, the economics don\'t favour new coaches.',
    theyWin: ['Very clean, minimal UI', 'Good video coaching tools', 'Strong mobile app experience'],
    weWin: [
      'Nutrition tracking with barcode scanner (free)',
      'Competition prep and bodybuilding workflows',
      'Churn prediction and roster intelligence',
      'Free starter plan — commission only',
      'Check-in AI drafts and macro adjustment engine',
    ],
    switchCta: null,
    switchDetail: null,
  },
  ptdistinction: {
    name: 'PT Distinction',
    tagline: 'Feature-rich but complex and expensive.',
    verdict:
      'PT Distinction has more features than most competitors, including nutrition coaching and client portals. But it\'s complex to set up, the UI shows its age, and at $19/mo it assumes you\'re already profitable. For competition prep coaches, it has nothing specific to bodybuilding — no posing tools, no peak week management, no RIR tracking.',
    theyWin: [
      'More integrations and automations',
      'Longer track record',
      'Stronger habit tracking',
      'Better invoice and contracts features',
    ],
    weWin: [
      'Built specifically for bodybuilding and physique sport',
      'Competition prep tools no competitor has',
      'Free to start with commission model',
      'Cleaner, faster mobile experience',
      'AI-driven coaching intelligence',
    ],
    switchCta: null,
    switchDetail: null,
  },
  mypthub: {
    name: 'MyPTHub',
    tagline: 'UK-based and affordable — but generic.',
    verdict:
      'MyPTHub is UK-built, affordable, and covers the basics well. For a generalist PT it\'s a reasonable choice. But for bodybuilding coaches and athletes, it\'s generic through and through — no posing library, no RIR, no peak week tools, no comp prep. It\'s also subscription-only from day one, which disadvantages coaches just starting out.',
    theyWin: [
      'Very affordable at £13/mo',
      'Good UK customer support',
      'Simpler interface for non-technical coaches',
    ],
    weWin: [
      'Free to start (commission model)',
      'Competition prep tools — complete and specific',
      'RIR, tempo, superset tracking',
      'Interpreted data — not raw numbers',
      'AI coaching intelligence built in',
    ],
    switchCta: null,
    switchDetail: null,
  },
  hexfit: {
    name: 'Hexfit',
    tagline: 'European platform. Functional but generic.',
    verdict:
      'Hexfit is a solid European coaching platform with decent nutrition tools and a clean interface. But like all general fitness platforms, it has no concept of bodybuilding specifics — no posing, no peak week, no RIR. At €39/mo minimum it\'s the most expensive option in this comparison, with no free tier.',
    theyWin: [
      'Strong in European markets',
      'Good multi-language support',
      'Clean nutrition interface',
    ],
    weWin: [
      'Built for bodybuilding and physique sport',
      'Free to start with commission model',
      'Competition prep, posing, peak week',
      'UK/European federation coverage (PCA, UKBFF, NABBA, WBFF)',
      'Pillar rating marketplace for finding coaches',
    ],
    switchCta: null,
    switchDetail: null,
  },
};

export default function WhySwitchPage() {
  usePageMeta({
    title: 'Why Switch to Atlas from MyFitnessPal, Trainerize or TrueCoach',
    description:
      'Free barcode scanning. Competition prep built in. AI check-in responses. See how Atlas compares to every major coaching platform — and why bodybuilders choose us.',
    canonical: 'https://atlasperformancelabs.co.uk/why-switch',
  });

  const [activeTab, setActiveTab] = useState('mfp');
  const detail = COMPETITOR_DETAILS[activeTab];

  return (
    <>
      <Hero
        eyebrow="Why coaches and athletes are switching"
        title="You've outgrown your current app."
        subtitle="Generic apps built for general fitness weren't designed for bodybuilding, competition prep, or serious coaching. Atlas was."
        primaryCtaLabel="Start free — no card needed"
        primaryCtaTo={SIGNUP_PUBLIC_PATH}
        secondaryCtaLabel="Import from MyFitnessPal"
        secondaryCtaTo="/import/mfp"
      />

      <section style={{ padding: `${spacing[20]}px ${spacing[16]}px` }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: colors.text,
            marginBottom: spacing[8],
          }}
        >
          How Atlas compares
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: colors.muted,
            marginBottom: spacing[20],
            fontSize: 15,
          }}
        >
          Honest comparison. We&apos;re not for everyone — but if you&apos;re serious about bodybuilding or running a coaching business, nothing else comes close.
        </p>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: spacing[12],
                    fontSize: 12,
                    color: colors.muted,
                    borderBottom: `1px solid ${colors.border}`,
                    width: 240,
                  }}
                >
                  Feature
                </th>
                {COMPETITORS.map((key) => (
                  <th
                    key={key}
                    style={{
                      textAlign: 'center',
                      padding: spacing[12],
                      fontSize: 12,
                      fontWeight: key === 'atlas' ? 700 : 500,
                      color: key === 'atlas' ? colors.primary : colors.muted,
                      borderBottom: `1px solid ${colors.border}`,
                      background: key === 'atlas' ? colors.primarySubtle : 'transparent',
                      minWidth: 100,
                    }}
                  >
                    {COMP_LABELS[key]}
                    {key === 'atlas' ? (
                      <span style={{ display: 'block', fontSize: 9, color: colors.primary }}>← YOU&apos;RE HERE</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(({ category, rows }) => (
                <React.Fragment key={category}>
                  <tr>
                    <td
                      colSpan={COMPETITORS.length + 1}
                      style={{
                        padding: `${spacing[12]}px ${spacing[12]}px ${spacing[6]}px`,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        color: colors.primary,
                        background: colors.surface1,
                      }}
                    >
                      {category}
                    </td>
                  </tr>
                  {rows.map((row, i) => (
                    <tr
                      key={`${category}-${row.feature}`}
                      style={{
                        background: i % 2 === 0 ? 'transparent' : colors.surface1,
                      }}
                    >
                      <td
                        style={{
                          padding: spacing[12],
                          fontSize: 13,
                          color: colors.text,
                          borderBottom: `0.5px solid ${colors.border}`,
                        }}
                      >
                        {row.feature}
                      </td>
                      {COMPETITORS.map((key) => {
                        const cell = row[key];
                        return (
                          <td
                            key={key}
                            style={{
                              textAlign: 'center',
                              padding: spacing[12],
                              borderBottom: `0.5px solid ${colors.border}`,
                              background: key === 'atlas' ? `${colors.primary}08` : 'transparent',
                            }}
                          >
                            {cell.tick ? (
                              <div>
                                <span style={{ fontSize: 16, color: key === 'atlas' ? colors.primary : colors.success }}>✓</span>
                                {key === 'atlas' ? (
                                  <div style={{ fontSize: 10, color: colors.primary, marginTop: 2 }}>{cell.value}</div>
                                ) : null}
                              </div>
                            ) : (
                              <div>
                                <span style={{ fontSize: 14, color: colors.danger }}>×</span>
                                {cell.value !== 'No' && cell.value !== 'None' ? (
                                  <div style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>{cell.value}</div>
                                ) : null}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: colors.muted, marginTop: spacing[12] }}>
          Feature data based on publicly available information. Last reviewed April 2026.
        </p>
        <p style={{ textAlign: 'center', fontSize: 11, color: colors.muted, marginTop: spacing[6] }}>
          Comparison based on publicly available information as of April 2026. Feature availability may vary by plan and region. We&apos;ve tried to be fair — if anything is wrong, email us.
        </p>
      </section>

      <section style={{ padding: `${spacing[20]}px ${spacing[16]}px`, maxWidth: 900, margin: '0 auto' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: 26,
            fontWeight: 700,
            color: colors.text,
            marginBottom: spacing[20],
          }}
        >
          Coming from a specific app?
        </h2>

        <div
          style={{
            display: 'flex',
            gap: spacing[6],
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: spacing[24],
          }}
        >
          {Object.entries(COMPETITOR_DETAILS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                padding: `${spacing[8]}px ${spacing[14]}px`,
                borderRadius: radii.full,
                border: `1px solid ${key === activeTab ? colors.primary : colors.border}`,
                background: key === activeTab ? colors.primarySubtle : 'transparent',
                color: key === activeTab ? colors.primary : colors.muted,
                fontSize: 13,
                fontWeight: key === activeTab ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div
          style={{
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.lg,
            padding: spacing[24],
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: colors.muted,
              margin: 0,
            }}
          >
            vs {detail.name}
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: `${spacing[6]}px 0` }}>{detail.tagline}</p>
          <p
            style={{
              fontSize: 14,
              color: colors.muted,
              lineHeight: 1.6,
              marginBottom: spacing[20],
            }}
          >
            {detail.verdict}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: spacing[16] }}>
            <div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.muted,
                  marginBottom: spacing[10],
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                Where {detail.name} wins
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {detail.theyWin.map((item, i) => (
                  <li
                    key={`${detail.name}-win-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing[8],
                      marginBottom: spacing[6],
                    }}
                  >
                    <span style={{ color: colors.muted, marginTop: 1 }}>○</span>
                    <span style={{ fontSize: 13, color: colors.muted }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.primary,
                  marginBottom: spacing[10],
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                Why Atlas wins for you
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {detail.weWin.map((item, i) => (
                  <li
                    key={`${detail.name}-atlas-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing[8],
                      marginBottom: spacing[6],
                    }}
                  >
                    <span style={{ color: colors.primary, marginTop: 1, fontWeight: 700 }}>✓</span>
                    <span style={{ fontSize: 13, color: colors.text }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {detail.switchCta ? (
            <div
              style={{
                marginTop: spacing[20],
                padding: spacing[16],
                background: colors.primarySubtle,
                borderRadius: radii.md,
                border: `1px solid ${colors.primary}40`,
              }}
            >
              <p style={{ fontSize: 14, color: colors.text, margin: 0, marginBottom: spacing[8] }}>{detail.switchDetail}</p>
              <Link
                to={detail.switchTo}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing[6],
                  padding: `${spacing[10]}px ${spacing[16]}px`,
                  background: colors.primary,
                  color: '#fff',
                  borderRadius: radii.md,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {detail.switchCta} →
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        style={{
          textAlign: 'center',
          padding: `${spacing[20]}px ${spacing[16]}px`,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: colors.text,
            marginBottom: spacing[8],
          }}
        >
          Ready to train with a platform that actually understands your sport?
        </h2>
        <p
          style={{
            fontSize: 15,
            color: colors.muted,
            maxWidth: 520,
            margin: `0 auto ${spacing[20]}px`,
          }}
        >
          Free to start. No card required. Import your data from wherever you are now.
        </p>
        <div style={{ display: 'flex', gap: spacing[12], justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to={SIGNUP_PUBLIC_PATH}
            style={{
              padding: `${spacing[12]}px ${spacing[24]}px`,
              background: colors.primary,
              color: '#fff',
              borderRadius: radii.full,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Start free
          </Link>
          <Link
            to="/import/mfp"
            style={{
              padding: `${spacing[12]}px ${spacing[24]}px`,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              borderRadius: radii.full,
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Import from MyFitnessPal
          </Link>
          <Link
            to="/pricing"
            style={{
              padding: `${spacing[12]}px ${spacing[24]}px`,
              color: colors.muted,
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            See pricing →
          </Link>
        </div>
      </section>
    </>
  );
}
