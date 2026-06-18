/**
 * Public marketing: Terms of Service.
 */
import React from 'react';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors, spacing } from '@/ui/tokens';

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

export default function TermsOfServicePage() {
  usePageMeta({
    title: 'Terms of Service',
    description: 'Terms governing use of the Atlas coaching platform.',
    canonical: 'https://atlasperformancelabs.co.uk/terms',
  });

  return (
    <article style={articleStyle}>
      <h1 className="text-2xl sm:text-3xl font-bold mb-8" style={{ color: colors.text }}>
        Terms of Service
      </h1>

      <H2>1. The service</H2>
      <P>
        Atlas provides software for fitness coaching, tracking, and performance management.
        We are not a healthcare provider. Nothing on Atlas is medical advice.
      </P>

      <H2>2. Eligibility</H2>
      <P>
        You must be 16 or older to create an account. If you are under 18, you need parental consent.
        Coaches must be 18+.
      </P>

      <H2>3. Coach responsibilities</H2>
      <P>
        Coaches are independent professionals. Atlas provides the software — coaches provide the coaching.
        Atlas is not responsible for coaching advice given through the platform.
      </P>

      <H2>4. Payment terms</H2>
      <P>
        Coach subscriptions: billed monthly, cancel anytime. Client coaching payments: processed by Stripe on behalf of coaches.
        Atlas takes a commission as described in your plan. Refunds are at the coach&apos;s discretion for client payments.
      </P>

      <H2>5. Acceptable use</H2>
      <P>
        No illegal content. No harassment. No sharing login credentials. No attempting to access other users&apos; data.
        Violations result in account suspension.
      </P>

      <H2>6. Intellectual property</H2>
      <P>
        Your data is yours. We don&apos;t claim ownership of your workout logs, check-ins, or progress photos.
        Atlas owns the platform, the software, and the Atlas brand.
      </P>

      <H2>7. Limitation of liability</H2>
      <P>
        Atlas is provided as-is. To the fullest extent permitted by law, Atlas Performance Labs Ltd is not liable
        for any indirect, incidental, or consequential damages. Our total liability to you shall not exceed the
        amount you paid us in the 12 months preceding the claim. We are not liable for outcomes related to
        training or nutrition advice delivered through the platform.
      </P>

      <H2>8. Account suspension and termination</H2>
      <P>
        We may suspend or terminate accounts that violate these terms, with or without notice. You may delete
        your account at any time from Settings → Delete account. Upon deletion, your personal data is removed
        within 30 days (see our Privacy Policy for payment record retention).
      </P>

      <H2>9. Changes to these terms</H2>
      <P>
        We may update these terms. We will notify you by email or in-app notice at least 14 days before
        material changes take effect. Continued use after that date constitutes acceptance.
      </P>

      <H2>10. Dispute resolution</H2>
      <P>
        We aim to resolve disputes informally first — contact{' '}
        <a href="mailto:legal@atlasperformancelabs.co.uk" style={{ color: colors.primary }}>
          legal@atlasperformancelabs.co.uk
        </a>. If we cannot resolve a dispute within 30 days, either party may refer it to the courts of
        England and Wales.
      </P>

      <H2>11. Governing law</H2>
      <P>These terms are governed by the laws of England and Wales.</P>

      <H2>12. Contact</H2>
      <P>
        Atlas Performance Labs Ltd
        {' — '}
        <a href="mailto:legal@atlasperformancelabs.co.uk" style={{ color: colors.primary }}>
          legal@atlasperformancelabs.co.uk
        </a>
      </P>
    </article>
  );
}
