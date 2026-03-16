/**
 * Reusable marketing sections: Hero, Features, SocialProof, CTA.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { colors } from '@/ui/tokens';

export function Hero({ title, subtitle, primaryCtaLabel, primaryCtaTo, secondaryCtaLabel, secondaryCtaTo }) {
  return (
    <section
      className="text-center px-4 py-16 sm:py-24"
      style={{
        background: `radial-gradient(circle at top left, rgba(59,130,246,0.38), transparent 55%), linear-gradient(180deg, ${colors.surface} 0%, ${colors.bg} 100%)`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4" style={{ color: colors.muted }}>
          Built for performance coaching
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: colors.text }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-base sm:text-lg md:text-xl mb-8" style={{ color: colors.muted }}>
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryCtaLabel && primaryCtaTo && (
            <Link
              to={primaryCtaTo}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-2xl text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: colors.primary, color: '#fff' }}
            >
              {primaryCtaLabel}
            </Link>
          )}
          {secondaryCtaLabel && secondaryCtaTo && (
            <Link
              to={secondaryCtaTo}
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl text-base font-semibold border transition-opacity hover:bg-white/5"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              {secondaryCtaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function Features({ title, items }) {
  return (
    <section className="px-4 py-16 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-10" style={{ color: colors.text }}>{title}</h2>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ heading, body }, i) => (
          <li
            key={i}
            className="p-4 rounded-xl border"
            style={{ borderColor: colors.border, background: colors.surface1 }}
          >
            <h3 className="font-semibold mb-2" style={{ color: colors.text }}>{heading}</h3>
            <p className="text-sm" style={{ color: colors.muted }}>{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SocialProof({ title, quote, attribution }) {
  return (
    <section
      className="px-4 py-16 border-t"
      style={{ borderColor: colors.border, background: colors.surface }}
    >
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-xl font-bold mb-6" style={{ color: colors.text }}>{title}</h2>
        <blockquote className="text-lg md:text-xl font-medium mb-4 leading-relaxed" style={{ color: colors.text }}>
          <span className="text-3xl align-middle mr-1" style={{ color: colors.primary }}>“</span>
          {quote}
          <span className="text-3xl align-middle ml-1" style={{ color: colors.primary }}>”</span>
        </blockquote>
        {attribution && <p className="text-sm" style={{ color: colors.muted }}>— {attribution}</p>}
      </div>
    </section>
  );
}

export function CTA({ title, subtitle, primaryCtaLabel, primaryCtaTo, secondaryCtaLabel, secondaryCtaTo }) {
  return (
    <section
      className="px-4 py-16 text-center border-t"
      style={{ borderColor: colors.border }}
    >
      <h2 className="text-2xl font-bold mb-2" style={{ color: colors.text }}>{title}</h2>
      {subtitle && <p className="mb-8" style={{ color: colors.muted }}>{subtitle}</p>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryCtaLabel && primaryCtaTo && (
          <Link
            to={primaryCtaTo}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
            style={{ background: colors.primary, color: '#fff' }}
          >
            {primaryCtaLabel}
          </Link>
        )}
        {secondaryCtaLabel && secondaryCtaTo && (
          <Link
            to={secondaryCtaTo}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold border transition-opacity hover:opacity-90"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            {secondaryCtaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
