import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import PageMeta from '@/components/seo/PageMeta';

/**
 * Elite custom join landing — data from public-coach-profile Edge Function.
 * @param {{ publicData: object, referralCode: string }} props
 */
export default function CoachCustomOnboardingPage({ publicData, referralCode }) {
  const navigate = useNavigate();
  const coach = publicData?.coach ?? {};
  const name = coach.name || 'Coach';
  const headline = (coach.onboarding_headline || '').toString().trim() || `Join ${name}`;
  const message = (coach.onboarding_message || '').toString().trim();
  const bullets = Array.isArray(coach.onboarding_bullets) ? coach.onboarding_bullets.map((x) => String(x)).filter(Boolean) : [];
  const logo = (coach.brand_logo_url || coach.avatar_url || '').toString().trim();
  const accent = (coach.brand_accent_colour || '#3B82F6').toString().trim();
  const clientsCoached = Number(publicData?.clients_coached_count) || 0;
  const avgKg = publicData?.showcase_stats?.avg_transformation_kg;
  const avgH = publicData?.showcase_stats?.avg_response_hours;
  const signupUrl = getCoachClientJoinLinkPrimary(referralCode, coach.id);

  const socialLine = useMemo(() => {
    const parts = [];
    if (clientsCoached > 0) parts.push(`${clientsCoached} client${clientsCoached === 1 ? '' : 's'} coached`);
    if (avgKg != null && Number.isFinite(Number(avgKg)) && Number(avgKg) > 0) {
      parts.push(`avg ${Number(avgKg).toFixed(1)} kg movement (12-week window)`);
    } else if (avgH != null && Number.isFinite(Number(avgH)) && Number(avgH) > 0) {
      parts.push(`avg ${Number(avgH).toFixed(1)}h check-in feedback`);
    } else {
      parts.push('programs built on real check-ins and adherence');
    }
    return parts.join(' · ');
  }, [clientsCoached, avgKg, avgH]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <PageMeta title={`${headline} — ${name}`} description={message || `Join ${name} on Atlas.`} />
      <div className="max-w-md mx-auto w-full py-6">
        <div className="flex flex-col items-center text-center mb-6">
          {logo ? (
            <img src={logo} alt="" style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: `2px solid ${colors.border}` }} />
          ) : null}
          <h1 className="text-xl font-bold mt-4 mb-2" style={{ color: colors.text }}>{headline}</h1>
          {message ? (
            <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>{message}</p>
          ) : null}
        </div>

        {bullets.length > 0 ? (
          <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>
              What you&apos;ll get
            </p>
            <ul className="m-0 pl-4 space-y-2 text-sm" style={{ color: colors.text }}>
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card style={{ padding: spacing[14], marginBottom: spacing[20], background: colors.surface1 }}>
          <p className="text-xs m-0" style={{ color: colors.muted }}>{socialLine}</p>
        </Card>

        <Button
          type="button"
          variant="primary"
          style={{ width: '100%', minHeight: 48, background: accent, color: '#fff' }}
          onClick={() => {
            if (signupUrl) window.location.href = signupUrl;
            else navigate('/auth?mode=signup&account=client');
          }}
        >
          Join {name.split(' ')[0]}&apos;s coaching
        </Button>
        <button
          type="button"
          className="w-full text-center text-xs mt-4 font-medium"
          style={{ color: colors.muted, background: 'none', border: 'none' }}
          onClick={() => navigate('/auth')}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
