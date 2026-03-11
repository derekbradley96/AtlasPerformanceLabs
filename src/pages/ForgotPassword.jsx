import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const { sendPasswordReset, hasSupabase } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const authAvailable = !!hasSupabase;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!email.trim()) return;
    if (!authAvailable) {
      setSubmitError('Password reset is not configured. Contact support.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await sendPasswordReset(email.trim());
      if (error) throw error;
      setSent(true);
      toast.success('If an account exists for that email, we’ve sent a reset link.');
    } catch (err) {
      setSubmitError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Forgot password
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
          Enter your email and we’ll send a reset link.
        </p>

        {!authAvailable ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p className="text-[15px]" style={{ color: colors.text }}>
              Password reset is not available. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable it.
            </p>
            <Link to="/auth" className="block mt-6">
              <Button variant="primary" style={{ width: '100%' }}>Back to sign in</Button>
            </Link>
          </Card>
        ) : sent ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p className="text-[15px]" style={{ color: colors.text }}>
              If an account exists for that email, we’ve sent a reset link.
            </p>
            <p className="text-sm mt-2" style={{ color: colors.muted }}>
              Check your inbox and spam folder.
            </p>
            <Link to="/auth" className="block mt-6">
              <Button variant="primary" style={{ width: '100%' }}>Back to sign in</Button>
            </Link>
          </Card>
        ) : (
          <Card style={{ padding: spacing[24] }}>
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
              {submitError && (
                <p className="text-sm mt-2" style={{ color: colors.destructive }}>{submitError}</p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                style={{ width: '100%', marginTop: spacing[16] }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </Card>
        )}

        <p className="text-center mt-6">
          <Link to="/auth" className="text-sm" style={{ color: colors.accent }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
