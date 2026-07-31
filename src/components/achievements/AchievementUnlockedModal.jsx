import React, { useEffect, useCallback, useState } from 'react';
import { Trophy, Clock, Scale, Dumbbell, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { colors, spacing } from '@/ui/tokens';
import { MILESTONE_DEFS, getMilestoneCategory, markAchievementShown } from '@/lib/milestonesStore';
import { insertSharedMilestone } from '@/data/sharedMilestonesRepo';
import { renderAchievementShareBlob, isSignificantShareableMilestone } from '@/lib/achievementShareGraphic';
import { sharePlainText } from '@/lib/nativeShare';

async function launchConfetti(options) {
  try {
    const mod = await import('canvas-confetti');
    const confetti = mod?.default || mod;
    if (typeof confetti === 'function') confetti(options);
  } catch {
    // Non-blocking visual effect; ignore failure.
  }
}

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

async function shareAchievementNative({ text, url, imageBlob }) {
  const body = [String(text || '').trim(), String(url || '').trim()].filter(Boolean).join('\n');
  if (!body) return false;
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: 'Atlas milestone',
        text: body,
        url: url || undefined,
        dialogTitle: 'Share achievement',
      });
      return true;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      if (imageBlob && navigator.canShare) {
        try {
          const file = new File([imageBlob], 'atlas-milestone.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: body });
            return true;
          }
        } catch {
          /* fall through */
        }
      }
      await navigator.share({ title: 'Atlas milestone', text: body });
      return true;
    }
    return sharePlainText(body, 'Share achievement');
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) return false;
    return sharePlainText(body, 'Share achievement');
  }
}

/**
 * @param {{
 *   record: object,
 *   onClose: () => void,
 *   onSendCelebrationMessage?: () => void,
 *   onShareGraphic?: () => void,
 *   coachName?: string | null,
 *   coachMilestoneNote?: string | null,
 *   coachReferralLink?: string | null,
 *   clientFirstName?: string | null,
 *   clientId?: string | null,
 * }} props
 */
export default function AchievementUnlockedModal({
  record,
  onClose,
  onSendCelebrationMessage,
  onShareGraphic,
  coachName,
  coachMilestoneNote,
  coachReferralLink,
  clientFirstName,
  clientId,
}) {
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const handleClose = useCallback(() => {
    if (!record?.id) return;
    markAchievementShown(record.id);
    onClose?.();
  }, [record?.id, onClose]);

  useEffect(() => {
    if (!record?.id) return;
    const fire = async () => {
      await launchConfetti({
        particleCount: 110,
        spread: 70,
        startVelocity: 35,
        origin: { y: 0.75 },
      });
    };
    void fire();
  }, [record?.id]);

  if (!record) return null;
  const def = MILESTONE_DEFS.find((d) => d.id === record.milestoneId);
  const category = record.type || getMilestoneCategory(record.milestoneId);
  const Icon = CATEGORY_ICONS[category] || Trophy;
  const color = CATEGORY_COLORS[category] || '#EAB308';
  const title = record.title ?? def?.title ?? 'Achievement unlocked';
  const description = record.description ?? def?.description ?? '';
  const statImprovement = record.statImprovement;
  const coachDisplay = coachName?.trim() || 'Your coach';
  const hasCoach = Boolean(coachName?.trim() || clientId);
  const milestoneDescription = title;
  const firstName = (clientFirstName || 'You').trim();
  const referral = (coachReferralLink || '').trim();
  const shareLine = `Just hit a new milestone with Atlas — ${milestoneDescription}!${coachName?.trim() ? ` Coached by ${coachDisplay}.` : ''}${referral ? ` ${referral}` : ''}`;
  const significant = isSignificantShareableMilestone(record.milestoneId);
  const celebrationLine =
    (coachMilestoneNote && String(coachMilestoneNote).trim()) ||
    (hasCoach
      ? `${coachDisplay} will see this achievement in their weekly briefing.`
      : 'Logged to your milestones — see your full journey in Progress.');

  const onShareAchievement = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      let blob = null;
      if (significant) {
        blob = await renderAchievementShareBlob({
          clientFirstName: firstName,
          milestoneDescription,
          achievedDateLabel: new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
        });
      }
      const didShare = await shareAchievementNative({ text: shareLine, url: referral || undefined, imageBlob: blob });
      if (didShare && clientId) {
        await insertSharedMilestone({
          clientId,
          milestoneKey: String(record.milestoneId),
          milestoneLabel: milestoneDescription,
        });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
    >
      <motion.div
        className="rounded-2xl overflow-hidden max-w-sm w-full max-h-[90vh] overflow-y-auto"
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          padding: spacing[24],
        }}
        initial={{ scale: 0.75, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `${color}22`, color }}
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.08, 1] }}
            transition={{ duration: 0.45 }}
          >
            <Icon size={32} />
          </motion.div>
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
          <p className="text-sm text-center mb-3" style={{ color: colors.muted }}>
            {description}
          </p>
        )}
        <p className="text-xs text-center mb-4 leading-relaxed" style={{ color: colors.muted }}>
          {celebrationLine}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void onShareAchievement()}
            disabled={sharing}
            className="w-full py-3 rounded-xl font-semibold text-center"
            style={{ background: colors.primary, color: '#fff', opacity: sharing ? 0.7 : 1 }}
          >
            {sharing ? 'Preparing…' : 'Share my achievement'}
          </button>
          <button
            type="button"
            onClick={() => {
              handleClose();
              navigate('/progress');
            }}
            className="w-full py-3 rounded-xl font-semibold text-center border"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            See your full journey
          </button>
          {onSendCelebrationMessage && (
            <button
              type="button"
              onClick={() => {
                onSendCelebrationMessage();
                handleClose();
              }}
              className="w-full py-3 rounded-xl font-semibold text-center"
              style={{ background: colors.accent, color: colors.bg }}
            >
              Send celebration message
            </button>
          )}
          {onShareGraphic && (
            <button
              type="button"
              onClick={() => {
                onShareGraphic();
                handleClose();
              }}
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
            Nice!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
