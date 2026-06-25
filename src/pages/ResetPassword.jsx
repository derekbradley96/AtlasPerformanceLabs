import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase } from '@/lib/supabaseClient';
import PageMeta from '@/components/seo/PageMeta';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  getPasswordChecks,
  getPasswordError,
} from '@/lib/passwordPolicy';
import { Check } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = getSupabase();
  const authAvailable = !!supabase;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwError = getPasswordError(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!authAvailable) {
      setError('Password reset is not configured. Contact support.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong');
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
      <PageMeta
        title="Reset Password — Atlas Performance Labs"
        description="Reset your Atlas Performance Labs password and get back to your coaching dashboard."
      />
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Set new password
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
          Enter your new password below.
        </p>

        {!authAvailable ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p className="text-[15px]" style={{ color: colors.text }}>
              Set new password is not available. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable it.
            </p>
            <Link to="/auth" className="block mt-6">
              <Button variant="primary" style={{ width: '100%' }}>Back to sign in</Button>
            </Link>
          </Card>
        ) : success ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p className="text-[15px]" style={{ color: colors.text }}>
              Your password has been updated.
            </p>
            <Link to="/auth" className="block mt-6">
              <Button variant="primary" style={{ width: '100%' }}>Sign in</Button>
            </Link>
          </Card>
        ) : (
          <Card style={{ padding: spacing[24] }}>
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                autoComplete="new-password"
                className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
              {password.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '-8px 0 16px' }}>
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const met = getPasswordChecks(password)[req.key];
                    return (
                      <li
                        key={req.key}
                        className="text-xs"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                          color: met ? colors.success : colors.muted,
                        }}
                      >
                        <Check size={13} style={{ opacity: met ? 1 : 0.3, flexShrink: 0 }} />
                        {req.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm"
                autoComplete="new-password"
                className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
              {error && (
                <p className="text-sm mt-2" style={{ color: colors.destructive }}>{error}</p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                style={{ width: '100%', marginTop: spacing[16] }}
              >
                {loading ? 'Updating…' : 'Update password'}
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
