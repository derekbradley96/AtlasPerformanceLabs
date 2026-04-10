/**
 * Coach check-in review — decision workspace (desktop 3-column vs app shell).
 * Data + handlers owned by parent (CheckInReviewPage).
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Columns2,
} from 'lucide-react';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { colors, spacing, shell, shadows } from '@/ui/tokens';
import { formatWeightForViewer, normalizeWeightUnit, formatWeightDeltaKg } from '@/lib/bodyMeasurementUnits';
import {
  RESPONSE_TEMPLATES,
  ADJUSTMENT_SNIPPETS,
  getQuickActionIds,
} from '@/lib/checkinReviewWorkspaceModel';
import { deriveCheckInReviewWorkspaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';

function MiniBars({ values, color, height = 44 }) {
  const v = Array.isArray(values) ? values.map(Number).filter((n) => Number.isFinite(n)) : [];
  if (!v.length) {
    return (
      <div style={{ height, fontSize: 11, color: colors.muted, display: 'flex', alignItems: 'center' }}>No points</div>
    );
  }
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {v.map((n, i) => {
        const h = Math.max(4, ((n - min) / span) * (height - 8) + 4);
        return (
          <div
            key={i}
            style={{
              width: 7,
              height: h,
              borderRadius: 3,
              background: color,
              opacity: 0.35 + (i / Math.max(v.length - 1, 1)) * 0.55,
            }}
          />
        );
      })}
    </div>
  );
}

function toneColor(tone) {
  if (tone === 'up' || tone === 'positive') return colors.success;
  if (tone === 'down' || tone === 'warn') return colors.warning;
  if (tone === 'danger') return colors.danger;
  return colors.muted;
}

function WhatChangedStrip({ items }) {
  if (!items?.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: spacing[8],
        padding: spacing[12],
        borderRadius: shell.cardRadius,
        border: `1px solid ${colors.border}`,
        background: colors.surface2,
        marginBottom: spacing[16],
      }}
    >
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            minWidth: 100,
            padding: `${spacing[6]}px ${spacing[10]}px`,
            borderRadius: 12,
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: colors.muted, textTransform: 'uppercase' }}>
            {it.label}
          </p>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: toneColor(it.tone) }}>{it.text}</p>
        </div>
      ))}
    </div>
  );
}

function sectionTitle(text) {
  return (
    <p
      style={{
        margin: `0 0 ${spacing[8]}px`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: colors.muted,
      }}
    >
      {text}
    </p>
  );
}

const METRIC_LABELS = {
  weight: 'Weight',
  steps_avg: 'Steps (avg)',
  sleep_score: 'Sleep',
  energy_level: 'Energy',
  training_completion: 'Training completion %',
  nutrition_adherence: 'Nutrition adherence %',
  cardio_completion: 'Cardio %',
  posing_minutes: 'Posing (min)',
  pump_quality: 'Pump quality',
  digestion_score: 'Digestion',
};

function formatMetricValue(key, v, viewerWU) {
  if (v == null || v === '') return '—';
  if (key === 'weight') {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return formatWeightForViewer(n, normalizeWeightUnit(viewerWU));
  }
  return String(v);
}

function metricCellsForKeys(checkin, keys, viewerWU) {
  const out = [];
  for (const key of keys) {
    const raw = checkin?.[key];
    if (raw == null || raw === '') continue;
    out.push(
      <div key={key} style={{ padding: spacing[10], borderRadius: 12, background: colors.surface2, border: `1px solid ${colors.border}` }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>{METRIC_LABELS[key] || key}</p>
        <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>{formatMetricValue(key, raw, viewerWU)}</p>
      </div>
    );
  }
  return out;
}

function MetricSubGroup({ title, children }) {
  if (!children?.length) return null;
  return (
    <div style={{ marginBottom: spacing[12] }}>
      {sectionTitle(title)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: spacing[10] }}>{children}</div>
    </div>
  );
}

/** Grouped metrics + optional prep targets in one card (avoids spreadsheet sprawl). */
function MetricsGroupedCard({ checkin, emphasis, viewerWU, prepPrecision }) {
  const tf = {
    body: ['weight'],
    training: ['training_completion', 'nutrition_adherence', 'cardio_completion'],
    readiness: ['sleep_score', 'energy_level', 'digestion_score', 'steps_avg'],
  };
  const comp = {
    body: ['weight'],
    training: ['cardio_completion', 'nutrition_adherence', 'training_completion', 'posing_minutes', 'pump_quality'],
    readiness: ['digestion_score', 'sleep_score', 'energy_level', 'steps_avg'],
  };
  const groups = emphasis === 'competition_prep' ? comp : tf;
  const bodyCells = metricCellsForKeys(checkin, groups.body, viewerWU);
  const trainCells = metricCellsForKeys(checkin, groups.training, viewerWU);
  const readyCells = metricCellsForKeys(checkin, groups.readiness, viewerWU);
  const showPrep = emphasis === 'competition_prep' && prepPrecision;

  if (!bodyCells.length && !trainCells.length && !readyCells.length && !showPrep) {
    return (
      <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}` }}>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No structured metrics on this check-in.</p>
      </Card>
    );
  }

  return (
    <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}`, marginBottom: spacing[16] }}>
      {sectionTitle('Metrics')}
      <MetricSubGroup title="Body">{bodyCells}</MetricSubGroup>
      <MetricSubGroup title="Training & fuel">{trainCells}</MetricSubGroup>
      <MetricSubGroup title="Readiness & lifestyle">{readyCells}</MetricSubGroup>
      {showPrep ? (
        <div style={{ marginTop: spacing[4] }}>
          {sectionTitle('Prep targets')}
          <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 4px' }}>
              <strong style={{ color: colors.text }}>Water target: </strong>
              {prepPrecision.water_target_ml != null ? `${prepPrecision.water_target_ml} ml` : '—'}
            </p>
            <p style={{ margin: '0 0 4px' }}>
              <strong style={{ color: colors.text }}>Sodium target: </strong>
              {prepPrecision.sodium_target_mg != null ? `${prepPrecision.sodium_target_mg} mg` : '—'}
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: colors.text }}>Day type: </strong>
              {prepPrecision.day_type || '—'}
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function AnswerSection({ title, body }) {
  if (!body || !String(body).trim()) return null;
  return (
    <div style={{ marginBottom: spacing[12] }}>
      {sectionTitle(title)}
      <Card style={{ padding: spacing[12], border: `1px solid ${colors.border}`, fontSize: 14, color: colors.textSecondary, lineHeight: 1.55 }}>{String(body).trim()}</Card>
    </div>
  );
}

