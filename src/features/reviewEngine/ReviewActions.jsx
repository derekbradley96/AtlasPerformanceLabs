import React from 'react';
import { MessageSquare, FileText } from 'lucide-react';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

/**
 * Mark reviewed, Send message, optional Open program.
 * @param {{
 *   onMarkReviewed: () => void
 *   onMessageClient: () => void
 *   onOpenProgram?: () => void
 *   showIntelligence?: boolean
 *   riskReasons?: string[]
 *   suggestedAction?: string
 * }} props
 */
export default function ReviewActions({
  onMarkReviewed,
  onMessageClient,
  onOpenProgram,
  showIntelligence = false,
  riskReasons = [],
  suggestedAction,
}) {
  return (
    <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
      {showIntelligence && (riskReasons?.length > 0 || suggestedAction) && (
        <>
          <p className="text-[12px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[12] }}>Intelligence</p>
          {riskReasons?.length > 0 && (
            <div style={{ marginBottom: spacing[12] }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: colors.muted }}>Why flagged</p>
              <ul className="list-disc list-inside text-[13px]" style={{ color: colors.text }}>
                {riskReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {suggestedAction && (
            <div style={{ marginBottom: spacing[12] }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: colors.muted }}>Suggested action</p>
              <p className="text-[13px]" style={{ color: colors.text }}>{suggestedAction}</p>
            </div>
          )}
          {riskReasons?.length === 0 && !suggestedAction && (
            <p className="text-[13px] mb-4" style={{ color: colors.muted }}>No flags this check-in.</p>
          )}
        </>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={onMarkReviewed}>Mark reviewed</Button>
        <Button variant="secondary" onClick={onMessageClient}>
          <MessageSquare size={18} style={{ marginRight: 8 }} /> Send quick reply
        </Button>
        {onOpenProgram && (
          <Button variant="secondary" onClick={onOpenProgram}>
            <FileText size={18} style={{ marginRight: 8 }} /> Open program
          </Button>
        )}
      </div>
    </Card>
  );
}
