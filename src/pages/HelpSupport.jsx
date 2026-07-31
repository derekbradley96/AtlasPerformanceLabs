import React, { useState } from 'react';
import { PageLoader } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { resolveCoachPlanTier, isEliteTier } from '@/config/plans';
import { Mail, MessageSquare, Bug, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { isCoach, isPersonal } from '@/lib/roles';
import TopBar from '@/components/ui/TopBar';
import { colors, spacing, radii, shell, touchTargetMin } from '@/ui/tokens';

const SUPPORT_EMAIL = 'customerservice@atlasperformancelabs.co.uk';

export default function HelpSupport() {
  const navigate = useNavigate();
  const { user: authUser, profile, coachBrand, isDemoMode, isLoadingAuth, effectiveRole, role } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState(null);
  const displayUser = authUser;

  const loading = !isDemoMode && isLoadingAuth;

  const helpLinks = [
    {
      title: 'Contact Support',
      description: 'Email our support team — we reply to every message',
      icon: Mail,
      action: () => window.open(`mailto:${SUPPORT_EMAIL}`)
    },
    {
      title: 'Send Feedback',
      description: 'Tell us what to improve or what you love',
      icon: MessageSquare,
      action: () => navigate('/feedback')
    },
    {
      title: 'Report a Bug',
      description: 'Something broken? Send it straight to us',
      icon: Bug,
      action: () => navigate('/report-bug')
    }
  ];

  const clientFaqs = [
    {
      q: 'How do I find and connect with a trainer?',
      a: 'Visit the Coaches section, browse available trainers, and click Connect. You may need an invite code from your trainer.'
    },
    {
      q: 'How does the payment system work?',
      a: 'Once you connect with a trainer, you\'ll be charged monthly for their coaching service. Payments are secure and handled through Stripe.'
    },
    {
      q: 'How do I cancel my subscription?',
      a: 'You can cancel anytime from Profile > Subscription. Access continues until the end of your current billing period.'
    },
    {
      q: 'What if I need to change trainers?',
      a: 'Cancel your current subscription and connect with a new trainer. There\'s no lock-in period.'
    },
    {
      q: 'Can I log workouts offline?',
      a: 'Yes! Changes sync automatically when you reconnect to the internet.'
    },
    {
      q: 'How is my data kept private?',
      a: 'We collect workout data and check-ins only for your fitness journey. See our Privacy Policy for full details.'
    }
  ];

  // Personal (self-coached) users built their own plan — swap the trainer-funnel
  // FAQ for a self-serve one; the rest of the client answers still apply.
  const personalFaqs = [
    {
      q: 'How do I edit my plan?',
      a: 'Open My programme from Home, tap any day to edit exercises, sets, and targets.'
    },
    {
      q: 'How do I set my nutrition targets?',
      a: 'Open Nutrition and tap Edit targets. Calories drive the budget and the presets fill in sensible protein, carbs, and fats — override any number you like.'
    },
    // Trainer/payment questions don't apply to self-coached users.
    ...clientFaqs.filter((f) => /offline|private/i.test(f.q))
  ];

  const trainerFaqs = [
    {
      q: 'How do I share my invite code with clients?',
      a: 'Your unique invite code is on your Profile page. Share it with potential clients so they can connect with you during onboarding.'
    },
    {
      q: 'How do I get paid?',
      a: 'Connect your Stripe account in Settings. Client payments are deposited to your account, minus the commission for your plan tier.'
    },
    {
      q: 'What\'s the platform fee?',
      a: 'It depends on your plan: Basic is free with 10% commission on client payments, Pro is £59/month with 3%, and Elite is £89/month with 0%. Compare plans any time in Plan & Billing.'
    },
    {
      q: 'Can I pause accepting new clients?',
      a: 'Yes. Go to Edit Profile > Coaching & Service Setup and toggle "Accepting New Clients" to off.'
    },
    {
      q: 'How do I set my pricing?',
      a: 'Edit your profile and set your monthly rate in the Coaching & Service Setup section. Clients are billed this amount each month.'
    },
    {
      q: 'What if a client cancels?',
      a: 'You\'ll be notified immediately. Access to that client\'s data continues for 30 days, then is archived.'
    }
  ];

  const faqs = isCoach(displayUser?.user_type ?? displayUser?.role)
    ? trainerFaqs
    : isPersonal(effectiveRole ?? role)
      ? personalFaqs
      : clientFaqs;
  const coachPlanTier = resolveCoachPlanTier(profile, authUser);
  const eliteCoachSupport =
    isCoach(displayUser?.user_type ?? displayUser?.role) && isEliteTier(coachPlanTier);
  const hideAtlasFooter = coachBrand?.name && isEliteTier(coachBrand?.coachPlanTier);

  if (!isDemoMode && loading) return <PageLoader />;
  if (!displayUser) return <PageLoader />;

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))` }}>
      <TopBar title="Help & Support" onBack={() => navigate(createPageUrl('Profile'))} />
      <div style={{ maxWidth: 480, margin: '0 auto', paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: spacing[16] }}>
        {eliteCoachSupport ? (
          <div style={{ marginBottom: spacing[16], padding: spacing[14], borderRadius: radii.card, border: `1px solid ${colors.warning}55`, background: 'rgba(245,158,11,0.10)' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.warning }}>⚡ Elite Support — we respond within 4 hours</p>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
              Email <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: colors.warning, fontWeight: 600 }}>{SUPPORT_EMAIL}</a> from the address on your Atlas account and include &quot;Elite&quot; in the subject line so we can prioritise your ticket.
            </p>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: spacing[10], marginBottom: spacing[24] }}>
          {helpLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.title}
                type="button"
                onClick={link.action}
                style={{ display: 'flex', alignItems: 'center', gap: spacing[12], textAlign: 'left', width: '100%', minHeight: touchTargetMin, padding: spacing[14], borderRadius: radii.card, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, cursor: 'pointer' }}
              >
                <span style={{ width: 40, height: 40, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{link.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: colors.muted, marginTop: 2 }}>{link.description}</span>
                </span>
                <ChevronRight size={16} style={{ color: colors.muted, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>

        <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>Frequently asked questions</p>
        <div style={{ display: 'grid', gap: spacing[8], marginBottom: spacing[24] }}>
          {faqs.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              style={{ textAlign: 'left', width: '100%', padding: spacing[14], borderRadius: radii.card, border: `1px solid ${expandedFaq === i ? colors.primary : colors.border}`, background: colors.surface1, color: colors.text, cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[10] }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.q}</span>
                <ChevronDown size={16} style={{ color: colors.muted, flexShrink: 0, transform: expandedFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </span>
              {expandedFaq === i && (
                <span style={{ display: 'block', fontSize: 13, color: colors.muted, marginTop: spacing[10], lineHeight: 1.5 }}>{item.a}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: spacing[10], fontSize: 12, marginBottom: spacing[24] }}>
          <a href="/privacy" style={{ color: colors.primary }}>Privacy Policy</a>
          <span style={{ color: colors.muted }}>•</span>
          <a href="/terms" style={{ color: colors.primary }}>Terms of Service</a>
        </div>

        <div style={{ textAlign: 'center' }}>
          {!hideAtlasFooter ? <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Powered by Atlas</p> : null}
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.muted }}>Atlas Performance Labs v1.0.0</p>
        </div>
      </div>
    </div>
  );
}