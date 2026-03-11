/**
 * Public link generator: shareable URL https://atlas.app/i/{coachHandleOrId}
 * Copy, Share, Show QR. Payment links per service for lead checkout.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getCoachProfile } from '@/lib/data/coachProfileRepo';
import { Copy, Share2, Link2, QrCode } from 'lucide-react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { listServices, MOCK_SERVICES } from '@/lib/supabaseStripeApi';
import { getAppOrigin } from '@/lib/appOrigin';

const FALLBACK_HANDLE = 'demo';

function formatPrice(amount, currency = 'gbp') {
  if (amount == null) return '—';
  const value = currency.toLowerCase() === 'gbp' ? amount / 100 : amount / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function PublicLink() {
  const { user, isDemoMode } = useAuth();
  const userId = isDemoMode ? 'demo-trainer' : (user?.id ?? '');
  const BASE_URL = getAppOrigin();
  const [handle, setHandle] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [services, setServices] = useState([]);
  const hasSupabase = !!(typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL);

  const loadServices = useCallback(async () => {
    if (!userId) return;
    const { services: list } = hasSupabase ? await listServices(userId) : { services: MOCK_SERVICES };
    setServices(Array.isArray(list) ? list : MOCK_SERVICES);
  }, [userId, hasSupabase]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (!userId) return;
    const profile = getCoachProfile(userId);
    const h = (profile?.handle || '').trim() || (user?.email?.split('@')[0] || '').replace(/\W/g, '') || FALLBACK_HANDLE;
    setHandle(h);
  }, [userId, user?.email]);

  useEffect(() => {
    if (!handle) return;
    import('qrcode').then(({ default: QRCode }) => {
      const url = `${BASE_URL}/i/${encodeURIComponent(handle)}`;
      QRCode.toDataURL(url, { width: 220, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }).catch(() => setQrDataUrl(''));
  }, [handle]);

  const publicUrl = handle ? `${BASE_URL}/i/${encodeURIComponent(handle)}` : '';
  const paymentLinkForService = (s) => `${BASE_URL}/lead-checkout?uid=${encodeURIComponent(userId)}&service=${encodeURIComponent(s.id)}`;

  const handleCopy = () => {
    impactLight();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Link copied');
    } else {
      toast.error('Clipboard not available');
    }
  };

  const handleShare = async () => {
    impactLight();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my coaching',
          text: 'Onboarding link for new clients',
          url: publicUrl,
        });
        toast.success('Shared');
      } else {
        handleCopy();
      }
    } catch (e) {
      if (e?.name !== 'AbortError') handleCopy();
    }
  };

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingBottom: spacing[24] + 80 }}
    >
      <Card style={{ padding: spacing[24], marginBottom: spacing[16] }}>
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={20} style={{ color: colors.accent }} />
          <h2 className="text-base font-semibold" style={{ color: colors.text }}>Public link</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Onboarding link for new clients. Share on Instagram or add to your bio.
        </p>
        <div
          className="rounded-xl p-4 mb-4 break-all text-sm font-mono"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
        >
          {publicUrl || '…'}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={handleCopy} style={{ flex: '1 1 120px', minWidth: 120 }}>
            <Copy size={18} style={{ marginRight: 8 }} /> Copy link
          </Button>
          <Button variant="secondary" onClick={handleShare} style={{ flex: '1 1 120px', minWidth: 120 }}>
            <Share2 size={18} style={{ marginRight: 8 }} /> Share
          </Button>
          <Button variant="secondary" onClick={() => { impactLight(); setShowQr((s) => !s); }} style={{ flex: '1 1 120px', minWidth: 120 }}>
            <QrCode size={18} style={{ marginRight: 8 }} /> {showQr ? 'Hide QR' : 'Show QR'}
          </Button>
        </div>
      </Card>

      {showQr && qrDataUrl && (
        <Card style={{ padding: spacing[24], marginBottom: spacing[16], alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
          <p className="text-xs font-medium mb-3" style={{ color: colors.muted }}>Scan to open</p>
          <img src={qrDataUrl} alt="QR code" style={{ width: 220, height: 220, borderRadius: 12 }} />
        </Card>
      )}

      {services.length > 0 && (
        <Card style={{ padding: spacing[24], marginBottom: spacing[16] }}>
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={20} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>Payment links</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            Share a link so leads can pay for a plan. They’ll go to Stripe Checkout.
          </p>
          <div className="space-y-3">
            {services.filter((s) => s.active !== false).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: spacing[12], background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: colors.text }}>{s.name}</p>
                  <p className="text-xs" style={{ color: colors.muted }}>{formatPrice(s.price_amount, s.currency)}/{s.interval || 'month'}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    impactLight();
                    const url = paymentLinkForService(s);
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(url);
                      toast.success('Payment link copied');
                    }
                  }}
                >
                  <Copy size={16} style={{ marginRight: 6 }} /> Copy link
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
