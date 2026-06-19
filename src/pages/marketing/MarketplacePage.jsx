/**
 * Marketplace: hero, features, CTA to discover coaches or start coaching.
 */
import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Hero, CTA } from './MarketingSections';
import { LOGIN_PUBLIC_PATH, SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors, spacing } from '@/ui/tokens';

const PLATEAU_GOAL_LABELS = {
  lose_fat: 'fat loss',
  muscle_gain: 'muscle building',
  competition_prep: 'competition prep',
  general_fitness: 'general fitness',
};

export default function MarketplacePage() {
  const [searchParams] = useSearchParams();
  const goalFromUrl = useMemo(() => {
    const raw = String(searchParams.get('goal') || '').trim().toLowerCase();
    if (raw && PLATEAU_GOAL_LABELS[raw]) return raw;
    return null;
  }, [searchParams]);

  usePageMeta({
    title: 'Find a Bodybuilding Coach — Atlas Marketplace',
    description:
      'Browse verified bodybuilding and competition prep coaches. Filter by speciality, rating, and price. Find your prep coach today.',
    canonical: 'https://atlasperformancelabs.co.uk/marketplace',
  });

  return (
    <>
      <Hero
        title="Find the right coach, or grow your roster"
        subtitle="Browse coaches on Atlas or list your coaching practice so the right clients can find you."
        primaryCtaLabel="Login"
        primaryCtaTo={LOGIN_PUBLIC_PATH}
        secondaryCtaLabel="Sign up"
        secondaryCtaTo={SIGNUP_PUBLIC_PATH}
      />

      {goalFromUrl ? (
        <section className="px-4 pt-4 pb-2 max-w-6xl mx-auto">
          <div
            className="rounded-2xl border p-4 sm:p-5"
            style={{ borderColor: 'rgba(59,130,246,0.35)', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.06))' }}
          >
            <p className="text-sm sm:text-base font-semibold mb-1" style={{ color: colors.text }}>
              Coaches for {PLATEAU_GOAL_LABELS[goalFromUrl]}
            </p>
            <p className="text-xs sm:text-sm leading-relaxed mb-3" style={{ color: colors.muted }}>
              You opened this page from a progress insight. Log in to browse coaches in the Atlas app — the{' '}
              <code className="text-[11px]">goal</code> query is preserved for your context.
            </p>
            <div className="flex flex-wrap gap-2" style={{ gap: spacing[8] }}>
              <Link
                to={LOGIN_PUBLIC_PATH}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold"
                style={{ background: colors.primary, color: '#fff' }}
              >
                Log in to browse coaches
              </Link>
              <Link
                to={SIGNUP_PUBLIC_PATH}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                Create account
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-4 py-16 sm:py-20 max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4" style={{ color: colors.text }}>
          Three clear paths
        </h2>
        <p className="text-center text-base sm:text-lg mb-10 max-w-3xl mx-auto" style={{ color: colors.muted }}>
          Find a coach, start free on Personal Basic, or list your practice—three paths, one platform.
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border p-6 sm:p-7" style={{ borderColor: colors.border, background: colors.surface1 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: colors.primary }}>Find a coach</p>
            <ul className="space-y-2 text-sm sm:text-base leading-relaxed mb-6" style={{ color: colors.muted }}>
              <li>Browse coaches by style and focus</li>
              <li>See what they offer before you commit</li>
              <li>Start with a system built around your plan</li>
            </ul>
            <Link
              to={LOGIN_PUBLIC_PATH}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: colors.primary, color: '#fff' }}
            >
              Login
            </Link>
          </article>
          <article className="rounded-2xl border p-6 sm:p-7" style={{ borderColor: colors.border, background: colors.surface1 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: colors.primary }}>Train on your own</p>
            <ul className="space-y-2 text-sm sm:text-base leading-relaxed mb-6" style={{ color: colors.muted }}>
              <li>Free entry: log training and food, see progress</li>
              <li>Build programs manually at your pace</li>
              <li>Free programs, logging, and progress tracking</li>
            </ul>
            <Link
              to={SIGNUP_PUBLIC_PATH}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              Sign up
            </Link>
          </article>
          <article className="rounded-2xl border p-6 sm:p-7" style={{ borderColor: colors.border, background: colors.surface1 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: colors.primary }}>List your practice</p>
            <ul className="space-y-2 text-sm sm:text-base leading-relaxed mb-6" style={{ color: colors.muted }}>
              <li>Get discovered by the right clients</li>
              <li>Show your coaching focus and services</li>
              <li>Grow your roster without relying only on DMs</li>
            </ul>
            <Link
              to={SIGNUP_PUBLIC_PATH}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              Sign up
            </Link>
          </article>
        </div>
      </section>

      <section className="px-4 pb-6 sm:pb-10 max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8" style={{ color: colors.text }}>
          How it works
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border p-6" style={{ borderColor: colors.border, background: colors.surface }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>For people looking for coaching</h3>
            <ol className="space-y-2 text-sm sm:text-base" style={{ color: colors.muted }}>
              <li>1. Browse coaches</li>
              <li>2. Choose the right fit</li>
              <li>3. Start coaching on Atlas</li>
            </ol>
          </article>
          <article className="rounded-2xl border p-6" style={{ borderColor: colors.border, background: colors.surface }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>For coaches</h3>
            <ol className="space-y-2 text-sm sm:text-base" style={{ color: colors.muted }}>
              <li>1. Create your profile</li>
              <li>2. List your services</li>
              <li>3. Get discovered</li>
            </ol>
          </article>
        </div>
      </section>

      <section className="px-4 py-12 sm:py-14 max-w-5xl mx-auto">
        <div className="rounded-2xl border p-6 sm:p-7" style={{ borderColor: colors.border, background: colors.surface1 }}>
          <h2 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: colors.text }}>
            Why Atlas Marketplace
          </h2>
          <ul className="space-y-2 text-sm sm:text-base leading-relaxed" style={{ color: colors.muted }}>
            <li>Built for transformation and competition coaching</li>
            <li>Coach profiles show focus, offers, and approach</li>
            <li>Training, check-ins, and messaging stay in one place</li>
          </ul>
        </div>
      </section>

      <CTA
        title="Login or sign up to Atlas"
        primaryCtaLabel="Login"
        primaryCtaTo={LOGIN_PUBLIC_PATH}
        secondaryCtaLabel="Sign up"
        secondaryCtaTo={SIGNUP_PUBLIC_PATH}
      />
    </>
  );
}
