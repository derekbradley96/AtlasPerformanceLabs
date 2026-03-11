import React from 'react';
import { Trophy, Clock, Scale, Dumbbell, Target } from 'lucide-react';
import { colors, spacing } from '@/ui/tokens';
import { MILESTONE_DEFS, getMilestoneCategory } from '@/lib/milestonesStore';
import { markAchievementShown } from '@/lib/milestonesStore';

const CATEGORY_ICONS = {
  time: Clock,
  weight: Scale,
  strength: Dumbbell,
  adherence: Target,
  streak: Target,
  loyalty: Clock,
  weight_2_5: Scale,
};
const CATEGORY_COLORS = {
  time: '#3B82F6',
  weight: '#22C55E',
  strength: '#F59E0B',
  adherence: '#8B5CF6',
  streak: '#8B5CF6',
  loyalty: '#3B82F6',
};

export default function AchievementUnlockedModal({ record, onClose, onSendCelebrationMessage, onShareGraphic }) {
  if (!record) return null;
  const def = MILESTONE_DEFS.find((d) => d.id === record.milestoneId);
  const category = record.type || getMilestoneCategory(record.milestoneId);
  const Icon = CATEGORY_ICONS[category] || Trophy;
  const color = CATEGORY_COLORS[category] || '#EAB308';
  const title = record.title ?? def?.title ?? 'Achievement unlocked';
  const description = record.description ?? def?.description ?? '';
  const statImprovement = record.statImprovement;

  const handleClose = () => {
    markAchievementShown(record.id);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-title"
    >
      <div
        className="rounded-2xl overflow-hidden max-w-sm w-full"
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          padding: spacing[24],
        }}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `${color}22`, color }}
          >
            <Icon size={32} />
          </div>
        </div>
        <h2 id="achievement-title" className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Milestone unlocked
        </h2>
        <p className="text-base font-semibold text-center mb-1" style={{ color: colors.accent }}>
          {title}
        </p>
        {statImprovement && (
          <p className="text-sm text-center mb-2 font-medium" style={{ color: colors.text }}>
            {statImprovement}
          </p>
        )}
        {description && (
          <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
            {description}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {onSendCelebrationMessage && (
            <button
              type="button"
              onClick={() => { onSendCelebrationMessage(); handleClose(); }}
              className="w-full py-3 rounded-xl font-semibold text-center"
              style={{ background: colors.accent, color: colors.bg }}
            >
              Send celebration message
            </button>
          )}
          {onShareGraphic && (
            <button
              type="button"
              onClick={() => { onShareGraphic(); handleClose(); }}
              className="w-full py-3 rounded-xl font-semibold text-center border"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              Share graphic template
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 rounded-xl font-semibold text-center"
            style={{ color: colors.muted }}
          >
            {onSendCelebrationMessage || onShareGraphic ? 'Maybe later' : 'Nice!'}
          </button>
        </div>
      </div>
    </div>
  );
}
