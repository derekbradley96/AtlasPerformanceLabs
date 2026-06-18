/**
 * INTERNAL USE ONLY — not accessible from public nav.
 * Used for collecting early interest during closed betas.
 * For open signups: use SIGNUP_PUBLIC_PATH instead.
 *
 * Implementation: email + role_interest, saves to public.waitlist in Supabase.
 */
import React, { useState } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors } from '@/ui/tokens';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'coach', label: 'Coach' },
  { value: 'personal', label: 'Personal' },
  { value: 'both', label: 'Both' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [roleInterest, setRoleInterest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailTrim = (email || '').trim().toLowerCase();
    if (!emailTrim) {
      toast.error('Please enter your email.');
      return;
    }
    if (!EMAIL_RE.test(emailTrim)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!hasSupabase || !getSupabase()) {
      toast.info('Waitlist signup is not available right now. Try again later.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await getSupabase()
        .from('waitlist')
        .insert({
          email: emailTrim,
          role_interest: roleInterest || null,
        });
      if (error) throw error;
      setSubmitted(true);
      setEmail('');
      setRoleInterest('');
      toast.success("You're on the early access list. We'll reach out when the next batch opens.");
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[waitlist]', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section
        className="px-4 py-12 border-t text-center"
        style={{ borderColor: colors.border, background: colors.surface }}
      >
        <p className="text-lg font-medium" style={{ color: colors.text }}>
          You&apos;re on the list for early access.
        </p>
        <p className="text-sm mt-1" style={{ color: colors.muted }}>
          We onboard in small batches—you&apos;ll hear from us when a spot opens.
        </p>
      </section>
    );
  }

  return (
    <section
      className="px-4 py-12 border-t"
      style={{ borderColor: colors.border, background: colors.surface }}
    >
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Get early access
        </h2>
        <p className="text-sm text-center mb-2" style={{ color: colors.muted }}>
          We&apos;re opening Atlas to coaches in limited batches. Add your email to reserve a spot—we only write when it&apos;s your turn.
        </p>
        <p className="text-xs text-center mb-6 font-medium" style={{ color: colors.primary }}>
          Spots fill quickly as each cohort goes live.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2"
            style={{
              background: colors.bg,
              borderColor: colors.border,
              color: colors.text,
            }}
            autoComplete="email"
            aria-label="Email"
          />
          <select
            value={roleInterest}
            onChange={(e) => setRoleInterest(e.target.value)}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2"
            style={{
              background: colors.bg,
              borderColor: colors.border,
              color: colors.text,
            }}
            aria-label="I'm interested in"
          >
            <option value="">I'm interested in…</option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-base font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: colors.primary, color: '#fff' }}
          >
            {submitting ? 'Sending…' : 'Request early access'}
          </button>
        </form>
      </div>
    </section>
  );
}
