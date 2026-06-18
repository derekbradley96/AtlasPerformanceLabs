/**
 * Coach check-in review — Atlas macro adjustment suggestion (Law 7: interpreted, not raw).
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';

function fmtCal(n) {
  const v = Math.round(Number(n) || 0);
  return `${v.toLocaleString()} kcal`;
}

function fmtG(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Math.round(Number(n))}g`;
}

export default function AtlasMacroSuggestionCard({
  clientName = 'Client',
  analysis,
  currentPlan,
  onDismiss,
  onApplySuggested,
}) {
  if (!analysis) return null;

  const showMain = analysis.shouldAdjust && analysis.suggestedCalories != null;
  const showAdherenceOnly = !analysis.shouldAdjust && analysis.adherenceNote;

  if (!showMain && !showAdherenceOnly) return null;

  if (showAdherenceOnly) {
    return (
      <Card
        style={{
          marginBottom: spacing[16],
          padding: spacing[14],
          border: `1px solid ${colors.warning}55`,
          background: colors.warningSubtle,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.warning }}>⚠️ Adherence note</p>
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
          {clientName} — {analysis.adherenceNote}
        </p>
        <div style={{ marginTop: spacing[10], display: 'flex', gap: spacing[8] }}>
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            Dismiss for 7 days
          </Button>
        </div>
      </Card>
    );
  }

  const pCur = currentPlan?.protein;
  const cCur = currentPlan?.carbs;
  const fCur = currentPlan?.fats;
  const pNew = analysis.suggestedProtein;
  const cNew = analysis.suggestedCarbs;
  const fNew = analysis.suggestedFats;

  const proteinLine =
    pNew != null && pCur != null && Math.round(pNew) === Math.round(Number(pCur))
      ? `Protein ${fmtG(pCur)} (unchanged)`
      : `Protein ${fmtG(pCur)} → ${fmtG(pNew)}`;
  const carbsLine =
    cNew != null && cCur != null ? `Carbs ${fmtG(cCur)} → ${fmtG(cNew)}` : `Carbs ${fmtG(cCur)} → ${fmtG(cNew)}`;
  const fatsLine =
    fNew != null && fCur != null && Math.round(fNew) === Math.round(Number(fCur))
      ? `Fats ${fmtG(fCur)} (unchanged)`
      : `Fats ${fmtG(fCur)} → ${fmtG(fNew)}`;

  return (
    <Card
      style={{
        marginBottom: spacing[16],
        padding: spacing[16],
        border: `1px solid ${shell.cardBorder}`,
        background: colors.surface2,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.text }}>📊 Atlas Macro Suggestion</p>
      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.55 }}>{analysis.reasoning}</p>
      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, fontWeight: 600, color: colors.text }}>
        Current: {fmtCal(currentPlan?.calories)} | Suggested: {fmtCal(analysis.suggestedCalories)}
      </p>
      <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
        Showing: {proteinLine} · {carbsLine} · {fatsLine}
      </p>
      {analysis.urgency === 'high' ? (
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, fontWeight: 600, color: colors.warning }}>Priority: high — review this week.</p>
      ) : null}
      <div style={{ marginTop: spacing[14], display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
        <Button type="button" size="sm" variant="default" style={{ background: colors.primary, color: '#fff' }} onClick={onApplySuggested}>
          Apply this adjustment
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          Dismiss for 7 days
        </Button>
      </div>
      <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
        Opens Nutrition Builder with suggested numbers — you still review and save so the change is intentional.
      </p>
    </Card>
  );
}
