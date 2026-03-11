import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getDailyBriefing } from '@/lib/briefing/briefingService';
import { impactLight } from '@/lib/haptics';
import { colors, spacing } from '@/ui/tokens';
import { SkeletonCard, SkeletonRow } from '@/ui/Skeleton';

export default function Briefing() {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { registerRefresh } = outletContext;
  const { user, isDemoMode, hasCompetitionPrep } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';

  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadBriefing = useCallback(async () => {
    const b = await getDailyBriefing(trainerId, new Date());
    setBriefing(b);
  }, [trainerId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDailyBriefing(trainerId, new Date())
      .then((b) => { if (!cancelled) setBriefing(b); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainerId]);

  useEffect(() => {
    if (typeof registerRefresh === 'function') {
      return registerRefresh(async () => {
        await loadBriefing();
      });
    }
  }, [registerRefresh, loadBriefing]);

  const handleStartReview = useCallback(async () => {
    await impactLight();
    navigate('/global-review?tab=active&filter=all');
  }, [navigate]);

  const handleGo = useCallback(async (route) => {
    await impactLight();
    navigate(route);
  }, [navigate]);

  if (loading && !briefing) {
    return (
      <div className="app-screen min-w-0 max-w-full" style={{ paddingBottom: spacing[24] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
          <SkeletonCard />
          <div style={{ background: colors.card, borderRadius: 20, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="app-screen p-4" style={{ color: colors.muted }}>
        <p>Unable to load briefing.</p>
      </div>
    );
  }

  const { counts, topPriorities, changes } = briefing;
  const hasChanges = changes.healthDrops.length > 0 || changes.newRetentionFlags.length > 0 || changes.newlyOverdue.length > 0;

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingBottom: spacing[24] + 'px' }}
    >
      <div className="app-section" style={{ gap: spacing[20] }}>
        {/* 1) Today's summary */}
        <section>
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: colors.text }}>Today&apos;s summary</h2>
          <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
            <div style={{ padding: spacing[14], paddingLeft: spacing[16], paddingRight: spacing[16] }}>
              <div className="grid gap-y-2">
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: colors.muted }}>Peak week due today</span>
                  <span className="font-medium tabular-nums" style={{ color: colors.text }}>{counts.peakWeekDueToday}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: colors.muted }}>Overdue payments</span>
                  <span className="font-medium tabular-nums" style={{ color: counts.overduePayments > 0 ? colors.attention : colors.text }}>{counts.overduePayments}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: colors.muted }}>{hasCompetitionPrep ? 'Reviews (Check-ins, Posing)' : 'Reviews (Check-ins)'}</span>
                  <span className="font-medium tabular-nums" style={{ color: colors.text }}>{hasCompetitionPrep ? `${counts.reviews.checkins}, ${counts.reviews.posing}` : String(counts.reviews.checkins)}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: colors.muted }}>Retention high</span>
                  <span className="font-medium tabular-nums" style={{ color: colors.text }}>{counts.retentionHigh}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: colors.muted }}>Unread threads</span>
                  <span className="font-medium tabular-nums" style={{ color: colors.text }}>{counts.unreadThreads}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: colors.muted }}>New leads</span>
                  <span className="font-medium tabular-nums" style={{ color: colors.text }}>{counts.newLeads}</span>
                </div>
                {typeof counts.highFatigueCount === 'number' && counts.highFatigueCount > 0 && (
                  <div className="flex justify-between text-[14px]">
                    <span style={{ color: colors.muted }}>High fatigue</span>
                    <span className="font-medium tabular-nums" style={{ color: colors.text }}>{counts.highFatigueCount}</span>
                  </div>
                )}
              </div>
            </div>
            {typeof counts.highFatigueCount === 'number' && counts.highFatigueCount >= 3 && (
              <p className="text-[13px] mt-2 pt-2" style={{ borderTop: `1px solid ${colors.border}`, color: colors.muted }}>
                {counts.highFatigueCount} clients showing high fatigue patterns
              </p>
            )}
          </div>
        </section>

        {/* 2) Top priorities (max 5) */}
        <section>
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: colors.text }}>Top priorities</h2>
          <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
            {topPriorities.length === 0 ? (
              <div style={{ padding: spacing[16] }}>
                <p className="text-[14px]" style={{ color: colors.muted }}>No priorities right now.</p>
              </div>
            ) : (
              topPriorities.map((p, idx) => (
                <button
                  key={`${p.clientId}-${p.type}-${idx}`}
                  type="button"
                  onClick={() => handleGo(p.route)}
                  className="flex items-center justify-between gap-3 w-full text-left active:opacity-90 min-w-0"
                  style={{
                    minHeight: 56,
                    padding: spacing[12],
                    paddingLeft: spacing[16],
                    paddingRight: spacing[16],
                    borderBottom: idx < topPriorities.length - 1 ? `1px solid ${colors.border}` : 'none',
                    background: 'transparent',
                    border: 'none',
                    color: colors.text,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{p.clientName}</p>
                    <p className="text-[12px] truncate" style={{ color: colors.muted }}>{p.why}</p>
                  </div>
                  <span className="flex-shrink-0 text-[13px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: colors.accent + '20', color: colors.accent }}>
                    Go
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* 3) Changes since yesterday */}
        <section>
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: colors.text }}>Changes since yesterday</h2>
          {!hasChanges ? (
            <div className="rounded-[20px] border p-4 min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
              <p className="text-[14px]" style={{ color: colors.muted }}>No new changes to report.</p>
            </div>
          ) : (
            <div className="rounded-[20px] overflow-hidden border min-w-0" style={{ background: colors.card, borderColor: colors.border }}>
              {changes.healthDrops.length > 0 && (
                <div style={{ padding: spacing[12], paddingLeft: spacing[16], paddingRight: spacing[16], borderBottom: `1px solid ${colors.border}` }}>
                  <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>Health drops (≥15)</p>
                  <ul className="list-none p-0 m-0">
                    {changes.healthDrops.map((d) => (
                      <li key={d.clientId} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[14px]" style={{ color: colors.text }}>{d.clientName}</span>
                        <button type="button" onClick={() => handleGo(d.route)} className="text-[13px] font-medium" style={{ color: colors.accent }}>
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {changes.newRetentionFlags.length > 0 && (
                <div style={{ padding: spacing[12], paddingLeft: spacing[16], paddingRight: spacing[16], borderBottom: hasChanges ? `1px solid ${colors.border}` : 'none' }}>
                  <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>New retention flags</p>
                  <ul className="list-none p-0 m-0">
                    {changes.newRetentionFlags.map((f) => (
                      <li key={f.clientId} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[14px] truncate flex-1 min-w-0" style={{ color: colors.text }}>{f.clientName}: {f.reason}</span>
                        <button type="button" onClick={() => handleGo(f.route)} className="text-[13px] font-medium flex-shrink-0" style={{ color: colors.accent }}>
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {changes.newlyOverdue.length > 0 && (
                <div style={{ padding: spacing[12], paddingLeft: spacing[16], paddingRight: spacing[16] }}>
                  <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>Newly overdue payments</p>
                  <ul className="list-none p-0 m-0">
                    {changes.newlyOverdue.map((o) => (
                      <li key={o.clientId} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[14px]" style={{ color: colors.text }}>{o.clientName}</span>
                        <button type="button" onClick={() => handleGo(o.route)} className="text-[13px] font-medium" style={{ color: colors.accent }}>
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4) Start review */}
        <section>
          <button
            type="button"
            onClick={handleStartReview}
            className="w-full rounded-xl py-3 text-[15px] font-semibold"
            style={{ background: colors.accent, color: '#fff' }}
          >
            Start review
          </button>
        </section>
      </div>
    </div>
  );
}
