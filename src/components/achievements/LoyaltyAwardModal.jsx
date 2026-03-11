import React from 'react';
import { Trophy } from 'lucide-react';
import { colors, spacing } from '@/ui/tokens';
import Button from '@/ui/Button';

export default function LoyaltyAwardModal({ months, trainerName, stats, onClose, isTrainerView, onSendMilestoneMessage }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.7)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
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
            style={{ background: 'rgba(34,197,94,0.2)', color: colors.success }}
          >
            <Trophy size={32} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Congrats!
        </h2>
        <p className="text-center mb-4" style={{ color: colors.text }}>
          {isTrainerView ? (
            <>{trainerName} for <strong>{months} month{months !== 1 ? 's' : ''}</strong>.</>
          ) : (
            <>You’ve been with {trainerName || 'your coach'} for <strong>{months} month{months !== 1 ? 's' : ''}</strong>.</>
          )}
        </p>
        {stats && (stats.weightChange != null || stats.checkInsCompleted != null || stats.streakBest != null || stats.totalWeeks != null) && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Your progress</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {stats.weightChange != null && (
                <span style={{ color: colors.text }}>Weight change: {stats.weightChange > 0 ? '+' : ''}{stats.weightChange} kg</span>
              )}
              {stats.checkInsCompleted != null && (
                <span style={{ color: colors.text }}>Check-ins: {stats.checkInsCompleted}</span>
              )}
              {stats.streakBest != null && (
                <span style={{ color: colors.text }}>Best streak: {stats.streakBest} days</span>
              )}
              {stats.totalWeeks != null && (
                <span style={{ color: colors.text }}>Total weeks: {stats.totalWeeks}</span>
              )}
              {stats.prCount != null && (
                <span style={{ color: colors.text }}>PRs: {stats.prCount}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {isTrainerView && onSendMilestoneMessage && (
            <Button variant="secondary" onClick={onSendMilestoneMessage} style={{ width: '100%' }}>
              Send milestone message
            </Button>
          )}
          <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>Awesome!</Button>
        </div>
      </div>
    </div>
  );
}
