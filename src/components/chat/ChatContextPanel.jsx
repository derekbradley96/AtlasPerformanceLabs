/**
 * Coach-only Context panel (bottom sheet): This Week Snapshot, Prep Notes, Client Summary.
 */
import React, { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { formatClientSummary } from '@/lib/chatContextSnapshot';

export default function ChatContextPanel({
  open,
  onOpenChange,
  clientName,
  snapshot,
  prepNotes,
  onPrepNotesChange,
  onShowSummary,
  onSendSummary,
  onRequestCheckIn,
  onViewClient,
  onPaymentReminder,
  lightHaptic,
}) {
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const summaryText = formatClientSummary(snapshot ?? {}, clientName);

  const handleShowClientSummary = useCallback(() => {
    lightHaptic?.();
    setShowSummaryPreview(true);
    onShowSummary?.(summaryText);
  }, [lightHaptic, summaryText, onShowSummary]);

  const handleSendToClient = useCallback(() => {
    lightHaptic?.();
    setShowSummaryPreview(false);
    onOpenChange?.(false);
    onSendSummary?.(summaryText);
  }, [lightHaptic, summaryText, onOpenChange, onSendSummary]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle style={{ color: colors.text }}>Context</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-6" style={{ paddingTop: spacing[16] }}>
          {/* 1) This Week Snapshot */}
          <section style={{ marginBottom: spacing[24] }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
              This week snapshot
            </h2>
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: colors.border, background: colors.card }}>
              <div className="grid grid-cols-2 gap-px" style={{ background: colors.border }}>
                <div className="p-3" style={{ background: colors.card }}>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Wins</p>
                  <ul className="text-[13px] space-y-0.5" style={{ color: colors.text }}>
                    {(snapshot?.wins ?? []).slice(0, 3).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3" style={{ background: colors.card }}>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Slips</p>
                  <ul className="text-[13px] space-y-0.5" style={{ color: colors.text }}>
                    {(snapshot?.slips ?? []).slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {(snapshot?.flags ?? []).length > 0 && (
                <div className="p-3 border-t" style={{ borderColor: colors.border }}>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Flags</p>
                  <ul className="text-[13px] space-y-0.5" style={{ color: colors.text }}>
                    {snapshot.flags.slice(0, 3).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-4 p-3 border-t text-[12px]" style={{ borderColor: colors.border, color: colors.muted }}>
                <span>Check-in due: {snapshot?.checkInDue ?? '—'}</span>
                <span>Last check-in: {snapshot?.lastCheckIn ?? '—'}</span>
              </div>
            </div>
            {(typeof onRequestCheckIn === 'function' || typeof onViewClient === 'function' || typeof onPaymentReminder === 'function') && (
              <div className="flex flex-wrap gap-2 mt-2">
                {onRequestCheckIn && (
                  <Button variant="secondary" size="sm" onClick={() => { lightHaptic?.(); onRequestCheckIn(); onOpenChange?.(false); }}>Request check-in</Button>
                )}
                {onViewClient && (
                  <Button variant="secondary" size="sm" onClick={() => { lightHaptic?.(); onViewClient(); onOpenChange?.(false); }}>View client</Button>
                )}
                {onPaymentReminder && (
                  <Button variant="secondary" size="sm" onClick={() => { lightHaptic?.(); onPaymentReminder(); onOpenChange?.(false); }}>Payment reminder</Button>
                )}
              </div>
            )}
          </section>

          {/* 2) Coach Prep Notes */}
          <section style={{ marginBottom: spacing[24] }}>
            <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
              Coach prep notes
            </h2>
            <textarea
              value={prepNotes ?? ''}
              onChange={(e) => onPrepNotesChange?.(e.target.value)}
              placeholder="Private notes for this conversation…"
              className="w-full rounded-xl px-3 py-3 text-[14px] resize-none focus:outline-none focus:ring-1"
              style={{
                background: colors.card,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                minHeight: 100,
              }}
              rows={4}
            />
          </section>

          {/* 3) Client Summary (shareable) */}
          <section>
            <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
              Client summary
            </h2>
            <p className="text-[12px] mb-3" style={{ color: colors.muted }}>
              A client-friendly snapshot you can show or send into chat.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleShowClientSummary}>
                Show client summary
              </Button>
              <Button variant="primary" size="sm" onClick={handleSendToClient}>
                Send to client
              </Button>
            </div>
            {showSummaryPreview && (
              <div
                className="mt-4 p-4 rounded-xl border whitespace-pre-wrap text-[13px]"
                style={{ background: colors.card, borderColor: colors.border, color: colors.text }}
              >
                {summaryText}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
