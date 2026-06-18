/**
 * Public marketing: Privacy Policy (UK GDPR / app store compliance).
 */
import React from 'react';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors, spacing } from '@/ui/tokens';

const LAST_UPDATED = '1 May 2026';

const articleStyle = {
  maxWidth: 720,
  marginLeft: 'auto',
  marginRight: 'auto',
  paddingLeft: spacing[16],
  paddingRight: spacing[16],
  paddingTop: spacing[24],
  paddingBottom: spacing[32],
  color: colors.text,
  fontSize: 15,
  lineHeight: 1.65,
};

function H2({ children }) {
  return (
    <h2
      className="text-lg font-semibold mt-10 mb-3 first:mt-0"
      style={{ color: colors.text }}
    >
      {children}
    </h2>
  );
}

function P({ children }) {
  return <p className="mb-4" style={{ color: colors.muted }}>{children}</p>;
}

function Ul({ items }) {
  return (
    <ul className="list-disc pl-5 mb-4 space-y-2" style={{ color: colors.muted }}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
  usePageMeta({
    title: 'Privacy Policy',
    description: 'How Atlas Performance Labs collects, uses, and protects your data.',
    canonical: 'https://atlasperformancelabs.co.uk/privacy',
  });

  return (
    <article style={articleStyle}>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: colors.text }}>
        Privacy Policy
      </h1>
      <p className="text-sm mb-8" style={{ color: colors.muted }}>
        Last updated: {LAST_UPDATED}
      </p>

      <H2>1. Who we are</H2>
      <P>
        Atlas Performance Labs Ltd ("Atlas", "we", "us") operates the Atlas platform at atlasperformancelabs.co.uk
        and the Atlas mobile apps (iOS and Android).
        We are a company registered in England and Wales.
        Registered office: 10 Floyer Road, Manchester, M9 6RS.
        Company number: 17024451.
      </P>
      <P>
        Data controller contact:{' '}
        <a href="mailto:privacy@atlasperformancelabs.co.uk" style={{ color: colors.primary }}>
          privacy@atlasperformancelabs.co.uk
        </a>
      </P>

      <H2>2. What data we collect</H2>
      <Ul
        items={[
          'Account data: name, email, password (hashed)',
          'Profile data: age, weight, height, goals, experience level, injuries notes',
          'Training data: workouts, sets, weights, RPE, session dates',
          'Nutrition data: meal logs, barcode scans, macro targets',
          'Progress data: weight logs, progress photos, check-in responses',
          'Coach-client data: messages, programme assignments, check-in feedback',
          'Competition prep data: show dates, posing practice logs, division information',
          'Payment data: processed by Stripe — we do not store card numbers',
          'Device data: push notification tokens, device type (mobile analytics only)',
          'Usage data: feature usage via PostHog (anonymised, EU-hosted)',
        ]}
      />

      <H2>3. Why we collect it</H2>
      <Ul
        items={[
          'To provide the coaching platform service',
          'To calculate macro and training targets',
          'To enable coach-client communication',
          'To send relevant push notifications',
          'To improve the product (usage analytics)',
          'Legal basis: Contract performance + Legitimate interest (analytics)',
        ]}
      />

      <H2>4. Who we share it with</H2>
      <Ul
        items={[
          'Supabase (database hosting, EU region)',
          'Stripe (payment processing)',
          'PostHog (product analytics, EU region, anonymised)',
          'GlitchTip (error monitoring, anonymised)',
          'We do not sell your data. Ever.',
          'We do not share your data with advertisers.',
        ]}
      />

      <H2>5. Health and body data</H2>
      <P>
        Weight, body measurements, progress photos, and training data are health-adjacent personal data.
        We treat them with extra care. Coaches can only see data for clients who have joined their roster.
        We do not share this data with any third party except as required to provide the service.
      </P>

      <H2>6. Your rights (UK GDPR)</H2>
      <Ul
        items={[
          'Access: request a copy of your data',
          'Correction: update any inaccurate data',
          'Deletion: delete your account and all data (Settings → Delete account)',
          'Portability: export your data on request',
          'Objection: opt out of analytics tracking',
        ]}
      />
      <P>
        Contact:{' '}
        <a href="mailto:privacy@atlasperformancelabs.co.uk" style={{ color: colors.primary }}>
          privacy@atlasperformancelabs.co.uk
        </a>
      </P>

      <H2>7. Data retention</H2>
      <Ul
        items={[
          'Active accounts: retained while account active',
          'Deleted accounts: removed within 30 days',
          'Backup retention: 90 days',
          'Payment records: 7 years (legal requirement)',
        ]}
      />

      <H2>8. Cookies</H2>
      <P>
        We use localStorage and sessionStorage for session state. We do not use tracking cookies.
        PostHog uses a first-party cookie for session identification only.
      </P>

      <H2>9. Changes to this policy</H2>
      <P>
        We will notify you by email or in-app notice of material changes. Last updated: {LAST_UPDATED}.
      </P>

      <H2>10. Contact</H2>
      <P>
        <a href="mailto:privacy@atlasperformancelabs.co.uk" style={{ color: colors.primary }}>
          privacy@atlasperformancelabs.co.uk
        </a>
      </P>
      <P>
        Or write to: Atlas Performance Labs Ltd — for our registered office postal address, email{' '}
        <a href="mailto:privacy@atlasperformancelabs.co.uk" style={{ color: colors.primary }}>
          privacy@atlasperformancelabs.co.uk
        </a>
        .
      </P>
    </article>
  );
}
