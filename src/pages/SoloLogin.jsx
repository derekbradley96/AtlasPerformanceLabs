import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAuth } from '@/lib/AuthContext';
import { ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { colors } from '@/ui/tokens';
const BG = colors.bg;
const CARD = colors.surface1;
const TEXT = colors.text;
const MUTED = colors.muted;
const BORDER = colors.border;

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

export default function SoloLogin() {
  const navigate = useNavigate();
  const { setFakeSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBack = async () => {
    await lightHaptic();
    navigate('/', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await lightHaptic();
    setLoading(true);
    setFakeSession('solo', email.trim() || 'solo@atlas.local');
    setLoading(false);
    navigate('/solo-dashboard', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        paddingTop: 'max(24px, env(safe-area-inset-top, 0))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0))',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 44,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            color: MUTED,
            fontSize: 15,
          }}
        >
          <ChevronLeft size={20} /> Back
        </button>

        <p style={{ marginTop: 24, fontSize: 15, color: MUTED }}>Personal sign in</p>
        <h1 style={{ marginTop: 4, fontSize: 22, fontWeight: 700 }}>Sign in with email</h1>

        <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
          <label style={{ display: 'block', fontSize: 13, color: MUTED, marginBottom: 6 }}>Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={{
              width: '100%',
              minHeight: 48,
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              color: TEXT,
              marginBottom: 16,
            }}
            className="border-slate-700 placeholder:text-slate-500"
          />
          <label style={{ display: 'block', fontSize: 13, color: MUTED, marginBottom: 6 }}>Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{
              width: '100%',
              minHeight: 48,
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              color: TEXT,
              marginBottom: 24,
            }}
            className="border-slate-700 placeholder:text-slate-500"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl font-semibold text-white"
            style={{ background: colors.primary }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
