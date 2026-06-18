/**
 * Marketing blog index — evergreen SEO posts.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors, radii } from '@/ui/tokens';

export const POSTS = [
  {
    slug: 'how-to-run-peak-week-first-time',
    title: 'How to run peak week for your first competition',
    subtitle:
      'The complete guide to carb manipulation, water, and timing for first-time competitors.',
    date: '2026-04-01',
    readTime: '12 min',
    category: 'Competition prep',
  },
  {
    slug: 'best-competition-prep-coaching-software',
    title: 'The best competition prep coaching software in 2026',
    subtitle: 'Comparing Atlas, Trainerize, TrueCoach, and PT Distinction for bodybuilding coaches.',
    date: '2026-04-10',
    readTime: '8 min',
    category: 'Tools & reviews',
  },
  {
    slug: 'macro-tracking-bodybuilding-complete-guide',
    title: 'Macro tracking for bodybuilding — the complete guide',
    subtitle: 'How to set protein, carbs, and fats for muscle building and competition cutting.',
    date: '2026-04-15',
    readTime: '10 min',
    category: 'Nutrition',
  },
];

export default function BlogIndexPage() {
  usePageMeta({
    title: 'Blog — bodybuilding, prep & coaching',
    description:
      'Evergreen guides on peak week, competition prep software, and macro tracking for bodybuilding athletes and coaches.',
    canonical: 'https://atlasperformancelabs.co.uk/blog',
  });

  return (
    <div className="px-4 py-12 sm:py-16 max-w-6xl mx-auto">
      <header className="mb-10 sm:mb-12">
        <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: colors.primary }}>
          Atlas blog
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3" style={{ color: colors.text }}>
          Bodybuilding, prep & coaching
        </h1>
        <p className="text-base sm:text-lg max-w-2xl leading-relaxed" style={{ color: colors.muted }}>
          Practical guides written for competitors and coaches — peak week execution, software choices, and nutrition fundamentals.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {POSTS.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group block rounded-2xl border p-6 sm:p-7 transition-colors hover:border-white/20"
            style={{
              borderColor: colors.border,
              background: colors.surface1,
              borderRadius: radii.card,
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.primary }}>
              {post.category}
            </p>
            <h2
              className="text-lg sm:text-xl font-semibold mb-2 group-hover:underline underline-offset-4"
              style={{ color: colors.text }}
            >
              {post.title}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: colors.muted }}>
              {post.subtitle}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: colors.muted }}>
              <time dateTime={post.date}>{post.date}</time>
              <span aria-hidden>·</span>
              <span>{post.readTime} read</span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-12 text-sm text-center" style={{ color: colors.muted }}>
        <Link to="/" className="font-medium hover:underline" style={{ color: colors.primary }}>
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
