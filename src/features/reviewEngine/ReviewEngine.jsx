import React from 'react';
import { MessageSquare } from 'lucide-react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import ReviewHeader from './ReviewHeader';
import ReviewDiffGrid from './ReviewDiffGrid';
import ReviewNotesBlock from './ReviewNotesBlock';
import ReviewQuickReplies, { DEFAULT_QUICK_REPLY_CHIPS, POSING_QUICK_REPLY_CHIPS } from './ReviewQuickReplies';
import ReviewActions from './ReviewActions';
import ReviewDiffRows from './ReviewDiffRows';

const BORDER = 'rgba(255,255,255,0.06)';

/**
 * Shared review screen: header, phase context (optional), diff grid, diff rows (optional), warnings (optional),
 * intelligence/actions, coach notes + quick replies, bottom bar.
 *
 * @param {{
 *   item: import('./types').ReviewItem
 *   coachResponse: string
 *   onCoachResponseChange: (v: string) => void
 *   onMarkReviewed: () => void
 *   onMessageClient: (prefilled?: string) => void
 *   onOpenProgram?: () => void
 *   quickReplyChips?: string[]
 *   children?: React.ReactNode
 * }} props
 */
export default function ReviewEngine({
  item,
  coachResponse,
  onCoachResponseChange,
  onMarkReviewed,
  onMessageClient,
  onOpenProgram,
  quickReplyChips,
  children,
}) {
  const chips = quickReplyChips ?? (item.type === 'posing' ? POSING_QUICK_REPLY_CHIPS : item.type === 'photo' ? POSING_QUICK_REPLY_CHIPS : DEFAULT_QUICK_REPLY_CHIPS);
  const insertChip = (text) => {
    onCoachResponseChange(coachResponse ? `${coachResponse}\n${text}` : text);
  };

  const typeLabel = item.type === 'posing' ? 'Posing submission' : item.type === 'photo' ? 'Progress photos' : 'Check-in';
  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div
      className="min-w-0 max-w-full overflow-x-hidden flex flex-col flex-1 min-h-0"
      style={{ background: colors.bg, color: colors.text }}
    >
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
          paddingTop: spacing[12],
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <ReviewHeader
          clientName={item.title}
          typeLabel={typeLabel}
          dateOrSubtitle={item.subtitle ?? dateStr}
        />

        {item.phaseContext && (
          <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
            <p className="text-[12px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Phase context</p>
            <p className="text-[15px] font-medium" style={{ color: colors.text, marginBottom: spacing[6] }}>{item.phaseContext.label}</p>
            <p className="text-[13px]" style={{ color: colors.muted }}>{item.phaseContext.expectation}</p>
          </Card>
        )}

        <ReviewDiffGrid left={item.left} right={item.right} />

        {item.diffRows?.length > 0 && <ReviewDiffRows rows={item.diffRows} />}

        {item.warnings?.length > 0 && (
          <Card style={{ marginBottom: spacing[16], borderLeft: `4px solid ${colors.warning}` }}>
            {item.warnings.map((w, i) => (
              <p key={i} className="text-[13px] font-medium" style={{ color: colors.warning }}>⚠ {w}</p>
            ))}
          </Card>
        )}

        <ReviewActions
          onMarkReviewed={onMarkReviewed}
          onMessageClient={() => onMessageClient(coachResponse || undefined)}
          onOpenProgram={onOpenProgram}
          showIntelligence={item.type === 'checkin'}
          riskReasons={item.riskReasons}
          suggestedAction={item.suggestedAction}
        />

        <ReviewNotesBlock value={coachResponse} onChange={onCoachResponseChange} />
        <Card style={{ marginBottom: spacing[16] }}>
          <ReviewQuickReplies chips={chips} onInsert={insertChip} />
        </Card>

        {children}
      </div>

      <div
        className="flex flex-col gap-3 flex-shrink-0"
        style={{
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
          paddingTop: spacing[12],
          paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
          background: colors.bg,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <Button variant="primary" onClick={onMarkReviewed}>Mark Reviewed</Button>
        <Button variant="secondary" onClick={() => onMessageClient(coachResponse || undefined)}>
          <MessageSquare size={18} style={{ marginRight: 8 }} /> Message Client
        </Button>
      </div>
    </div>
  );
}
