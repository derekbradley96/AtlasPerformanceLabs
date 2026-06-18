import React from 'react';
import { ChevronDown } from 'lucide-react';
import Card from '@/ui/Card';
import PressableCard from '@/components/PressableCard';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, sectionGap } from '@/ui/pageLayout';
import { hapticLight } from '@/lib/haptics';

/**
 * Collapsible comp-prep tooling strip (check-ins, posing, peak week, pose due, churn alerts).
 */
export default function CoachHomePrepToolsSection({
  showPrepTools,
  setShowPrepTools,
  isIntegratedCoach,
  cardStyle,
  reviewCountsByType,
  peakWeekDueCount,
  poseDue,
  churnAlerts,
  navigate,
}) {
  return (
    <section style={{ marginBottom: sectionGap }}>
      <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
        <span style={sectionLabel}>Comp prep tools</span>
        <button
          type="button"
          onClick={() => setShowPrepTools((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: colors.primary, background: 'none', border: 'none' }}
        >
          {showPrepTools ? 'Collapse' : 'See prep tools'}
          <ChevronDown size={14} style={{ transform: showPrepTools ? 'rotate(180deg)' : 'none', transition: 'transform 140ms ease' }} />
        </button>
      </div>
      {showPrepTools ? (
        <Card style={{ ...cardStyle, padding: spacing[16], border: `1px solid ${colors.border}` }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
            Prep priorities
          </p>
          <p className="text-xs mb-3" style={{ color: colors.muted }}>
            {isIntegratedCoach
              ? 'Prep tools (posing, peak week) apply to competition clients. Lifestyle clients live in Programs & check-ins — use roster filters on Clients to switch context.'
              : 'Large roster mode: highest-risk and time-sensitive items first. Tap a row to act.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <PressableCard
              className="rounded-xl p-3 text-left"
              style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              onClick={() => { hapticLight(); navigate('/review-center'); }}
            >
              <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Check-ins</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: reviewCountsByType.checkin > 0 ? colors.warning : colors.text }}>
                {reviewCountsByType.checkin}
              </p>
              <p className="text-[11px] mt-1" style={{ color: colors.muted }}>In queue</p>
            </PressableCard>
            <PressableCard
              className="rounded-xl p-3 text-left"
              style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              onClick={() => { hapticLight(); navigate('/review-center/pose-checks'); }}
            >
              <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Posing</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: reviewCountsByType.pose_check > 0 ? colors.primary : colors.text }}>
                {reviewCountsByType.pose_check}
              </p>
              <p className="text-[11px] mt-1" style={{ color: colors.muted }}>To review</p>
            </PressableCard>
            <PressableCard
              className="rounded-xl p-3 text-left"
              style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              onClick={() => { hapticLight(); navigate('/peak-week-command-center'); }}
            >
              <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Peak week</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: peakWeekDueCount > 0 ? colors.warning : colors.text }}>
                {peakWeekDueCount}
              </p>
              <p className="text-[11px] mt-1" style={{ color: colors.muted }}>Clients due</p>
            </PressableCard>
            <PressableCard
              className="rounded-xl p-3 text-left"
              style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
              onClick={() => { hapticLight(); navigate('/clients'); }}
            >
              <p className="text-[11px] font-semibold uppercase" style={{ color: colors.muted }}>Pose due</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: poseDue.length > 0 ? colors.warning : colors.text }}>
                {poseDue.length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: colors.muted }}>No weekly submission</p>
            </PressableCard>
          </div>
          {churnAlerts.length > 0 && (
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase mb-2" style={{ color: colors.danger }}>High churn risk</p>
              <ul className="space-y-1">
                {churnAlerts.map((a) => (
                  <li key={a.client_id}>
                    <button
                      type="button"
                      className="text-sm font-medium text-left w-full py-1.5 rounded-lg px-2 -mx-2"
                      style={{ color: colors.text, background: 'transparent', border: 'none', cursor: 'pointer' }}
                      onClick={() => { hapticLight(); navigate(`/clients/${a.client_id}`); }}
                    >
                      {a.client_name || 'Client'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ ...cardStyle, padding: spacing[14] }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            Prep tooling stays available for integrated coaches, but is collapsed by default to keep daily operations focused.
          </p>
        </Card>
      )}
    </section>
  );
}
