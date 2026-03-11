/**
 * Referral dashboard for coaches: referral progress (invites sent, active referrals, rewards earned), link, share.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getAppOrigin } from '@/lib/appOrigin';
import { UserPlus, Users, Gift, Copy, Check, Share2, MessageCircle, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

async function getReferralData() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const [profileRes, referralsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('referral_code, free_month_credit')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('coach_referrals')
        .select('id, status')
        .eq('referrer_coach_id', user.id),
    ]);

    const profile = profileRes?.data ?? null;
    const referrals = Array.isArray(referralsRes?.data) ? referralsRes.data : [];
    const invites = referrals.length;
    const activated = referrals.filter((r) => r.status === 'activated').length;
    const freeMonths = profile ? Number(profile.free_month_credit) || 0 : 0;

    return {
      referralCode: profile?.referral_code ?? null,
      freeMonthCredit: freeMonths,
      invites,
      activated,
    };
  } catch {
    return null;
  }
}

export default function ReferralDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReferralData().then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const referralLink = data?.referralCode
    ? `${getAppOrigin()}/auth?ref=${encodeURIComponent(data.referralCode)}`
    : '';

  const shareTitle = 'Join Atlas';
  const shareText = 'Join me on Atlas – coaching made simple.';
  const messageText = "Here's my Atlas invite link – sign up and we both benefit: ";

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleShareSocial = async () => {
    if (!referralLink) return;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: referralLink,
        });
        toast.success('Shared');
      } else {
        await handleCopyLink();
        toast.success('Link copied – paste in your app');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        await handleCopyLink();
        toast.success('Link copied');
      }
    }
  };

  const handleSendViaMessage = async () => {
    if (!referralLink) return;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: shareTitle,
          text: messageText + referralLink,
          url: referralLink,
        });
        toast.success('Shared');
      } else {
        const smsUrl = `sms:?body=${encodeURIComponent(messageText + referralLink)}`;
        window.open(smsUrl, '_blank');
        toast.success('Opening messages');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        const smsUrl = `sms:?body=${encodeURIComponent(messageText + referralLink)}`;
        window.open(smsUrl, '_blank');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Referrals" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  const stats = data || { invites: 0, activated: 0, freeMonthCredit: 0 };

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Referrals" onBack={() => navigate(-1)} />
      <div className="p-4 pb-8">
        {/* Referral progress */}
        <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
          Referral progress
        </h2>
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: colors.muted }}>
              <UserPlus size={14} />
              <span className="text-xs font-medium">Invites sent</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.invites}
            </p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: colors.muted }}>
              <Users size={14} />
              <span className="text-xs font-medium">Active referrals</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.activated}
            </p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: colors.muted }}>
              <Gift size={14} />
              <span className="text-xs font-medium">Rewards earned</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.freeMonthCredit}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>free months</p>
          </Card>
        </div>

        {/* Your referral link */}
        <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
          Your referral link
        </h2>
        <Card style={{ padding: spacing[16] }}>
          {referralLink ? (
            <>
              <p
                className="text-sm break-all mb-3"
                style={{ color: colors.muted }}
              >
                {referralLink}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check size={16} className="mr-1.5" />
                ) : (
                  <Copy size={16} className="mr-1.5" />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </>
          ) : (
            <p style={{ color: colors.muted }}>No referral code yet.</p>
          )}
        </Card>

        {/* Share Atlas */}
        {referralLink && (
          <div className="mt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="w-full"
                  style={{ background: colors.accent ?? colors.brand, color: '#fff' }}
                >
                  <Share2 size={18} className="mr-2" />
                  Share Atlas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem onSelect={handleCopyLink}>
                  <Copy size={16} className="mr-2" />
                  Copy referral link
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleShareSocial}>
                  <AtSign size={16} className="mr-2" />
                  Share on social
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleSendViaMessage}>
                  <MessageCircle size={16} className="mr-2" />
                  Send via message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        </div>
    </div>
  );
}
