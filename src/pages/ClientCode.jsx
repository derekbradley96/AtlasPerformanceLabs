/**
 * Client invite/code entry. Validates code, stores code + coach id, then sends to signup.
 * After signup, user is redirected to client onboarding (details → package → pay or skip).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ChevronLeft, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { invokeSupabaseFunction, normalizeInviteCode } from '@/lib/supabaseApi';

import { colors } from '@/ui/tokens';
const BG = colors.bg;
const CARD = colors.surface1;
const TEXT = colors.text;
const MUTED = colors.muted;
const BORDER = colors.border;

const PENDING_INVITE_KEY = 'atlas_pending_invite_code';
const PENDING_TRAINER_KEY = 'atlas_pending_trainer_id';
const CLIENT_CODE_KEY = 'atlas_client_code';

export function setPendingInvite(code, trainerId) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(PENDING_INVITE_KEY, code);
      sessionStorage.setItem(PENDING_TRAINER_KEY, String(trainerId ?? ''));
    }
  } catch (e) {}
}

export function getPendingInvite() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const code = sessionStorage.getItem(PENDING_INVITE_KEY);
    const trainerId = sessionStorage.getItem(PENDING_TRAINER_KEY);
    if (!code) return null;
    return { code, trainerId };
  } catch (e) {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      sessionStorage.removeItem(PENDING_TRAINER_KEY);
    }
  } catch (e) {}
}

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

export default function ClientCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBack = async () => {
    await lightHaptic();
    navigate('/auth', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await lightHaptic();
    const normalized = normalizeInviteCode(code);
    if (!normalized) {
      toast.error('Please enter your coach code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await invokeSupabaseFunction('validateInviteCode', { code: normalized });
      if (result.error || !result.data?.valid) {
        setLoading(false);
        setError(result.data?.error || result.error || 'Invalid coach code');
        toast.error(result.data?.error || result.error || 'Invalid coach code');
        return;
      }
      const trainerId = result.data.trainer_id ?? result.data.coach_id ?? '';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(CLIENT_CODE_KEY, normalized);
      }
      setPendingInvite(normalized, trainerId);
      toast.success('Code accepted. Sign up to continue.');
      navigate('/auth?mode=signup&account=client', { replace: true });
    } catch (err) {
      setLoading(false);
      setError('Could not validate code');
      toast.error('Could not validate code');
    }
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

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: CARD, display: 'grid', placeItems: 'center' }}>
            <Users size={24} color={colors.primary} />
          </div>
        </div>
        <p style={{ marginTop: 16, fontSize: 15, color: MUTED, textAlign: 'center' }}>Client access</p>
        <h1 style={{ marginTop: 4, fontSize: 22, fontWeight: 700, textAlign: 'center' }}>Coach code</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: MUTED, textAlign: 'center' }}>Get this from your coach</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="Coach code"
            maxLength={20}
            autoComplete="off"
            style={{
              width: '100%',
              minHeight: 48,
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              color: TEXT,
              textAlign: 'center',
              letterSpacing: 2,
              marginBottom: 8,
            }}
            className="border-slate-700 font-mono"
          />
          {error ? (
            <p style={{ marginBottom: 16, fontSize: 13, color: colors.error || '#ef4444', textAlign: 'center' }}>
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl font-semibold text-white"
style={{ background: colors.primary }}
          >
            {loading ? 'Checking…' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