function PhotoGallery({ photoUrls, prevPhotoUrls, prioritize }) {
  const [compare, setCompare] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  if (!photoUrls?.length && !prevPhotoUrls?.length) {
    return (
      <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}`, marginBottom: spacing[16] }}>
        {sectionTitle('Photos')}
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No photos attached.</p>
      </Card>
    );
  }
  return (
    <Card
      style={{
        padding: spacing[14],
        border: `1px solid ${prioritize ? colors.primary + '55' : colors.border}`,
        marginBottom: spacing[16],
        boxShadow: prioritize ? shadows.glow : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing[8] }}>
        {sectionTitle('Photos')}
        {prevPhotoUrls?.length ? (
          <Button type="button" size="sm" variant={compare ? 'primary' : 'outline'} onClick={() => setCompare((c) => !c)}>
            <Columns2 size={14} style={{ marginRight: 6 }} />
            {compare ? 'Single view' : 'Compare last'}
          </Button>
        ) : null}
      </div>
      {compare && prevPhotoUrls?.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[10] }}>
          <div>
            <p style={{ fontSize: 11, color: colors.muted, margin: `0 0 ${spacing[6]}px` }}>This check-in</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
              {photoUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(url)}
                  style={{ padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', width: 120, height: 120 }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, color: colors.muted, margin: `0 0 ${spacing[6]}px` }}>Previous</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
              {prevPhotoUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(url)}
                  style={{ padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', width: 120, height: 120 }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
          {photoUrls.map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setLightbox(url)}
                style={{ padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', width: 112, height: 112 }}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              <button
                type="button"
                aria-label="Expand"
                onClick={() => setLightbox(url)}
                style={{
                  position: 'absolute',
                  bottom: 6,
                  right: 6,
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {lightbox ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing[16],
          }}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute',
              top: spacing[16],
              right: spacing[16],
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 8,
              background: colors.surface2,
              color: colors.text,
              cursor: 'pointer',
            }}
          >
            <X size={22} />
          </button>
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      ) : null}
    </Card>
  );
}

function TrendsRow({ series, prepWaterSeries, prepSodiumSeries, showHydration }) {
  const cards = [
    { key: 'w', label: 'Weight', values: series.weight, color: colors.primary },
    { key: 'c', label: 'Adherence', values: series.compliance, color: colors.accent },
    { key: 'r', label: 'Readiness', values: series.readiness, color: colors.success },
  ];
  const hasWater = Array.isArray(prepWaterSeries) && prepWaterSeries.length > 0;
  const hasNa = Array.isArray(prepSodiumSeries) && prepSodiumSeries.length > 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: spacing[10], marginBottom: spacing[16] }}>
      {cards.map((c) => (
        <Card key={c.key} style={{ padding: spacing[10], border: `1px solid ${colors.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: colors.muted }}>{c.label}</p>
          <MiniBars values={c.values} color={c.color} />
        </Card>
      ))}
      {showHydration && hasWater ? (
        <Card style={{ padding: spacing[10], border: `1px solid ${colors.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: colors.muted }}>Water (logged)</p>
          <MiniBars values={prepWaterSeries} color={colors.accent} />
        </Card>
      ) : null}
      {showHydration && hasNa ? (
        <Card style={{ padding: spacing[10], border: `1px solid ${colors.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: colors.muted }}>Sodium (logged)</p>
          <MiniBars values={prepSodiumSeries} color={colors.warning} />
        </Card>
      ) : null}
      {showHydration && !hasWater && !hasNa ? (
        <Card style={{ padding: spacing[10], border: `1px solid ${colors.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: colors.muted }}>Water / sodium</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary }}>No daily prep logs in this window — open prep precision to log.</p>
        </Card>
      ) : null}
    </div>
  );
}

function ActionRailContent({
  emphasis,
  reviewContext,
  selectedAdjustment,
  onSelectAdjustment,
  adjustmentComposer,
  onAdjustmentComposerChange,
  onAppendAdjustmentSnippet,
  responseText,
  onResponseChange,
  onApplyTemplate,
  onSaveDraft,
  quickHandlers,
  onMarkFollowUp,
  onMarkUrgent,
  sessionFlag,
  onMarkReviewed,
  onApproveAndMessage,
  onRequestUpdate,
  marking,
  replyBusy = false,
  isReviewed,
  stickyWrapStyle,
}) {
  const ids = getQuickActionIds({
    showPrepHygiene: reviewContext?.showPrepHygiene ?? emphasis === 'competition_prep',
  });
  const adjustmentOptions = [
    ['keep_same', 'Keep plan'],
    ['increase_calories', 'Calories +'],
    ['decrease_calories', 'Calories −'],
    ['increase_cardio', 'Cardio +'],
    ['reduce_volume', 'Less volume'],
  ];
  return (
    <div style={stickyWrapStyle}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: spacing[12] }}>
        {sectionTitle('Quick actions')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8], marginBottom: spacing[16] }}>
          <Button variant="outline" size="sm" className="justify-start" onClick={quickHandlers.onKeepPlan}>
            Keep plan
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={quickHandlers.onAdjustMacros}>
            Adjust macros
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={quickHandlers.onAdjustTraining}>
            Adjust training
          </Button>
          {ids.includes('adjust_cardio') ? (
            <Button variant="outline" size="sm" className="justify-start" onClick={quickHandlers.onAdjustCardio}>
              Adjust cardio
            </Button>
          ) : null}
          {ids.includes('adjust_water') ? (
            <Button variant="outline" size="sm" className="justify-start" onClick={quickHandlers.onAdjustWater}>
              Adjust water
            </Button>
          ) : null}
          {ids.includes('adjust_sodium') ? (
            <Button variant="outline" size="sm" className="justify-start" onClick={quickHandlers.onAdjustSodium}>
              Adjust sodium
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="justify-start" onClick={onMarkFollowUp}>
            Mark for follow-up
          </Button>
          <Button variant="ghost" size="sm" className="justify-start text-amber-400" onClick={onMarkUrgent}>
            {sessionFlag === 'urgent' ? 'Urgent flagged' : 'Flag urgent'}
          </Button>
        </div>

        {sectionTitle('Adjustment intent')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[6], marginBottom: spacing[10] }}>
          {adjustmentOptions.map(([key, label]) => (
            <Button key={key} size="sm" variant={selectedAdjustment === key ? 'primary' : 'outline'} onClick={() => onSelectAdjustment(key)}>
              {label}
            </Button>
          ))}
        </div>
        {sectionTitle('Adjustment notes')}
        <Textarea
          value={adjustmentComposer}
          onChange={(e) => onAdjustmentComposerChange(e.target.value)}
          rows={4}
          placeholder="e.g. Calories −100 · cardio unchanged · pull 1 set off leg day"
          className="mb-2"
          style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[6], marginBottom: spacing[16] }}>
          {ADJUSTMENT_SNIPPETS.map((s) => (
            <Button key={s} type="button" size="sm" variant="secondary" onClick={() => onAppendAdjustmentSnippet(s)}>
              + {s}
            </Button>
          ))}
        </div>

        {sectionTitle('Response')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[6], marginBottom: spacing[8] }}>
          {RESPONSE_TEMPLATES.map((t) => (
            <Button key={t.id} type="button" size="sm" variant="outline" className="justify-start text-left h-auto py-2 whitespace-normal" onClick={() => onApplyTemplate(t.body)}>
              {t.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={responseText}
          onChange={(e) => onResponseChange(e.target.value)}
          rows={6}
          placeholder="Coach reply…"
          style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
        />
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onSaveDraft}>
          Save draft
        </Button>
      </div>

      {!isReviewed ? (
        <div
          style={{
            flexShrink: 0,
            paddingTop: spacing[12],
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing[8],
            background: colors.bg,
          }}
        >
          <Button size="sm" variant="outline" onClick={onMarkReviewed} disabled={marking || replyBusy}>
            {marking ? 'Saving…' : 'Mark reviewed'}
          </Button>
          <Button size="sm" variant="primary" onClick={onApproveAndMessage} disabled={marking || replyBusy}>
            {replyBusy ? 'Sending…' : 'Send response'}
          </Button>
          <Button size="sm" variant="secondary" onClick={onRequestUpdate} disabled={replyBusy}>
            Request update
          </Button>
        </div>
      ) : (
        <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 12, color: colors.muted }}>Review complete — you can still message the client from the client profile.</p>
      )}
    </div>
  );
}

export default function CheckInReviewDecisionWorkspace({
  shell,
  checkin,
  clientRow,
  dashboardData,
  reviewContext,
  whatChanged,
  smartSignals,
  trackStatus,
  urgencyBadge,
  reviewStateLabel,
  phaseWeekText,
  submissionAt,
  photoUrls,
  prevPhotoUrls,
  miniSeries,
  prepWaterSeries = [],
  prepSodiumSeries = [],
  prepPrecision,
  viewerWU,
  weightDeltaKg,
  adherencePct,
  sessionsCompleted,
  cardioOrSteps,
  nav,
  selectedAdjustment,
  onSelectAdjustment,
  adjustmentComposer,
  onAdjustmentComposerChange,
  onAppendAdjustmentSnippet,
  responseText,
  onResponseChange,
  onApplyTemplate,
  onSaveDraft,
  quickHandlers,
  sessionFlag,
  onSetSessionFlag,
  onMarkReviewed,
  onApproveAndMessage,
  onRequestUpdate,
  marking,
  replyBusy = false,
  isReviewed,
}) {
  const [appActionsOpen, setAppActionsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const emphasis = reviewContext?.emphasis === 'competition_prep' ? 'competition_prep' : 'transformation';
  const checkInReviewMigration = useMemo(
    () => deriveCheckInReviewWorkspaceState({ shell, emphasis: reviewContext?.emphasis }),
    [shell, reviewContext?.emphasis]
  );
  const clientName = clientRow?.full_name || clientRow?.name || checkin?.client_name || checkin?.client_full_name || 'Client';
  const typeLabel =
    emphasis === 'competition_prep' ? 'Competition / prep' : 'Transformation';

  const onMarkFollowUp = useCallback(() => {
    onSetSessionFlag(sessionFlag === 'follow_up' ? 'none' : 'follow_up');
  }, [onSetSessionFlag, sessionFlag]);

  const onMarkUrgent = useCallback(() => {
    onSetSessionFlag(sessionFlag === 'urgent' ? 'none' : 'urgent');
  }, [onSetSessionFlag, sessionFlag]);

  const leftRail = (
    <aside
      style={{
        borderRadius: shell.cardRadius,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
        padding: spacing[16],
        position: shell === 'desktop_web' ? 'sticky' : 'relative',
        top: shell === 'desktop_web' ? spacing[16] : undefined,
        alignSelf: 'start',
      }}
    >
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: colors.text }}>{clientName}</p>
      <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>{typeLabel}</p>
      <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>{phaseWeekText}</p>
      <div style={{ marginTop: spacing[12], display: 'flex', flexWrap: 'wrap', gap: spacing[6] }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 8,
            background: colors.primarySubtle,
            color: colors.accent,
          }}
        >
          {reviewStateLabel?.label ?? '—'}
        </span>
        {reviewContext?.isPeakWeekish ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 8,
              background: colors.primarySubtle,
              color: colors.primary,
            }}
          >
            Peak week priority
          </span>
        ) : null}
        {urgencyBadge ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 8,
              background: `${colors[urgencyBadge.colorKey] ?? colors.warning}22`,
              color: colors[urgencyBadge.colorKey] ?? colors.warning,
            }}
          >
            {urgencyBadge.label}
          </span>
        ) : null}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 8,
            background: `${colors[trackStatus.colorKey] ?? colors.success}22`,
            color: colors[trackStatus.colorKey] ?? colors.success,
          }}
        >
          {trackStatus.label}
        </span>
      </div>
      {sectionTitle('Snapshot')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8], fontSize: 13 }}>
        <div>
          <span style={{ color: colors.muted }}>Weight Δ </span>
          <strong style={{ color: colors.text }}>
            {weightDeltaKg != null ? formatWeightDeltaKg(weightDeltaKg, viewerWU) : '—'}
          </strong>
        </div>
        <div>
          <span style={{ color: colors.muted }}>Adherence </span>
          <strong style={{ color: colors.text }}>{adherencePct != null ? `${Math.round(Number(adherencePct))}%` : '—'}</strong>
        </div>
        <div>
          <span style={{ color: colors.muted }}>Readiness </span>
          <strong style={{ color: colors.text }}>
            {checkin?.sleep_score != null || checkin?.energy_level != null
              ? `Sleep ${checkin?.sleep_score ?? '—'} · Energy ${checkin?.energy_level ?? '—'}`
              : '—'}
          </strong>
        </div>
        <div>
          <span style={{ color: colors.muted }}>Training </span>
          <strong style={{ color: colors.text }}>{sessionsCompleted ?? checkin?.training_completion ?? '—'}</strong>
        </div>
        <div>
          <span style={{ color: colors.muted }}>Cardio / steps </span>
          <strong style={{ color: colors.text }}>{cardioOrSteps ?? '—'}</strong>
        </div>
        {emphasis === 'competition_prep' && prepPrecision ? (
          <div>
            <span style={{ color: colors.muted }}>Water / Na targets </span>
            <strong style={{ color: colors.text }}>
              {prepPrecision.water_target_ml ?? '—'} ml · {prepPrecision.sodium_target_mg ?? '—'} mg
            </strong>
          </div>
        ) : null}
      </div>
    </aside>
  );

  const mainColumn = (
    <main style={{ minWidth: 0 }}>
      <WhatChangedStrip items={whatChanged} />
      {smartSignals?.length ? (
        <div style={{ marginBottom: spacing[16] }}>
          {sectionTitle('Signals')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
            {smartSignals.map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 10,
                  background: colors.warningSubtle,
                  color: colors.warning,
                  border: `1px solid ${colors.warning}44`,
                }}
              >
                {s.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <PhotoGallery photoUrls={photoUrls} prevPhotoUrls={prevPhotoUrls} prioritize={reviewContext?.prioritizePhotos} />
      <MetricsGroupedCard checkin={checkin} emphasis={emphasis} viewerWU={viewerWU} prepPrecision={prepPrecision} />
      {sectionTitle('Check-in answers')}
      <AnswerSection title="Wins" body={checkin?.wins} />
      <AnswerSection title="Struggles" body={checkin?.struggles} />
      <AnswerSection title="Recovery / lifestyle" body={checkin?.condition_notes} />
      <AnswerSection
        title="Digestion / hunger"
        body={checkin?.digestion_score != null ? `Digestion score (1–10): ${checkin.digestion_score}` : null}
      />
      <AnswerSection title="Questions for coach" body={checkin?.questions} />
      {sectionTitle('Mini trends')}
      <TrendsRow
        series={miniSeries}
        prepWaterSeries={prepWaterSeries}
        prepSodiumSeries={prepSodiumSeries}
        showHydration={emphasis === 'competition_prep'}
      />
    </main>
  );

  const railStickyStyle =
    shell === 'desktop_web'
      ? {
          position: 'sticky',
          top: spacing[16],
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: shell.cardRadius,
          border: `1px solid ${colors.border}`,
          background: colors.surface1,
          padding: spacing[16],
        }
      : {};

  const actionRail = (
    <ActionRailContent
      emphasis={emphasis}
      reviewContext={reviewContext}
      selectedAdjustment={selectedAdjustment}
      onSelectAdjustment={onSelectAdjustment}
      adjustmentComposer={adjustmentComposer}
      onAdjustmentComposerChange={onAdjustmentComposerChange}
      onAppendAdjustmentSnippet={onAppendAdjustmentSnippet}
      responseText={responseText}
      onResponseChange={onResponseChange}
      onApplyTemplate={onApplyTemplate}
      onSaveDraft={onSaveDraft}
      quickHandlers={quickHandlers}
      onMarkFollowUp={onMarkFollowUp}
      onMarkUrgent={onMarkUrgent}
      sessionFlag={sessionFlag}
      onMarkReviewed={onMarkReviewed}
      onApproveAndMessage={onApproveAndMessage}
      onRequestUpdate={onRequestUpdate}
      marking={marking}
      replyBusy={replyBusy}
      isReviewed={isReviewed}
      stickyWrapStyle={shell === 'desktop_web' ? railStickyStyle : { display: 'flex', flexDirection: 'column', gap: 0 }}
    />
  );

  const topBar = (
    <header
      style={{
        borderBottom: `1px solid ${colors.border}`,
        padding: `${spacing[10]}px ${shell.pagePaddingH}px`,
        marginBottom: spacing[12],
        background: colors.bg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[10] }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: shell === 'desktop_web' ? 22 : 17, fontWeight: 800, color: colors.text }}>Check-in review</p>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
            {submissionAt ? new Date(submissionAt).toLocaleString() : '—'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[6] }}>
          <Button size="sm" variant="ghost" disabled={!nav?.prevId} onClick={() => nav?.onPrev?.()}>
            <ArrowLeft size={16} />
          </Button>
          <Button size="sm" variant="ghost" disabled={!nav?.nextId} onClick={() => nav?.onNext?.()}>
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
      {shell === 'desktop_web' ? (
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 11, color: colors.muted }}>
          Shortcuts: ← → previous/next check-in · 1 mark reviewed · 2 send response · 3 request update (when not typing)
        </p>
      ) : null}
    </header>
  );

  if (shell === 'desktop_web') {
    return (
      <div
        {...atlasMigrationDataAttributes(checkInReviewMigration.phase, checkInReviewMigration.primary)}
        style={{ minHeight: '100vh', background: colors.bg, color: colors.text, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingBottom: spacing[24] }}
      >
        {topBar}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr) minmax(300px, 380px)',
            gap: spacing[20],
            alignItems: 'start',
            maxWidth: 1440,
            margin: '0 auto',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.muted,
              gridColumn: 1,
            }}
          >
            Client
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.muted,
              gridColumn: 2,
            }}
          >
            Check-in
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.muted,
              gridColumn: 3,
            }}
          >
            Decide
          </p>
          <div style={{ gridColumn: 1 }}>{leftRail}</div>
          <div style={{ gridColumn: 2, minWidth: 0 }}>{mainColumn}</div>
          <aside style={{ gridColumn: 3, minWidth: 0 }}>{actionRail}</aside>
        </div>
      </div>
    );
  }

  /* —— App shell: stacked + drawer for actions —— */
  return (
    <div
      {...atlasMigrationDataAttributes(checkInReviewMigration.phase, checkInReviewMigration.primary)}
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        paddingLeft: shell.pagePaddingH,
        paddingRight: shell.pagePaddingH,
        paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {topBar}
      <button
        type="button"
        onClick={() => setSummaryOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing[12],
          marginBottom: spacing[10],
          borderRadius: shell.cardRadius,
          border: `1px solid ${colors.border}`,
          background: colors.surface1,
          color: colors.text,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Summary & client
        {summaryOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {summaryOpen ? <div style={{ marginBottom: spacing[12] }}>{leftRail}</div> : null}
      {mainColumn}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          padding: `${spacing[10]}px ${shell.pagePaddingH}px calc(${spacing[10]}px + env(safe-area-inset-bottom, 0px))`,
          background: colors.bg,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          gap: spacing[8],
        }}
      >
        <Button className="flex-1" variant="secondary" onClick={() => setAppActionsOpen(true)}>
          Actions & reply
        </Button>
        {!isReviewed ? (
          <Button className="flex-1" variant="primary" onClick={onApproveAndMessage} disabled={marking || replyBusy}>
            {replyBusy ? '…' : 'Send'}
          </Button>
        ) : null}
      </div>
      {appActionsOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: colors.overlay }} role="presentation" onClick={() => setAppActionsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: colors.surface1,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: `1px solid ${colors.border}`,
              padding: spacing[16],
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Decision workspace</p>
              <button type="button" aria-label="Close" onClick={() => setAppActionsOpen(false)} style={{ border: 'none', background: 'transparent', color: colors.text, cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>{actionRail}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
