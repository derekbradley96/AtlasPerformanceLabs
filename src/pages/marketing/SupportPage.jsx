/**
 * Public marketing: Support page (App Store Guideline 1.5 — must be reachable without login).
 */
import React from 'react';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors, spacing } from '@/ui/tokens';

const SUPPORT_EMAIL = 'customerservice@atlasperformancelabs.co.uk';

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
    <h2 className="text-lg font-semibold mt-10 mb-3 first:mt-0" style={{ color: colors.text }}>
      {children}
    </h2>
  );
}

function P({ children }) {
  return <p className="mb-4" style={{ color: colors.muted }}>{children}</p>;
}

const FAQS = [
  {
    q: 'How do I reset my password?',
    a: 'On the sign-in screen, tap "Forgot password?" and enter your email. We\'ll send you a secure link to set a new password.',
  },
  {
    q: 'How do I join my coach on Atlas?',
    a: 'Your coach will send you an invite code or link. Download the app, choose "New here with a coach code?", and enter the code — your coach and programme connect automatically.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Coaches: go to Plan & Billing in the app to manage or cancel your Atlas plan. Clients: your coaching payments are managed by your coach — message them in the app or contact us and we\'ll help.',
  },
  {
    q: 'How do I delete my account and data?',
    a: 'In the app, go to Settings → Danger zone → Delete account. This permanently removes your account and data. You can also email us and we\'ll process the deletion for you.',
  },
  {
    q: 'The barcode scanner or a feature isn\'t working — what should I do?',
    a: 'First, make sure you\'re on the latest version of the app. If the problem continues, email us with your device model and a short description — screenshots help us fix things fast.',
  },
];

export default function SupportPage() {
  usePageMeta({
    title: 'Support — Atlas Performance Labs',
    description: 'Get help with the Atlas Performance Labs app: contact support, FAQs, account and billing questions.',
  });

  return (
    <article style={articleStyle}>
      <h1 className="text-2xl font-bold mb-2" style={{ color: colors.text }}>Support</h1>
      <P>
        Need a hand with Atlas? We're here to help with anything — your account, billing,
        coaching connections, or something that isn't working the way it should.
      </P>

      <H2>Contact us</H2>
      <P>
        Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: colors.primary }}>
          {SUPPORT_EMAIL}
        </a>{' '}
        and we'll get back to you within one working day. Include the email address on your
        Atlas account so we can find you quickly.
      </P>
      <P>
        If you're signed in to the app, you can also use <strong>Settings → Get help</strong> to
        message us directly, or <strong>Settings → Send feedback</strong> to report a bug.
      </P>

      <H2>Frequently asked questions</H2>
      {FAQS.map(({ q, a }) => (
        <div key={q} className="mb-5">
          <p className="font-semibold mb-1" style={{ color: colors.text }}>{q}</p>
          <p style={{ color: colors.muted }}>{a}</p>
        </div>
      ))}

      <H2>Legal</H2>
      <P>
        Read our{' '}
        <a href="/privacy" className="underline" style={{ color: colors.primary }}>Privacy Policy</a>
        {' '}and{' '}
        <a href="/terms" className="underline" style={{ color: colors.primary }}>Terms of Service</a>.
      </P>
    </article>
  );
}
