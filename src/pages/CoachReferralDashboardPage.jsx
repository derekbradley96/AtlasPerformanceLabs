/**
 * Coach referral dashboard: referral code, shareable link, event counts (profile views,
 * enquiry starts, signups), public result stories count, and actions (copy link, share profile,
 * open public profile, create result story).
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  getCoachReferralLink,
  getCoachPublicProfileLink,
  copyReferralLinkToClipboard,
  trackReferralEvent,
} from '@/lib/referrals';
import {
  Copy,
  Share2,
  ExternalLink,
  Plus,
  Eye,
  MessageCircle,
  UserPlus,
  Trophy,
  Loader2,
  Inbox,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';

async function fetchReferralDashboard(coachId) {
  if (!hasSupabase || !coachId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const [profileRes, analyticsRes, storiesRes, enquiriesRes, personalConversionRes] = await Promise.all([
      supabase.from('profiles').select('referral_code').eq('id', coachId).maybeSingle(),
      supabase
        .from('v_referral_analytics_by_coach')
        .select('profile_views, result_story_views, enquiry_starts, enquiry_submits, link_copied_count, link_shared_count, signups_completed, conversion_rate')
        .eq('coach_id', coachId)
        .maybeSingle(),
      supabase
        .from('client_result_stories')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('is_public', true),
      supabase
        .from('coach_public_enquiries')
        .select('enquiry_type')
        .eq('coach_id', coachId),
      supabase.rpc('get_personal_conversion_metrics', { p_requested_coach_id: coachId }).maybeSingle(),
    ]);

    const profile = profileRes?.data ?? null;
    const referralCode = profile?.referral_code ?? null;
    const a = analyticsRes?.data ?? null;

    const profileViews = (a?.profile_views ?? 0) || 0;
    const resultStoryViews = (a?.result_story_views ?? 0) || 0;
    const enquiryStarts = (a?.enquiry_starts ?? 0) || 0;
    const enquirySubmits = (a?.enquiry_submits ?? 0) || 0;
    const linkCopied = (a?.link_copied_count ?? 0) || 0;
    const linkShared = (a?.link_shared_count ?? 0) || 0;
    const signupsCompleted = (a?.signups_completed ?? 0) || 0;
    const conversionRate = a?.conversion_rate ?? null;

    const publicStoriesCount = storiesRes?.count ?? 0;

    const enquiries = Array.isArray(enquiriesRes?.data) ? enquiriesRes.data : [];
    const enquiriesByType = {
      transformation: enquiries.filter((e) => e.enquiry_type === 'transformation').length,
      competition: enquiries.filter((e) => e.enquiry_type === 'competition').length,
      general: enquiries.filter((e) => e.enquiry_type === 'general' || !e.enquiry_type).length,
    };

    const pc = personalConversionRes?.data ?? null;
    const personalConversion = pc
      ? {
          profile_views: Number(pc.profile_views ?? 0) || 0,
          enquiries: Number(pc.enquiries ?? 0) || 0,
          converted: Number(pc.converted ?? 0) || 0,
          conversion_rate: pc.conversion_rate != null ? Number(pc.conversion_rate) : null,
        }
      : null;

    return {
      referralCode,
      profileViews,
      resultStoryViews,
      enquiryStarts,
      enquirySubmits,
      linkCopied,
      linkShared,
      signupsCompleted,
      conversionRate,
      publicStoriesCount,
      enquiriesByType,
      personalConversion,
    };
  } catch {
    return null;
  }
}

export default function CoachReferralDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['referral-dashboard', coachId],
    queryFn: () => fetchReferralDashboard(coachId),
    enabled: !!coachId,
  });

  const coach = data?.referralCode != null ? { referral_code: data.referralCode } : null;
  const referralLink = getCoachReferralLink(coach ?? {});
  const publicProfileLink = getCoachPublicProfileLink(coach ?? {});

  const handleCopyLink = useCallback(async () => {
    const ok = await copyReferralLinkToClipboard(referralLink);
    if (ok) {
      toast.success('Link copied');
      if (data?.referralCode) {
        trackReferralEvent(data.referralCode, 'referral_link_copied', {}, coachId);
      }
    } else {
      toast.error('Could not copy');
    }
  }, [referralLink, data?.referralCode, coachId]);

  const handleShareProfile = useCallback(async () => {
    const link = publicProfileLink || referralLink;
    if (!link) {
      toast.error('No link to share');
      return;
    }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'My coaching profile',
          text: 'Check out my coaching profile on Atlas.',
          url: link,
        });
        toast.success('Shared');
        if (data?.referralCode) {
          trackReferralEvent(data.referralCode, 'referral_link_shared', { source: 'share_profile' }, coachId);
        }
      } else {
        const ok = await copyReferralLinkToClipboard(link);
        if (ok) {
          toast.success('Link copied – paste to share');
          if (data?.referralCode) {
            trackReferralEvent(data.referralCode, 'referral_link_copied', { source: 'share_fallback' }, coachId);
          }
        } else {
          toast.error('Could not copy');
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        const ok = await copyReferralLinkToClipboard(link);
        if (ok) toast.success('Link copied');
      }
    }
  }, [publicProfileLink, referralLink, data?.referralCode, coachId]);

  const handleOpenPublicProfile = useCallback(() => {
    if (publicProfileLink) window.open(publicProfileLink, '_blank');
    else toast.error('No public profile link yet');
  }, [publicProfileLink]);

  const handleCreateResultStory = useCallback(() => {
    navigate('/results-stories/new');
  }, [navigate]);

  const handleViewEnquiries = useCallback(() => {
    navigate('/enquiries');
  }, [navigate]);

  if (!coachId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Referrals" onBack={() => navigate(-1)} />
        <div className="p-4" style={{ color: colors.muted }}>
          Sign in as a coach to view your referral dashboard.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 className="animate-spin" size={32} style={{ color: colors.muted }} />
      </div>
    );
  }

  const stats = data ?? {
    referralCode: null,
    profileViews: 0,
    resultStoryViews: 0,
    enquiryStarts: 0,
    enquirySubmits: 0,
    linkCopied: 0,
    linkShared: 0,
    signupsCompleted: 0,
    conversionRate: null,
    publicStoriesCount: 0,
    enquiriesByType: { transformation: 0, competition: 0, general: 0 },
    personalConversion: null,
  };
  const personalConversion = stats.personalConversion;

  return (
    <div className="min-h-screen" style={{ background: colors.bg, paddingBottom: spacing[24] }}>
      <TopBar title="Referrals" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 space-y-6">
        {/* Referral code & link */}
        <Card style={{ padding: spacing[16] }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
            Your referral code
          </h2>
          {stats.referralCode ? (
            <>
              <p className="text-lg font-mono font-semibold mb-2" style={{ color: colors.accent }}>
                {stats.referralCode}
              </p>
              <p className="text-xs mb-3 break-all" style={{ color: colors.muted }}>
                {referralLink}
              </p>
              <Button
                variant="secondary"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2"
              >
                <Copy size={16} />
                Copy referral link
              </Button>
            </>
          ) : (
            <p className="text-sm" style={{ color: colors.muted }}>
              No referral code yet. It’s usually created when you sign up.
            </p>
          )}
        </Card>

        {/* Activity: event counts */}
        <h2 className="text-sm font-semibold" style={{ color: colors.text }}>
          Activity
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <Eye size={20} className="mx-auto mb-1" style={{ color: colors.muted }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.profileViews}
            </p>
            <p className="text-xs" style={{ color: colors.muted }}>Profile views</p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <Trophy size={20} className="mx-auto mb-1" style={{ color: colors.muted }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.resultStoryViews}
            </p>
            <p className="text-xs" style={{ color: colors.muted }}>Result story views</p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <MessageCircle size={20} className="mx-auto mb-1" style={{ color: colors.muted }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.enquirySubmits}
            </p>
            <p className="text-xs" style={{ color: colors.muted }}>Enquiries submitted</p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <UserPlus size={20} className="mx-auto mb-1" style={{ color: colors.muted }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.signupsCompleted}
            </p>
            <p className="text-xs" style={{ color: colors.muted }}>Signups completed</p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <Copy size={20} className="mx-auto mb-1" style={{ color: colors.muted }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.linkCopied}
            </p>
            <p className="text-xs" style={{ color: colors.muted }}>Link copied</p>
          </Card>
          <Card style={{ padding: spacing[16], textAlign: 'center' }}>
            <Share2 size={20} className="mx-auto mb-1" style={{ color: colors.muted }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
              {stats.linkShared}
            </p>
            <p className="text-xs" style={{ color: colors.muted }}>Link shared</p>
          </Card>
        </div>

        {/* Personal to Coach conversion (marketplace funnel) */}
        {personalConversion != null && (
          <>
            <h2 className="text-sm font-semibold mt-2" style={{ color: colors.text }}>
              Personal to Coach conversion
            </h2>
            <Card style={{ padding: spacing[16] }}>
              <p className="text-xs mb-3" style={{ color: colors.muted }}>
                Personal users who found you via Find a Coach → profile view → enquiry → joined as client.
              </p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div>
                  <p className="text-xs" style={{ color: colors.muted }}>Profile views</p>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>{personalConversion.profile_views}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: colors.muted }}>Enquiries</p>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>{personalConversion.enquiries}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: colors.muted }}>Converted to client</p>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>{personalConversion.converted}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: colors.muted }}>Conversion rate</p>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>
                    {personalConversion.conversion_rate != null ? `${(personalConversion.conversion_rate * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Referral analytics: conversion + enquiries by type */}
        <h2 className="text-sm font-semibold mt-2" style={{ color: colors.text }}>
          Referral analytics
        </h2>
        <Card style={{ padding: spacing[16] }}>
          <div className="flex flex-wrap gap-4 items-center mb-3">
            <div>
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Conversion (enquiries / profile views)</p>
              <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>
                {stats.profileViews
                  ? `${((stats.enquirySubmits / stats.profileViews) * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Enquiries by type</p>
          <div className="flex flex-wrap gap-3">
            <span className="text-sm" style={{ color: colors.text }}>
              Transformation: <strong>{stats.enquiriesByType?.transformation ?? 0}</strong>
            </span>
            <span className="text-sm" style={{ color: colors.text }}>
              Competition / Prep: <strong>{stats.enquiriesByType?.competition ?? 0}</strong>
            </span>
            <span className="text-sm" style={{ color: colors.text }}>
              General: <strong>{stats.enquiriesByType?.general ?? 0}</strong>
            </span>
          </div>
        </Card>

        {/* Actions */}
        <h2 className="text-sm font-semibold" style={{ color: colors.text }}>
          Actions
        </h2>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={handleCopyLink}
            disabled={!referralLink}
          >
            <Copy size={18} className="mr-2" />
            Copy referral link
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={handleShareProfile}
            disabled={!publicProfileLink && !referralLink}
          >
            <Share2 size={18} className="mr-2" />
            Share profile
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={handleOpenPublicProfile}
            disabled={!publicProfileLink}
          >
            <ExternalLink size={18} className="mr-2" />
            Open public profile
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={handleViewEnquiries}
          >
            <Inbox size={18} className="mr-2" />
            View enquiries
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => navigate('/marketplace-setup')}
          >
            <Store size={18} className="mr-2" />
            Set up marketplace listing
          </Button>
          <Button
            className="w-full justify-start"
            onClick={handleCreateResultStory}
          >
            <Plus size={18} className="mr-2" />
            Create result story
          </Button>
        </div>
      </div>
    </div>
  );
}
