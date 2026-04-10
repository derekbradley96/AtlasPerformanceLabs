import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Store } from 'lucide-react';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, radii, shadows } from '@/ui/tokens';
import { hapticLight } from '@/lib/haptics';
import {
  computeCoachProfileCompletion,
  coachMarketplaceCompletionMilestone,
  milestoneLabelCopy,
  MARKETPLACE_COMPLETION_CHECKLIST,
} from '@/lib/coachProfileCompletion';
export default function MarketplaceProgressCard({ listing, profile, onNavigate }) {
  const navigate = useNavigate();

  const { coach_profile_completion, completion_percentage } = useMemo(
    () => computeCoachProfileCompletion(listing, profile),
    [listing, profile],
  );

  const milestone = coachMarketplaceCompletionMilestone(completion_percentage);
  const milestoneLabel = milestoneLabelCopy(milestone);

  const go = (path) => {
    hapticLight();
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  const previewSlug = String(listing?.slug || '').trim();
  const previewPath = previewSlug ? `/marketplace/coach/${encodeURIComponent(previewSlug)}` : '/marketplace-setup';

  return (
    <Card
      style={{
        padding: spacing[16],
        borderRadius: radii.lg,
        border: `1px solid ${colors.primary}44`,
        background: `linear-gradient(155deg, ${colors.primarySubtle} 0%, ${colors.surface1} 55%)`,
        boxShadow: shadows.cardShadow,
        marginBottom: spacing[16],
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="shrink-0 rounded-xl flex items-center justify-center"
          style={{ width: 40, height: 40, background: colors.primarySubtle, color: colors.primary }}
        >
          <Store size={20} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: colors.accent, letterSpacing: '0.06em' }}>
            {milestoneLabel}
          </p>
          <h2 className="text-lg font-semibold leading-snug" style={{ color: colors.text }}>
            Get discovered by new clients
          </h2>
          <p className="text-sm mt-1" style={{ color: colors.muted }}>
            Your profile is {completion_percentage}% complete
          </p>
        </div>
      </div>

      <div
        className="w-full rounded-full overflow-hidden mb-4"
        style={{ height: 8, background: colors.surface2, border: `1px solid ${colors.border}` }}
        role="progressbar"
        aria-valuenow={completion_percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${completion_percentage}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
            transition: 'width 0.35s ease',
          }}
        />
      </div>

      <ul className="space-y-0 mb-4" style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, overflow: 'hidden' }}>
        {MARKETPLACE_COMPLETION_CHECKLIST.map(({ key, label, path }) => {
          const done = !!coach_profile_completion[key];
          return (
            <li key={key} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left py-3 px-3 min-h-[48px]"
                style={{
                  background: done ? 'transparent' : colors.surface2,
                  color: colors.text,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => go(path)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 inline-flex items-center justify-center rounded-full"
                    style={{
                      width: 22,
                      height: 22,
                      border: `1px solid ${done ? colors.success : colors.border}`,
                      background: done ? colors.successSubtle : 'transparent',
                      color: done ? colors.success : colors.muted,
                    }}
                  >
                    {done ? <Check size={14} strokeWidth={2.5} /> : null}
                  </span>
                  <span className={`text-sm truncate ${done ? 'line-through opacity-70' : 'font-medium'}`}>{label}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 opacity-50" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" className="flex-1 font-semibold min-h-[48px]" onClick={() => go('/marketplace-setup')}>
          Complete profile
        </Button>
        <Button type="button" variant="outline" className="flex-1 font-semibold min-h-[48px]" onClick={() => go(previewPath)}>
          Preview profile
        </Button>
      </div>
    </Card>
  );
}
