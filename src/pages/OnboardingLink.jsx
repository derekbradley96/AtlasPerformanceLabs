import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Copy, Share2, Link2 } from 'lucide-react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { getAppOrigin } from '@/lib/appOrigin';

function getTrainerSlug(user) {
  if (!user) return 'demo';
  const name = (user.full_name || user.name || user.email || 'trainer').toLowerCase();
  return name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'trainer';
}

export default function OnboardingLink() {
  const { user, isDemoMode } = useAuth();
  const slug = getTrainerSlug(isDemoMode ? user : user);
  const baseUrl = getAppOrigin();
  const joinUrl = `${baseUrl}/join/${slug}`;

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(joinUrl);
      toast.success('Link copied');
    } else {
      toast.error('Clipboard not available');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my coaching',
          text: `Join my program: ${joinUrl}`,
          url: joinUrl,
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
      style={{
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <Card style={{ padding: spacing[24], marginBottom: spacing[16] }}>
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={20} style={{ color: colors.accent }} />
          <h2 className="text-base font-semibold" style={{ color: colors.text }}>Your onboarding link</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Share this link (e.g. on Instagram) so potential clients can sign up. Submissions appear in Leads.
        </p>
        <div
          className="rounded-xl p-4 mb-4 break-all text-sm font-mono"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
        >
          {joinUrl}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={handleCopy} style={{ flex: '1 1 140px', minWidth: 140 }}>
            <Copy size={18} style={{ marginRight: 8 }} /> Copy
          </Button>
          <Button variant="secondary" onClick={handleShare} style={{ flex: '1 1 140px', minWidth: 140 }}>
            <Share2 size={18} style={{ marginRight: 8 }} /> Share
          </Button>
        </div>
      </Card>

      <Card style={{ padding: spacing[16] }}>
        <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Slug for this link</p>
        <p className="text-[15px] font-mono" style={{ color: colors.text }}>{slug}</p>
        <p className="text-xs mt-2" style={{ color: colors.muted }}>
          You can customize this later in profile settings.
        </p>
      </Card>
    </div>
  );
}
