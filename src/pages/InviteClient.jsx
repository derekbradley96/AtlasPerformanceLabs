import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Copy, Check, Share2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';
import { safeDate } from '@/lib/format';
import { addPendingInvite, getPendingInvites } from '@/lib/inviteCodeStore';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { useAuth } from '@/lib/AuthContext';

const BORDER = 'rgba(255,255,255,0.06)';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

function formatDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InviteClient() {
  const { user, profile, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';

  // Show coach's persistent code straight away from profile (e.g. atlas-3034); API ensures same code
  const [inviteCode, setInviteCode] = useState(() => (profile?.referral_code ?? '').trim() || '');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);

  React.useEffect(() => {
    const code = (profile?.referral_code ?? '').trim();
    if (code) setInviteCode(code);
  }, [profile?.referral_code]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      atlasRepo.getInviteCode(trainerId, isDemoMode),
      atlasRepo.getPendingInvitesList(trainerId, isDemoMode),
    ]).then(([code, list]) => {
      if (!cancelled) {
        if (code) setInviteCode(code);
        setPendingInvites(Array.isArray(list) ? list : []);
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainerId, isDemoMode]);

  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setQrDataUrl('');
    }, 5000);
    QRCode.toDataURL(inviteCode, { width: 160, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [inviteCode]);

  const inviteMessage = `Hey! I'd like to invite you to join my coaching on Atlas Performance Labs. Use code ${inviteCode} when you sign up.\n\nSign up at: ${typeof window !== 'undefined' ? window.location?.origin || '' : ''}`;

  const handleCopyCode = useCallback(async () => {
    await lightHaptic();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        toast.success('Invite code copied!');
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('Clipboard not available');
      }
    } catch (e) {
      toast.error('Copy failed');
    }
  }, [inviteCode]);

  const handleShare = useCallback(async () => {
    await lightHaptic();
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Share } = await import(/* @vite-ignore */ '@capacitor/share');
          await Share.share({
            title: 'Join my coaching',
            text: inviteMessage,
            dialogTitle: 'Share invite',
          });
          toast.success('Share sheet opened');
          addPendingInvite(inviteCode);
          setPendingInvites(getPendingInvites());
          atlasRepo.getPendingInvitesList(trainerId, isDemoMode).then((list) => setPendingInvites(Array.isArray(list) ? list : []));
          return;
        } catch (_) {
          /* Share plugin not installed or user cancelled */
        }
      }
      if (typeof navigator.share === 'function' && navigator.canShare?.({ text: inviteMessage })) {
        await navigator.share({
          title: 'Join my coaching',
          text: inviteMessage,
        });
        toast.success('Shared!');
        addPendingInvite(inviteCode);
        setPendingInvites(getPendingInvites());
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteMessage);
        toast.success('Invite message copied to clipboard');
      } else {
        toast.error('Sharing not available');
      }
    } catch (e) {
      if (e?.name !== 'AbortError' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteMessage);
        toast.success('Invite message copied to clipboard');
      }
    }
  }, [inviteCode, inviteMessage]);

  // Only show full loading when we have no code yet and are still fetching (e.g. first load before profile has referral_code)
  if (loading && !inviteCode) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden">
        <Card style={{ padding: spacing[24], marginBottom: spacing[16] }}>
          <div style={{ height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 16 }} />
          <div style={{ height: 56, background: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, height: 44, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
            <div style={{ flex: 1, height: 44, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
          </div>
        </Card>
        <Card style={{ padding: spacing[24], marginBottom: spacing[16] }}>
          <div style={{ height: 180, background: 'rgba(255,255,255,0.06)', borderRadius: 12, margin: '0 auto' }} />
        </Card>
      </div>
    );
  }

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden">
      {/* Invite code card */}
      <Card style={{ padding: spacing[24], marginBottom: spacing[16], width: '100%', maxWidth: '100%' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: colors.muted }}>Your invite code</h2>
        <div
          className="rounded-xl p-4 mb-4 text-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}` }}
        >
          <p className="text-2xl font-bold font-mono tracking-wider" style={{ color: colors.accent }}>
            {inviteCode}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: spacing[16],
          }}
        >
          <Button variant="primary" onClick={handleCopyCode} style={{ flex: '1 1 140px', minWidth: 140 }}>
            {copied ? <Check size={18} style={{ marginRight: 8 }} /> : <Copy size={18} style={{ marginRight: 8 }} />}
            {copied ? 'Copied!' : 'Copy code'}
          </Button>
          <Button variant="secondary" onClick={handleShare} style={{ flex: '1 1 140px', minWidth: 140 }}>
            <Share2 size={18} style={{ marginRight: 8 }} />
            Share
          </Button>
        </div>
        <p className="text-xs mt-2" style={{ color: colors.muted }}>
          This is your permanent code (e.g. atlas-3034). Clients enter it when they sign up.
        </p>
      </Card>

      {/* QR code */}
      {qrDataUrl && (
        <Card style={{ padding: spacing[24], marginBottom: spacing[16], alignItems: 'center', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: colors.muted }}>QR code</h2>
          <img
            src={qrDataUrl}
            alt="Invite code QR"
            style={{
              width: 'min(240px, 70vw)',
              height: 'auto',
              maxWidth: '100%',
              display: 'block',
            }}
          />
          <p className="text-xs mt-2" style={{ color: colors.muted }}>Client scans to get the code</p>
        </Card>
      )}

      {/* How it works */}
      <Card style={{ padding: spacing[24], marginBottom: spacing[16] }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: colors.muted }}>How it works</h2>
        <ul className="space-y-2 text-sm" style={{ color: colors.text }}>
          <li>1. Share your code or QR with potential clients</li>
          <li>2. They enter the code during signup</li>
          <li>3. After payment they appear in your Clients list</li>
        </ul>
      </Card>

      {/* Pending invites */}
      <Card style={{ padding: 0, marginBottom: spacing[16] }}>
        <div style={{ padding: spacing[16], borderBottom: `1px solid ${BORDER}` }}>
          <h2 className="text-sm font-semibold" style={{ color: colors.muted }}>Pending invites</h2>
        </div>
        {pendingInvites.length === 0 ? (
          <div style={{ padding: spacing[24] }}>
            <EmptyState
              icon={UserPlus}
              title="No pending invites"
              subtext="Share your code or QR with potential clients; they’ll appear here once they use it."
            />
          </div>
        ) : (
          pendingInvites.map((inv, idx) => (
            <div
              key={inv.id}
              style={{
                padding: spacing[12],
                borderBottom: idx < pendingInvites.length - 1 ? `1px solid ${BORDER}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p className="text-[15px] font-medium font-mono" style={{ color: colors.text }}>{inv.code}</p>
                <p className="text-[12px]" style={{ color: colors.muted }}>{formatDate(inv.created_date)}</p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: inv.status === 'accepted' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
                  color: inv.status === 'accepted' ? colors.success : colors.muted,
                }}
              >
                {inv.status === 'accepted' ? 'Accepted' : 'Pending'}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
