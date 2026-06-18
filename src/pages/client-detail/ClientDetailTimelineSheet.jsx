import React from 'react';
import { History, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { safeDate } from '@/lib/format';
import { colors, spacing, radii } from '@/ui/tokens';
import { TIMELINE_FILTERS, timelineDateLabel, timelineIconForBadge } from '@/pages/client-detail/clientDetailUtils';

export default function ClientDetailTimelineSheet({
  open,
  onOpenChange,
  timelineFilter,
  setTimelineFilter,
  timelineLoading,
  timelineEvents,
  lightHaptic,
  navigate,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ background: colors.bg, borderColor: colors.border }}>
        <SheetHeader>
          <SheetTitle style={{ color: colors.text }}>Timeline</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto min-h-0 min-w-0 px-4 pb-6" style={{ paddingTop: spacing[12], paddingBottom: spacing[24] }}>
          <div className="flex flex-wrap gap-2" style={{ marginBottom: spacing[12] }}>
            {TIMELINE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => { lightHaptic(); setTimelineFilter(f.key); }}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  background: timelineFilter === f.key ? colors.primarySubtle : colors.surface1,
                  color: timelineFilter === f.key ? colors.text : colors.muted,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {timelineLoading && (Array.isArray(timelineEvents) ? timelineEvents : []).length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3" style={{ padding: spacing[12], background: colors.card, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: colors.border }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 14, width: '70%', marginBottom: 6, background: colors.border, borderRadius: 4 }} />
                    <div style={{ height: 12, width: '50%', background: colors.surface1, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (() => {
            const safeTimelineEvents = Array.isArray(timelineEvents) ? timelineEvents : [];
            const filtered = timelineFilter === 'all'
              ? safeTimelineEvents
              : safeTimelineEvents.filter((e) => e?.badge === timelineFilter);
            const now = new Date();
            const byDate = {};
            filtered.forEach((e) => {
              const label = timelineDateLabel(e.occurredAt, now);
              if (!byDate[label]) byDate[label] = [];
              byDate[label].push(e);
            });
            const dateOrder = ['Today', 'Yesterday'];
            const rest = Object.keys(byDate)
              .filter((k) => !dateOrder.includes(k) && (byDate[k]?.length ?? 0) > 0)
              .sort((a, b) => (safeDate(byDate[b]?.[0]?.occurredAt)?.getTime() ?? 0) - (safeDate(byDate[a]?.[0]?.occurredAt)?.getTime() ?? 0));
            const orderedLabels = [...dateOrder.filter((k) => (byDate[k]?.length ?? 0) > 0), ...rest];
            if (orderedLabels.length === 0) {
              return (
                <div className="rounded-[20px] border flex flex-col items-center justify-center text-center" style={{ background: colors.card, borderColor: colors.border, minHeight: 200, padding: spacing[24] }}>
                  <History size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
                  <p className="text-[15px] font-medium" style={{ color: colors.text, marginBottom: 4 }}>No history yet</p>
                  <p className="text-[13px]" style={{ color: colors.muted }}>Events appear as you coach.</p>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-6 min-w-0">
                {orderedLabels.map((label) => (
                  <div key={label}>
                    <p className="text-[13px] font-semibold mb-2" style={{ color: colors.muted }}>{label}</p>
                    <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
                      {Array.isArray(byDate[label]) ? byDate[label].map((e, i) => {
                        const Icon = timelineIconForBadge(e.badge);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={async () => {
                              await lightHaptic();
                              if (e.route) navigate(e.route);
                            }}
                            className="flex items-center gap-3 w-full text-left active:opacity-90 min-w-0"
                            style={{
                              minHeight: 56,
                              padding: spacing[12],
                              paddingLeft: spacing[16],
                              paddingRight: spacing[16],
                              borderBottom: i < (byDate[label]?.length ?? 0) - 1 ? `1px solid ${colors.border}` : 'none',
                              background: 'transparent',
                              border: 'none',
                              color: colors.text,
                            }}
                          >
                            <div
                              className="flex-shrink-0 flex items-center justify-center rounded-full"
                              style={{ width: 40, height: 40, background: colors.border, borderRadius: radii.sm }}
                            >
                              <Icon size={20} style={{ color: colors.muted }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{e.title}</p>
                              {e.subtitle && <p className="text-[12px] truncate mt-0.5" style={{ color: colors.muted }}>{e.subtitle}</p>}
                            </div>
                            {e.route && <ChevronRight size={18} style={{ color: colors.muted }} className="flex-shrink-0" />}
                          </button>
                        );
                      }) : null}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
