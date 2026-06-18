/**
 * Gym / studio affiliate programme — public application (marketing shell).
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { trackPage } from '@/lib/analytics';
import { colors, spacing } from '@/ui/tokens';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const FACILITY_TYPES = [
  { value: 'gym', label: 'Gym' },
  { value: 'studio', label: 'Studio' },
  { value: 'studio_pt', label: 'PT space' },
  { value: 'influencer', label: 'Online platform' },
];

const COACH_BANDS = [
  { value: '1-5', label: '1–5' },
  { value: '6-15', label: '6–15' },
  { value: '16-30', label: '16–30' },
  { value: '30+', label: '30+' },
];

function generateAffiliateCode() {
  const part =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `aff-${part}`.toLowerCase();
}

export default function AffiliatePage() {
  usePageMeta({
    title: 'Partners — gyms & studios',
    description:
      'Partner with Atlas Performance Labs. Earn revenue share when coaches and athletes you refer thrive on Atlas.',
    canonical: 'https://atlasperformancelabs.co.uk/affiliates',
  });

  React.useEffect(() => {
    trackPage('marketing_affiliates');
  }, []);

  const [businessName, setBusinessName] = useState('');
  const [facilityType, setFacilityType] = useState('gym');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [coachBand, setCoachBand] = useState('1-5');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const name = businessName.trim();
      const em = email.trim();
      const c = city.trim();
      if (!name || !em || !c) {
        toast.error('Please fill in business name, email, and city.');
        return;
      }
      if (!hasSupabase) {
        toast.error('Applications are unavailable — Supabase is not configured.');
        return;
      }
      const supabase = getSupabase();
      if (!supabase) {
        toast.error('Applications are unavailable right now.');
        return;
      }

      const affiliate_code = generateAffiliateCode();
      const type =
        facilityType === 'influencer'
          ? 'influencer'
          : facilityType === 'studio' || facilityType === 'studio_pt'
            ? 'studio'
            : 'gym';

      setSubmitting(true);
      try {
        const { error } = await supabase.from('affiliates').insert({
          name,
          type,
          email: em,
          affiliate_code,
          commission_pct: 20,
          status: 'pending',
          city: c,
          coach_count_band: coachBand,
        });
        if (error) {
          if (error.code === '23505') {
            toast.error('That email already has an application — we will be in touch.');
          } else {
            toast.error(error.message || 'Could not submit application.');
          }
          return;
        }
        setDone(true);
      } finally {
        setSubmitting(false);
      }
    },
    [businessName, email, city, facilityType, coachBand]
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <section className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ color: colors.text }}>
          Partner with Atlas. Earn when your coaches and athletes thrive.
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: colors.muted }}>
          Your coaches use Atlas to run their online businesses. When they upgrade their plan, you earn 20% of
          Atlas&apos;s revenue for 12 months. Refer one coach on Elite — earn £213/year. Refer ten — earn £2,130/year.
        </p>
      </section>

      {done ? (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{
            borderColor: colors.border,
            background: colors.surface1,
            padding: spacing[24],
          }}
        >
          <p className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
            Application received
          </p>
          <p className="text-sm" style={{ color: colors.muted }}>
            We&apos;ll email you within 24 hours with your affiliate code and portal access.
          </p>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border p-6 sm:p-8 space-y-6"
          style={{ borderColor: colors.border, background: colors.surface1 }}
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Business name
            </label>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              placeholder="Your facility or brand name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Type
            </label>
            <select
              value={facilityType}
              onChange={(e) => setFacilityType(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              {FACILITY_TYPES.map((opt) => (
                <option key={`${opt.value}-${opt.label}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Your email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              placeholder="you@yourgym.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Your city
            </label>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              placeholder="London"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              How many coaches train from your facility?
            </label>
            <select
              value={coachBand}
              onChange={(e) => setCoachBand(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              {COACH_BANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ background: colors.primary, color: '#fff' }}
          >
            {submitting ? 'Submitting…' : 'Apply for partnership'}
          </button>
        </form>
      )}

      <p className="text-center text-sm mt-10" style={{ color: colors.muted }}>
        Already approved?{' '}
        <Link to={SIGNUP_PUBLIC_PATH} className="font-medium underline-offset-2 hover:underline" style={{ color: colors.primary }}>
          Share your signup link
        </Link>{' '}
        with <code className="text-xs opacity-90">?aff=your-code</code> on auth (we also read <code className="text-xs opacity-90">ref</code>{' '}
        for compatibility).
      </p>
    </div>
  );
}
