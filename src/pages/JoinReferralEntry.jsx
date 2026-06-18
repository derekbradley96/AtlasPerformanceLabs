import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invokeSupabaseFunction } from '@/lib/supabaseStripeApi';
import { isEliteTier } from '@/config/plans';
import CoachCustomOnboardingPage from '@/pages/CoachCustomOnboardingPage';
import OnboardPage from '@/pages/OnboardPage';
import { colors } from '@/ui/tokens';
import PageMeta from '@/components/seo/PageMeta';

async function fetchPublicCoach(slug) {
  const { data, error } = await invokeSupabaseFunction('public-coach-profile', { slug });
  if (error) throw new Error(error);
  return data ?? {};
}

export default function JoinReferralEntry() {
  const { referralCode } = useParams();
  const slug = (referralCode ?? '').toString().trim();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['join-referral-entry', slug],
    queryFn: () => fetchPublicCoach(slug),
    enabled: !!slug,
    staleTime: 60_000,
  });

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.bg, color: colors.muted }}>
        <PageMeta title="Join" description="Invalid invite link." />
        <p>Invalid link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.bg, color: colors.muted }}>
        <PageMeta title="Join" description="Loading…" />
        <p>Loading…</p>
      </div>
    );
  }

  if (isError || !data?.coach) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.bg, color: colors.muted }}>
        <PageMeta title="Join" description="Coach not found." />
        <p>We couldn&apos;t find this invite. Check the link or ask your coach for a new code.</p>
      </div>
    );
  }

  const coach = data.coach;
  const elite = isEliteTier(coach.plan_tier);
  const headlineSet = !!(coach.onboarding_headline && String(coach.onboarding_headline).trim());

  if (elite && headlineSet) {
    return <CoachCustomOnboardingPage publicData={data} referralCode={slug} />;
  }

  return <OnboardPage embeddedSlug={slug} />;
}
