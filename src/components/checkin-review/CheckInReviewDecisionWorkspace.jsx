/**
 * Coach check-in review — decision workspace (desktop 3-column vs app shell).
 * Data + handlers owned by parent (CheckInReviewPage).
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Columns2,
  AlertTriangle,
} from 'lucide-react';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { colors, spacing, shell, shadows } from '@/ui/tokens';
import { getSupabase } from '@/lib/supabaseClient';
import { formatWeightDeltaKg } from '@/lib/bodyMeasurementUnits';
import {
  RESPONSE_TEMPLATES,
  ADJUSTMENT_SNIPPETS,
  getQuickActionIds,
} from '@/lib/checkinReviewWorkspaceModel';
import { deriveCheckInReviewWorkspaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import AtlasVideoCall from '@/components/video/AtlasVideoCall';

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

function DataCard({ title, children }) {
  return (
    <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}`, marginBottom: spacing[12] }}>
      {sectionTitle(title)}
      {children}
    </Card>
  );
}

function scoreBandColor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return colors.muted;
  if (n <= 3) return colors.danger;
  if (n <= 6) return colors.warning;
  return colors.success;
}

function pctColor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return colors.muted;
  if (n < 50) return colors.danger;
  if (n < 80) return colors.warning;
  return colors.success;
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
                  style={{ padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', width: 180, height: 180 }}
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
                  style={{ padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', width: 180, height: 180 }}
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
                style={{ padding: 0, border: 'none', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', width: 180, height: 180 }}
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
  nav,
  stickyWrapStyle,
  macroSuggestionSlot,
  onOpenCallRequest,
  callRequest,
  onJoinCall,
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

        {macroSuggestionSlot}

        <div style={{ marginTop: 20, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.muted,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              marginBottom: 10,
            }}
          >
            Follow up
          </p>
          <button
            type="button"
            onClick={onOpenCallRequest}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${colors.primary}`,
              background: colors.primarySubtle,
              color: colors.primary,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            📞 Request a call
          </button>
          {callRequest ? (
            <div
              style={{
                marginTop: spacing[10],
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: spacing[10],
                background: colors.surface2,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: colors.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {callRequest.status === 'pending'
                  ? '⏳ Waiting for client to accept'
                  : '✓ Call accepted'}
              </p>
              {callRequest.status === 'accepted' && callRequest.call_type === 'video' ? (
                <button
                  type="button"
                  onClick={onJoinCall}
                  style={{
                    marginTop: spacing[8],
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: colors.primary,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  📹 Join video call
                </button>
              ) : null}
            </div>
          ) : null}
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
            {replyBusy ? 'Sending…' : nav?.nextId ? 'Send & review next' : 'Send response'}
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
  checkinId,
  clientId,
  clientUserId,
  coachId,
  coachName,
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
  macroSuggestionSlot = null,
}) {
  const [appActionsOpen, setAppActionsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [callRequestOpen, setCallRequestOpen] = useState(false);
  const [callType, setCallType] = useState('video');
  const [proposedAt, setProposedAt] = useState('');
  const [durationMins, setDurationMins] = useState(30);
  const [callAgenda, setCallAgenda] = useState('');
  const [callRequestError, setCallRequestError] = useState('');
  const [coachCallActive, setCoachCallActive] = useState(false);
  const queryClient = useQueryClient();
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

  const { data: callRequest = null } = useQuery({
    queryKey: ['call-request-for-checkin', checkin?.id ?? checkinId],
    queryFn: async () => {
      const supabase = getSupabase();
      const currentCheckinId = checkin?.id ?? checkinId;
      if (!supabase || !currentCheckinId) return null;
      let query = supabase
        .from('checkin_call_requests')
        .select('id, call_type, status, proposed_at, duration_minutes, created_at')
        .eq('checkin_id', currentCheckinId)
        .in('status', ['accepted', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!(checkin?.id ?? checkinId),
    staleTime: 30000,
    refetchInterval: 15000,
  });

  const sendCallRequestMutation = useMutation({
    mutationFn: async () => {
      setCallRequestError('');
      const supabase = getSupabase();
      if (!supabase) throw new Error('No connection');
      if (!coachId || !clientId || !checkinId) throw new Error('Missing request data');

      const { data: inserted, error } = await supabase
        .from('checkin_call_requests')
        .insert({
          checkin_id: checkinId,
          coach_id: coachId,
          client_id: clientId,
          call_type: callType,
          proposed_at:
            callType === 'message'
              ? new Date().toISOString()
              : new Date(proposedAt).toISOString(),
          duration_minutes: durationMins,
          agenda: callAgenda || null,
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: clientUserId,
        type: 'call_request',
        title:
          callType === 'video'
            ? `${coachName || 'Your coach'} wants a video call`
            : callType === 'phone'
              ? `${coachName || 'Your coach'} wants a phone call`
              : `${coachName || 'Your coach'} wants to chat over messages`,
        message:
          callType === 'message'
            ? `Re: your check-in - ${callAgenda || 'tap to respond'}`
            : `Proposed: ${new Date(proposedAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Tap to accept or reschedule.`,
        category: 'coaching',
        is_read: false,
        metadata: JSON.stringify({ call_request_id: inserted?.id || null }),
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success(callType === 'message' ? 'Message request sent' : `Call request sent to ${clientName}`);
      setCallRequestOpen(false);
      setProposedAt('');
      setCallAgenda('');
      setDurationMins(30);
      setCallType('video');
      setCallRequestError('');
      queryClient.invalidateQueries({ queryKey: ['call-request-for-checkin', checkin?.id ?? checkinId] });
    },
    onError: (error) => {
      const message = error?.message || 'Failed to send request';
      setCallRequestError(message);
      toast.error(message);
    },
  });

  const handleSendCallRequest = useCallback(
    () => sendCallRequestMutation.mutate(),
    [sendCallRequestMutation]
  );

  const handleStartCall = useCallback(async () => {
    if (!callRequest) return;
      if (callRequest.call_type === 'video') {
        setCoachCallActive(true);
        return;
      }

      toast.message('Open your messages to continue.');
  }, [callRequest]);

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
        {String(checkin?.athlete_prep_pace_ack || '').toLowerCase() === 'behind' ? (
          <span
            className="inline-flex items-center gap-1"
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 8,
              background: `${colors.warning}22`,
              color: colors.warning,
            }}
          >
            <AlertTriangle size={12} />
            Behind pace — consider macro adjustment
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

      <DataCard title="Body & progress">
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Weight</p>
        <p style={{ margin: `${spacing[4]}px 0 ${spacing[8]}px`, fontSize: 24, fontWeight: 800, color: colors.text }}>
          {checkin?.weight_kg ?? checkin?.weight ?? '—'} kg
        </p>
        {weightDeltaKg != null ? (
          <p style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 13, color: weightDeltaKg < 0 ? colors.success : colors.warning, fontWeight: 600 }}>
            {weightDeltaKg < 0 ? '↓' : '↑'} {Math.abs(Number(weightDeltaKg)).toFixed(1)}kg from last week
          </p>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: spacing[8] }}>
          {[
            ['waist_cm', 'Waist'],
            ['chest_cm', 'Chest'],
            ['hip_cm', 'Hip'],
            ['thigh_cm', 'Thigh'],
            ['arm_cm', 'Arm'],
          ].map(([key, label]) =>
            checkin?.[key] != null ? (
              <div key={key} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>{label}</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>{checkin[key]} cm</p>
              </div>
            ) : null
          )}
        </div>
      </DataCard>

      <DataCard title="Nutrition">
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Nutrition adherence</p>
        <p style={{ margin: `${spacing[4]}px 0 ${spacing[10]}px`, fontSize: 26, fontWeight: 800, color: pctColor(checkin?.nutrition_adherence) }}>
          {checkin?.nutrition_adherence ?? '—'}%
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: spacing[8] }}>
          {[
            ['water_litres', 'Water', 'L'],
            ['hunger_level', 'Hunger', '/10'],
            ['digestion_score', 'Digestion', '/10'],
            ['supplement_adherence', 'Supplements', '%'],
          ].map(([key, label, suffix]) =>
            checkin?.[key] != null ? (
              <div key={key} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>{label}</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: pctColor(checkin[key]) }}>
                  {checkin[key]}{suffix}
                </p>
              </div>
            ) : null
          )}
        </div>
      </DataCard>

      <DataCard title="Training">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: spacing[8], marginBottom: spacing[8] }}>
          {[
            ['training_completion', 'Training completion'],
            ['cardio_completion', 'Cardio completion'],
            ['steps_avg', 'Steps avg'],
          ].map(([key, label]) =>
            checkin?.[key] != null ? (
              <div key={key} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>{label}</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: key.includes('completion') ? pctColor(checkin[key]) : colors.text }}>
                  {key.includes('completion') ? `${checkin[key]}%` : checkin[key]}
                </p>
              </div>
            ) : null
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
          {[
            ['strength_feeling', 'Strength'],
            ['pump_quality', 'Pump'],
            ['recovery_score', 'Recovery'],
          ].map(([key, label]) => {
            if (checkin?.[key] == null) return null;
            const c = scoreBandColor(checkin[key]);
            return (
              <span key={key} style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${c}55`, background: `${c}22`, color: c, fontSize: 12, fontWeight: 700 }}>
                {label}: {checkin[key]}/10
              </span>
            );
          })}
        </div>
      </DataCard>

      <DataCard title="Wellbeing">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginBottom: spacing[8] }}>
          {[
            ['energy_level', 'Energy'],
            ['sleep_score', 'Sleep'],
            ['mood_level', 'Mood'],
            ['stress_level', 'Stress'],
            ['libido_level', 'Libido'],
          ].map(([key, label]) => {
            if (checkin?.[key] == null) return null;
            const c = scoreBandColor(checkin[key]);
            return (
              <span key={key} style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${c}55`, background: `${c}22`, color: c, fontSize: 12, fontWeight: 700 }}>
                {label}: {checkin[key]}/10
              </span>
            );
          })}
        </div>
        {[
          ['energy_level', 'energy'],
          ['sleep_score', 'sleep'],
          ['mood_level', 'mood'],
          ['stress_level', 'stress'],
          ['libido_level', 'libido'],
        ].map(([key, label]) =>
          Number(checkin?.[key]) <= 4 ? (
            <p key={key} style={{ margin: `${spacing[4]}px 0`, color: colors.warning, fontSize: 12 }}>
              ⚠️ Low {label} — may indicate recovery issues
            </p>
          ) : null
        )}
      </DataCard>

      {String(checkin?.focus_type || '').toLowerCase() === 'competition' ? (
        <DataCard title="Competition">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing[8], marginBottom: spacing[8] }}>
            {checkin?.posing_minutes != null ? <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}><p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Posing</p><p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: colors.text }}>{checkin.posing_minutes} min</p></div> : null}
            {checkin?.peak_week_water_litres != null ? <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}><p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Peak water</p><p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: colors.text }}>{checkin.peak_week_water_litres} L</p></div> : null}
            {checkin?.peak_week_sodium_mg != null ? <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}><p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Peak sodium</p><p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: colors.text }}>{checkin.peak_week_sodium_mg} mg</p></div> : null}
            {checkin?.peak_week_carb_g != null ? <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}><p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Peak carbs</p><p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: colors.text }}>{checkin.peak_week_carb_g} g</p></div> : null}
          </div>
          {checkin?.stage_condition_notes ? <div style={{ maxHeight: 120, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8], marginBottom: spacing[8] }}><p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>{checkin.stage_condition_notes}</p></div> : null}
          {checkin?.symmetry_notes ? <div style={{ maxHeight: 120, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}><p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>{checkin.symmetry_notes}</p></div> : null}
        </DataCard>
      ) : null}

      <DataCard title="Highlights">
        {checkin?.wins ? (
          <div style={{ border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.12)', borderRadius: 10, padding: spacing[10], marginBottom: spacing[8] }}>
            <p style={{ margin: 0, fontSize: 13, color: '#22c55e', fontWeight: 700 }}>🏆 Wins</p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>{checkin.wins}</p>
          </div>
        ) : null}
        {checkin?.struggles ? (
          <div style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: spacing[10] }}>
            <p style={{ margin: 0, fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>😤 Struggles</p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>{checkin.struggles}</p>
          </div>
        ) : null}
      </DataCard>

      <DataCard title="Custom answers">
        {Array.isArray(checkin?.answers) && checkin.answers.length ? (
          checkin.answers.map((a, i) => (
            <div key={`${a?.question_id || i}`} style={{ borderBottom: `1px solid ${colors.border}`, padding: `${spacing[8]}px 0` }}>
              <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{a?.question_text || `Question ${i + 1}`}</p>
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>{a?.answer || '—'}</p>
            </div>
          ))
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No custom answers submitted.</p>
        )}
      </DataCard>

      <DataCard title="Notes">
        {checkin?.coach_questions ? (
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8], marginBottom: spacing[8] }}>
            <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Coach questions field</p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>{checkin.coach_questions}</p>
          </div>
        ) : null}
        {checkin?.notes ? (
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[8] }}>
            <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>General notes</p>
            <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>{checkin.notes}</p>
          </div>
        ) : null}
      </DataCard>

      <PhotoGallery photoUrls={photoUrls} prevPhotoUrls={prevPhotoUrls} prioritize={reviewContext?.prioritizePhotos} />

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
      nav={nav}
      stickyWrapStyle={shell === 'desktop_web' ? railStickyStyle : { display: 'flex', flexDirection: 'column', gap: 0 }}
      macroSuggestionSlot={macroSuggestionSlot}
      onOpenCallRequest={() => setCallRequestOpen(true)}
      callRequest={callRequest}
      onJoinCall={handleStartCall}
    />
  );

  const callRequestModal = callRequestOpen ? (
    <div
      role="dialog"
      onClick={(e) => e.target === e.currentTarget && setCallRequestOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          background: colors.surface,
          borderRadius: '16px 16px 0 0',
          padding: 24,
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <p style={{ fontSize: 17, fontWeight: 600, color: colors.text, marginBottom: 4 }}>Request a call</p>
        <p style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>
          {clientName} will get a notification and can accept or suggest a different time.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { type: 'video', icon: '📹', label: 'Video call' },
            { type: 'phone', icon: '📞', label: 'Phone call' },
            { type: 'message', icon: '💬', label: 'Message' },
          ].map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setCallType(opt.type)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 10,
                border: `1px solid ${callType === opt.type ? colors.primary : colors.border}`,
                background: callType === opt.type ? colors.primarySubtle : 'transparent',
                color: callType === opt.type ? colors.primary : colors.muted,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              <div>{opt.icon}</div>
              <div>{opt.label}</div>
            </button>
          ))}
        </div>

        {callType !== 'message' ? (
          <>
            <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 6 }}>
              Proposed date & time
            </label>
            <input
              type="datetime-local"
              value={proposedAt}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setProposedAt(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                color: colors.text,
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 6 }}>
              Duration
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMins(mins)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    border: `1px solid ${durationMins === mins ? colors.primary : colors.border}`,
                    background: durationMins === mins ? colors.primarySubtle : 'transparent',
                    color: durationMins === mins ? colors.primary : colors.muted,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </>
        ) : null}

        <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 6 }}>
          What do you want to cover?
        </label>
        <textarea
          value={callAgenda}
          onChange={(e) => setCallAgenda(e.target.value)}
          placeholder={callType === 'message'
            ? 'What would you like to discuss over messages?'
            : 'Key points from this check-in you want to go through...'}
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            color: colors.text,
            fontSize: 14,
            resize: 'none',
            marginBottom: 16,
            fontFamily: 'inherit',
          }}
        />

        <button
          type="button"
          onClick={handleSendCallRequest}
          disabled={sendCallRequestMutation.isPending || (callType !== 'message' && !proposedAt)}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 12,
            border: 'none',
            background: (callType !== 'message' && !proposedAt) ? colors.border : colors.primary,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {sendCallRequestMutation.isPending ? 'Sending request…' : `Send request to ${clientName}`}
        </button>
        {callRequestError ? (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: colors.warning }}>
            {callRequestError}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  const coachCallOverlay = coachCallActive ? (
    <AtlasVideoCall
      callRequestId={callRequest?.id}
      role="caller"
      myName={coachName ?? 'Coach'}
      theirName={clientName}
      onEnd={() => {
        setCoachCallActive(false);
      }}
    />
    ) : null;

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
        {callRequestModal}
        {coachCallOverlay}
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
            {replyBusy ? '…' : nav?.nextId ? 'Send & next' : 'Send'}
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
      {callRequestModal}
      {coachCallOverlay}
    </div>
  );
}
