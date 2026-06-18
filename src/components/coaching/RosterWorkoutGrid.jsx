import React, { useMemo, useState } from 'react';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function symbolFor(status) {
  if (status === 'completed') return { text: '✓', color: colors.success };
  if (status === 'warning') return { text: '⚠', color: colors.warning };
  if (status === 'missed') return { text: '✗', color: colors.danger };
  return { text: '—', color: colors.muted };
}

export default function RosterWorkoutGrid({
  rows = [],
  defaultExpanded = false,
  onOpenReview,
  onOpenNudge,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [summary, setSummary] = useState(null);
  const hasRows = Array.isArray(rows) && rows.length > 0;
  const legend = useMemo(
    () => [
      { k: '✓', t: 'Completed on target', c: colors.success },
      { k: '⚠', t: 'Completed with notes or gaps', c: colors.warning },
      { k: '✗', t: 'Missed scheduled session', c: colors.danger },
      { k: '—', t: 'Rest day', c: colors.muted },
    ],
    [],
  );

  return (
    <Card style={{ padding: spacing[12] }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          minHeight: touchTargetMin,
          border: 'none',
          background: 'transparent',
          color: colors.text,
          textAlign: 'left',
          fontSize: 15,
          fontWeight: 700,
          padding: 0,
        }}
      >
        This week's workouts {expanded ? '▾' : '▸'}
      </button>
      {expanded ? (
        <>
          <div style={{ marginTop: spacing[10], overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: colors.muted, fontSize: 12, padding: spacing[6] }}>Client</th>
                  {DAY_LABELS.map((d) => (
                    <th key={d} style={{ textAlign: 'center', color: colors.muted, fontSize: 12, padding: spacing[6] }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasRows ? rows.map((row) => (
                  <tr key={row.clientId}>
                    <td style={{ padding: spacing[6], color: colors.text, fontSize: 13, fontWeight: 600 }}>{row.clientName}</td>
                    {(row.cells || []).map((cell) => {
                      const token = symbolFor(cell.status);
                      return (
                        <td key={`${row.clientId}-${cell.day}`} style={{ textAlign: 'center', padding: spacing[6] }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (cell.status === 'completed') {
                                setSummary({
                                  title: row.clientName,
                                  text: `Completed session${cell.durationSeconds ? ` · ${Math.max(1, Math.round(cell.durationSeconds / 60))} min` : ''}`,
                                });
                                return;
                              }
                              if (cell.status === 'warning') {
                                onOpenReview?.(row.clientId, cell.sessionId);
                                return;
                              }
                              if (cell.status === 'missed') {
                                onOpenNudge?.(row.clientId);
                              }
                            }}
                            style={{
                              minWidth: 36,
                              minHeight: 36,
                              borderRadius: radii.sm,
                              border: `1px solid ${colors.border}`,
                              background: colors.surface2,
                              color: token.color,
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                            aria-label={`${row.clientName} ${DAY_LABELS[cell.day - 1]} ${cell.status}`}
                          >
                            {token.text}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} style={{ padding: spacing[8], color: colors.muted, fontSize: 12 }}>
                      No roster workout data yet for this week.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: spacing[10], display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
            {legend.map((l) => (
              <span key={l.k} style={{ fontSize: 11, color: l.c }}>{l.k} {l.t}</span>
            ))}
          </div>
          {summary ? (
            <div style={{ marginTop: spacing[10], borderRadius: radii.card, border: `1px solid ${colors.border}`, padding: spacing[10], background: colors.surface2 }}>
              <p style={{ margin: 0, fontSize: 12, color: colors.text, fontWeight: 700 }}>{summary.title}</p>
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>{summary.text}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
