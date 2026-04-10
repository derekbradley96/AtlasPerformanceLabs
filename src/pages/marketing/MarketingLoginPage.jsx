/**
 * Marketing login: hero + CTA to app auth.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Hero } from './MarketingSections';
import { LOGIN_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { colors } from '@/ui/tokens';

export default function MarketingLoginPage() {
  return (
    <>
      <Hero
        title="Log in to Atlas"
        subtitle="Sign in to your account to access your dashboard, programs, and messages."
        primaryCtaLabel="Log in"
        primaryCtaTo={LOGIN_PUBLIC_PATH}
        secondaryCtaLabel="Back to home"
        secondaryCtaTo="/"
      />
      <section className="px-4 py-12 max-w-md mx-auto text-center">
        <p className="text-sm mb-6" style={{ color: colors.muted }}>
          New to Atlas? Sign up from the login screen to create your account as a coach or Personal user.
        </p>
        <Link
          to={LOGIN_PUBLIC_PATH}
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
          style={{ background: colors.primary, color: '#fff' }}
        >
          Go to login
        </Link>
      </section>
    </>
  );
}
