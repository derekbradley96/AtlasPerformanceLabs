import React from 'react';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { colors, spacing, shell } from '@/ui/tokens';

export default function PersonalPerformancePage() {
  // Placeholder data – these can be wired to real performanceGraph + habits data later.
  const loading = false;

  const timelineEvents = [
    { id: 'e1', date: '2025-06-10T08:00:00Z', type: 'checkin_submitted', label: 'Check-in submitted', detail: 'Shared progress and photos.' },
    { id: 'e2', date: '2025-06-05T08:00:00Z', type: 'program_started', label: 'New program started', detail: 'Started “Strength Block A”.' },
    { id: 'e3', date: '2025-05-30T08:00:00Z', type: 'habit_logged', label: 'Habit streak hit', detail: 'Completed hydration habit 7 days in a row.' },
  ];

  const trends = [
    { label: 'Weight trend', value: 'Gently downwards over last 4 weeks', tone: 'positive' },
    { label: 'Check-in consistency', value: '3 / 4 weeks submitted on time', tone: 'neutral' },
    { label: 'Training volume', value: 'Stable over last 3 weeks', tone: 'neutral' },
  ];

  const habitStreaks = [
    { name: 'Daily steps', streak: 9, goal: '8k+ steps' },
    { name: 'Hydration', streak: 7, goal: '2L+ water' },
    { name: 'Bedtime routine', streak: 3, goal: 'Sleep before 11pm' },
  ];

  const milestones = [
    { label: 'First 4 weeks completed', date: '2025-05-28', description: 'Completed the first phase of your program.' },
    { label: 'Weight milestone', date: '2025-06-03', description: 'Hit your first 2kg loss target.' },
  ];

  const formatShortDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bgPrimary,
        padding: spacing[16],
        paddingTop: `calc(${spacing[20]} + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="max-w-xl mx-auto space-y-4">
        <header>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: colors.text }}>
            Performance overview
          </h1>
          <p className="text-sm" style={{ color: colors.muted }}>
            A simple timeline of your recent activity, trends, habit streaks, and key milestones.
          </p>
        </header>

        {/* Timeline */}
        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: colors.muted }}>
            Timeline
          </p>
          {loading && (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}
          {!loading && timelineEvents.length === 0 && (
            <EmptyState
              title="No events yet"
              description="As you log check-ins, habits, and progress, your personal timeline will appear here."
            />
          )}
          {!loading && timelineEvents.length > 0 && (
            <div className="flex flex-col gap-2">
              {timelineEvents.map((evt) => (
                <div key={evt.id} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {evt.label}
                    </p>
                    {evt.detail && (
                      <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                        {evt.detail}
                      </p>
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap" style={{ color: colors.muted }}>
                    {formatShortDate(evt.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Trend analysis */}
        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: colors.muted }}>
            Trend analysis
          </p>
          <div className="space-y-2">
            {trends.map((t) => (
              <div key={t.label} className="flex flex-col">
                <span className="text-xs font-medium mb-0.5" style={{ color: colors.muted }}>
                  {t.label}
                </span>
                <span className="text-sm" style={{ color: colors.text }}>
                  {t.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Habit streaks */}
        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: colors.muted }}>
            Habit streaks
          </p>
          {habitStreaks.length === 0 ? (
            <p className="text-xs" style={{ color: colors.muted }}>
              As you complete habits consistently, your streaks will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {habitStreaks.map((h) => (
                <div key={h.name} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {h.name}
                    </p>
                    <p className="text-xs" style={{ color: colors.muted }}>
                      Goal: {h.goal}
                    </p>
                  </div>
                  <span className="text-xs font-medium" style={{ color: colors.primary }}>
                    {h.streak} days
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Program milestones */}
        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: colors.muted }}>
            Program milestones
          </p>
          {milestones.length === 0 ? (
            <p className="text-xs" style={{ color: colors.muted }}>
              Milestones like completed phases and key achievements will show up here as you progress.
            </p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.label} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {m.label}
                    </p>
                    {m.description && (
                      <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                        {m.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap" style={{ color: colors.muted }}>
                    {formatShortDate(m.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

