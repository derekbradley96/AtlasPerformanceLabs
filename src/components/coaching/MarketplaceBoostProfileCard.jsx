import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ImageIcon, Quote, Crosshair } from 'lucide-react';
import Card from '@/ui/Card';
import PressableCard from '@/components/PressableCard';
import { colors, spacing, radii, shadows } from '@/ui/tokens';
import { hapticLight } from '@/lib/haptics';

const BOOST_ACTIONS = [
  {
    id: 'photos',
    title: 'Add transformation photos',
    subtitle: 'Show proof on your public profile',
    icon: ImageIcon,
    path: '/profile-account',
  },
  {
    id: 'testimonials',
    title: 'Add testimonials',
    subtitle: 'Trust & credibility on your listing',
    icon: Quote,
    path: '/marketplace-setup#listing-section-trust',
  },
  {
    id: 'niche',
    title: 'Define niche',
    subtitle: 'Tags & who you help best',
    icon: Crosshair,
    path: '/marketplace-setup#listing-section-positioning',
  },
];

export default function MarketplaceBoostProfileCard() {
  const navigate = useNavigate();

  return (
    <Card
      style={{
        padding: spacing[16],
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
        boxShadow: shadows.cardShadow,
        marginBottom: spacing[16],
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="shrink-0 rounded-xl flex items-center justify-center"
          style={{ width: 40, height: 40, background: colors.surface2, color: colors.primary }}
        >
          <Sparkles size={20} strokeWidth={2} aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-snug" style={{ color: colors.text }}>
            Boost your profile
          </h2>
          <p className="text-sm mt-1" style={{ color: colors.muted }}>
            Go further — optional polish that increases enquiries.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {BOOST_ACTIONS.map(({ id, title, subtitle, icon: Icon, path }) => (
          <PressableCard
            key={id}
            className="rounded-xl p-3 text-left flex items-start gap-3"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
            onClick={() => {
              hapticLight();
              navigate(path);
            }}
          >
            <Icon size={20} className="shrink-0 mt-0.5" style={{ color: colors.primary }} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: colors.text }}>
                {title}
              </p>
              <p className="text-[12px] mt-0.5 leading-snug" style={{ color: colors.muted }}>
                {subtitle}
              </p>
            </div>
          </PressableCard>
        ))}
      </div>
    </Card>
  );
}
