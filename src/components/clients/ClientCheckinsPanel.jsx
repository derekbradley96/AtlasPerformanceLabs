/**
 * Client Detail – Check-ins segment: list of check-ins with review status.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';

export default function ClientCheckinsPanel({
  clientId,
  checkInsList = [],
  getCheckinReviewed,
  formatShortDate,
  onCheckinSelect,
}) {
  const navigate = useNavigate();

  if (!Array.isArray(checkInsList) || checkInsList.length === 0) {
    return (
      <EmptyState
        title="No check-ins yet"
        description="Check-ins from your client will appear here. You can request one from the overview."
        icon={ClipboardList}
      />
    );
  }

  return (
    <div className="app-card overflow-hidden">
      {checkInsList.map((c, i) => {
        if (c == null) return null;
        const isReviewed = getCheckinReviewed(c?.id);
        const needsReview = !isReviewed && c?.status === 'submitted' && ((c?.flags?.length ?? 0) > 0 || (c?.adherence_pct != null && c.adherence_pct < 80));
        const dateStr = formatShortDate(c?.submitted_at ?? c?.created_date ?? '');
        const handlePress = () => {
          if (typeof onCheckinSelect === 'function') onCheckinSelect(c);
          else if (clientId && c?.id) navigate(`/clients/${clientId}/checkins/${c.id}`);
        };
        return (
          <button
            key={c?.id ?? `ci-${i}`}
            type="button"
            onClick={handlePress}
            className="w-full flex items-center gap-3 text-left active:opacity-90"
            style={{
              minHeight: touchTargetMin,
              padding: spacing[16],
              borderBottom: i < checkInsList.length - 1 ? `1px solid ${colors.border}` : 'none',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[15px] font-medium" style={{ color: colors.text }}>{dateStr}</p>
                {needsReview && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: colors.warningSubtle, color: colors.warning }}>Needs review</span>
                )}
                {isReviewed && (
                  <span className="text-xs" style={{ color: colors.success }}>Reviewed</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs mt-0.5" style={{ color: colors.muted }}>
                {c.adherence_pct != null && <span>{c.adherence_pct}% adherence</span>}
                {c.weight_kg != null && <span>{c.weight_kg} kg</span>}
                {c.status === 'pending' && <span>Pending</span>}
                {c.status === 'submitted' && c.adherence_pct == null && c.weight_kg == null && <span>Submitted</span>}
              </div>
            </div>
            <ChevronRight size={18} style={{ color: colors.muted }} className="flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
