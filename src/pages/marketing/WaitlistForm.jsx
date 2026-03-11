/**
 * Waitlist capture form: email + role_interest, saves to public.waitlist in Supabase.
 */
import React, { useState } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors } from '@/ui/tokens';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'coach', label: 'Coach' },
  { value: 'athlete', label: 'Athlete' },
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
      toast.success("You're on the list. We'll be in touch.");
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
          Thanks for joining the waitlist.
        </p>
        <p className="text-sm mt-1" style={{ color: colors.muted }}>
          We&apos;ll notify you when we launch.
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
          Join the waitlist
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
          Get early access. We&apos;ll only use your email to notify you.
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
            {submitting ? 'Joining…' : 'Join waitlist'}
          </button>
        </form>
      </div>
    </section>
  );
}
