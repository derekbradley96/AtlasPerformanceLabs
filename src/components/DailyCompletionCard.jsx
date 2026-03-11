import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { DAILY_TASK_KEYS, DAILY_TASKS } from '@/lib/dailyTasks';

/**
 * DailyCompletionCard
 *
 * Simple visual summary of today's core tasks:
 * - completed tasks count
 * - remaining tasks count
 * Optionally lists tasks and lets the user tap through to the relevant screen.
 *
 * Props:
 * - completedKeys?: string[]  // e.g. ['workout', 'supplements']
 */
export default function DailyCompletionCard({ completedKeys = [] }) {
  const navigate = useNavigate();

  const completedSet = new Set(completedKeys);
  const allTasks = DAILY_TASK_KEYS.map((key) => DAILY_TASKS[key]).filter(Boolean);
  const completed = allTasks.filter((t) => completedSet.has(t.key));
  const remaining = allTasks.filter((t) => !completedSet.has(t.key));

  const total = allTasks.length;
  const done = completed.length;
  const remainingCount = remaining.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card
      style={{
        padding: spacing[16],
        borderRadius: shell.cardRadius,
        border: `1px solid ${shell.cardBorder}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
            Today&apos;s tasks
          </p>
          <p className="text-sm mt-1" style={{ color: colors.text, margin: 0 }}>
            {done} of {total} completed
          </p>
        </div>
        <div
          className="text-right"
          style={{
            minWidth: 56,
          }}
        >
          <p
            className="text-lg font-semibold leading-none"
            style={{ color: colors.primary, margin: 0 }}
          >
            {pct}%
          </p>
          <p className="text-[11px]" style={{ color: colors.muted, margin: 0 }}>
            complete
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full overflow-hidden mb-3"
        style={{ background: colors.surface2 }}
        aria-hidden
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: colors.primary }}
        />
      </div>

      <div className="flex flex-col gap-2 text-xs">
        {completed.length > 0 && (
          <div>
            <p className="font-medium mb-1" style={{ color: colors.muted }}>
              Completed
            </p>
            <div className="flex flex-wrap gap-1.5">
              {completed.map((task) => (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => task.route && navigate(task.route)}
                  className="px-2 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    background: colors.primarySubtle,
                    color: colors.primary,
                    border: 'none',
                  }}
                >
                  {task.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {remainingCount > 0 && (
          <div>
            <p className="font-medium mb-1" style={{ color: colors.muted }}>
              Remaining
            </p>
            <div className="flex flex-wrap gap-1.5">
              {remaining.map((task) => (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => task.route && navigate(task.route)}
                  className="px-2 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    background: colors.surface2,
                    color: colors.text,
                    border: `1px solid ${shell.cardBorder}`,
                  }}
                >
                  {task.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

