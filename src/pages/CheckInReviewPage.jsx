/**
 * Coach-side check-in review — decision workspace (desktop 3-column vs app shell).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import CheckInReviewDecisionWorkspace from '@/components/checkin-review/CheckInReviewDecisionWorkspace';
import { PageLoader } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import {
  getCheckinById,
  markCheckinReviewed,
  createCheckinPhotoSignedUrl,
} from '@/lib/checkins';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { resolveViewerBodyweightUnit } from '@/lib/bodyMeasurementUnits';
import { usePresentationMode } from '@/lib/presentationMode';
import {
  resolveCheckinReviewContext,
  buildWhatChangedStrip,
  computeWaterSodiumStability,
  buildSmartSignals,
  deriveUrgencyBadge,
  deriveOnTrackLabel,
  deriveReviewStateLabel,
  trendSeriesForMiniCharts,
} from '@/lib/checkinReviewWorkspaceModel';
import {
  fetchClientPrepPrecision,
  fetchClientPrepPrecisionDailyRange,
  todayLocalDateString,
  daysAgoDateString,
} from '@/data/prepPrecisionService';
import { deriveCheckInReviewRouteState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { ensureThreadForClient, sendMessage } from '@/data/messagingService';

const DRAFT_PREFIX = 'atlas_checkin_review_draft_';
const FLAG_PREFIX = 'atlas_checkin_review_flag_';

export default function CheckInReviewPage() {
  const navigate = useNavigate();
  const { checkinId } = useParams();
  const queryClient = useQueryClient();
  const { profile, user, isDemoMode } = useAuth();
  const coachId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const viewerWU = resolveViewerBodyweightUnit(profile);
  const { isDesktopWeb } = usePresentationMode();

  const [photoUrls, setPhotoUrls] = useState([]);
  const [prevPhotoUrls, setPrevPhotoUrls] = useState([]);
  const [marking, setMarking] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState('keep_same');
  const [adjustmentComposer, setAdjustmentComposer] = useState('');
  const [responseText, setResponseText] = useState('');
  const [sessionFlag, setSessionFlagState] = useState('none');
  const [replyBusy, setReplyBusy] = useState(false);

  const { data: checkin, isLoading: checkinLoading } = useQuery({
    queryKey: ['checkin-review', checkinId],
    queryFn: () => getCheckinById(checkinId),
    enabled: !!checkinId,
  });

  const clientId = checkin?.client_id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: clientRow } = useQuery({
    queryKey: ['client-row-checkin-review', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, full_name, client_type, delivery_context')
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['v_client_progress_trends', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('v_client_progress_trends')
        .select('*')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: true });
      return error ? [] : (Array.isArray(data) ? data : []);
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: metrics } = useQuery({
    queryKey: ['v_client_progress_metrics', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data, error } = await supabase
        .from('v_client_progress_metrics')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: checkinList = [] } = useQuery({
    queryKey: ['checkins-by-client-review', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('checkins')
        .select('id, submitted_at, created_at, week_start, weight, weight_kg, adherence_pct, training_completion, cardio_completion, steps_avg')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      return error ? [] : (Array.isArray(data) ? data : []);
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['v_client_master_dashboard_review', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data, error } = await supabase
        .from('v_client_master_dashboard')
        .select('phase,current_week,total_weeks')
        .eq('client_id', clientId)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!clientId,
  });

  const reviewContext = useMemo(
    () => resolveCheckinReviewContext(clientRow, checkin, dashboardData),
    [clientRow, checkin, dashboardData]
  );

  const { data: prepPrecision } = useQuery({
    queryKey: ['prep-precision-checkin-review', clientId],
    queryFn: async () => {
      try {
        return await fetchClientPrepPrecision(clientId);
      } catch {
        return null;
      }
    },
    enabled: !!clientId && reviewContext.showPrepHygiene,
  });

  const prepFrom = daysAgoDateString(13);
  const prepTo = todayLocalDateString();
  const { data: prepDailies = [] } = useQuery({
    queryKey: ['prep-dailies-checkin-review', clientId, prepFrom, prepTo],
    queryFn: async () => {
      try {
        return await fetchClientPrepPrecisionDailyRange(clientId, prepFrom, prepTo);
      } catch {
        return [];
      }
    },
    enabled: !!clientId && reviewContext.showPrepHygiene,
  });

  const orderedCheckins = useMemo(
    () => (Array.isArray(checkinList) ? checkinList : []).filter((c) => c?.id),
    [checkinList]
  );
  const currentIndex = useMemo(
    () => orderedCheckins.findIndex((c) => String(c.id) === String(checkinId)),
    [orderedCheckins, checkinId]
  );
  const previousForDelta = currentIndex >= 0 && currentIndex < orderedCheckins.length - 1 ? orderedCheckins[currentIndex + 1] : null;
  const previousCheckin = previousForDelta;
  const nextCheckin = currentIndex > 0 ? orderedCheckins[currentIndex - 1] : null;

  const { data: previousCheckinFull } = useQuery({
    queryKey: ['checkin-prev-full', previousForDelta?.id],
    queryFn: () => getCheckinById(previousForDelta.id),
    enabled: !!previousForDelta?.id,
  });

  const currentWeight = checkin?.weight_kg ?? checkin?.weight ?? null;
  const prevWeight = previousCheckin?.weight_kg ?? previousCheckin?.weight ?? null;
  const weightDeltaKg =
    currentWeight != null && prevWeight != null ? Number(currentWeight) - Number(prevWeight) : null;
  const adherencePct = checkin?.adherence_pct ?? checkin?.training_completion ?? metrics?.training_adherence ?? null;
  const sessionsCompleted = checkin?.sessions_completed ?? checkin?.training_sessions_completed ?? metrics?.training_sessions_completed ?? null;
  const cardioOrSteps = checkin?.cardio_completion ?? checkin?.steps_avg ?? metrics?.cardio_completion ?? metrics?.steps_avg ?? null;

  const prepStability = useMemo(() => computeWaterSodiumStability(prepDailies), [prepDailies]);

  const whatChanged = useMemo(() => {
    if (!checkin) return [];
    const prep =
      reviewContext.showPrepHygiene && prepStability
        ? { waterStability: prepStability.waterStability, sodiumStability: prepStability.sodiumStability }
        : {};
    return buildWhatChangedStrip(checkin, previousCheckinFull || previousCheckin, prep, viewerWU);
  }, [checkin, previousCheckin, previousCheckinFull, reviewContext.showPrepHygiene, prepStability, viewerWU]);

  const smartSignals = useMemo(
    () =>
      buildSmartSignals({
        checkin,
        previousCheckin: previousCheckinFull || previousCheckin,
        weightDeltaKg,
        adherencePct: adherencePct != null ? Number(adherencePct) : null,
        prepStability,
        trends,
        emphasis: reviewContext.emphasis,
      }),
    [checkin, previousCheckin, previousCheckinFull, weightDeltaKg, adherencePct, prepStability, trends, reviewContext.emphasis]
  );

  const trackStatus = useMemo(() => deriveOnTrackLabel(adherencePct, weightDeltaKg), [adherencePct, weightDeltaKg]);
  const urgencyBadge = useMemo(() => deriveUrgencyBadge(adherencePct, weightDeltaKg), [adherencePct, weightDeltaKg]);

  const miniSeries = useMemo(
    () => trendSeriesForMiniCharts(trends, checkin?.submitted_at || checkin?.created_at),
    [trends, checkin]
  );

  const prepWaterSeries = useMemo(
    () => (Array.isArray(prepDailies) ? prepDailies.map((d) => Number(d.water_actual_ml)).filter((n) => Number.isFinite(n)) : []),
    [prepDailies]
  );
  const prepSodiumSeries = useMemo(
    () => (Array.isArray(prepDailies) ? prepDailies.map((d) => Number(d.sodium_actual_mg)).filter((n) => Number.isFinite(n)) : []),
    [prepDailies]
  );

  const phaseWeekText = useMemo(() => {
    if (dashboardData?.current_week != null && dashboardData?.total_weeks != null) {
      return `Week ${dashboardData.current_week} of ${dashboardData.total_weeks} · ${dashboardData?.phase ?? checkin?.focus_type ?? 'Phase'}`;
    }
    return `${dashboardData?.phase ?? checkin?.focus_type ?? 'Phase'}`;
  }, [dashboardData, checkin]);

  const draftKey = `${DRAFT_PREFIX}${checkinId}`;
  const flagKey = `${FLAG_PREFIX}${checkinId}`;

  useEffect(() => {
    if (!checkinId) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const j = JSON.parse(raw);
        if (typeof j.response === 'string') setResponseText(j.response);
        if (typeof j.adjustment === 'string') setAdjustmentComposer(j.adjustment);
      }
    } catch {
      /* ignore */
    }
  }, [checkinId, draftKey]);

  useEffect(() => {
    if (!checkinId) return;
    try {
      const v = sessionStorage.getItem(flagKey);
      if (v === 'follow_up' || v === 'urgent') setSessionFlagState(v);
      else setSessionFlagState('none');
    } catch {
      setSessionFlagState('none');
    }
  }, [checkinId, flagKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkin?.photos || !Array.isArray(checkin.photos) || checkin.photos.length === 0) {
        if (!cancelled) setPhotoUrls([]);
        return;
      }
      const urls = await Promise.all(checkin.photos.map((path) => createCheckinPhotoSignedUrl(path)));
      if (!cancelled) setPhotoUrls(urls.filter(Boolean));
    })();
    return () => {
      cancelled = true;
    };
  }, [checkin?.photos, checkin?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prev = previousCheckinFull;
      if (!prev?.photos || !Array.isArray(prev.photos) || prev.photos.length === 0) {
        if (!cancelled) setPrevPhotoUrls([]);
        return;
      }
      const urls = await Promise.all(prev.photos.map((path) => createCheckinPhotoSignedUrl(path)));
      if (!cancelled) setPrevPhotoUrls(urls.filter(Boolean));
    })();
    return () => {
      cancelled = true;
    };
  }, [previousCheckinFull]);

  const onSetSessionFlag = useCallback(
    (f) => {
      setSessionFlagState(f);
      try {
        if (f === 'none') sessionStorage.removeItem(flagKey);
        else sessionStorage.setItem(flagKey, f);
      } catch {
        /* ignore */
      }
      if (f === 'follow_up') toast.message('Flagged for follow-up (this device session)');
      if (f === 'urgent') toast.message('Marked urgent for your workflow (this device session)');
    },
    [flagKey]
  );

  const onSaveDraft = useCallback(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ response: responseText, adjustment: adjustmentComposer }));
      toast.success('Draft saved');
    } catch {
      toast.error('Could not save draft');
    }
  }, [draftKey, responseText, adjustmentComposer]);

  const onAppendAdjustmentSnippet = useCallback((snippet) => {
    setAdjustmentComposer((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  }, []);

  const onApplyTemplate = useCallback((body) => {
    setResponseText((prev) => (prev?.trim() ? `${prev.trim()}\n\n${body}` : body));
  }, []);

  const navigateToReview = useCallback(
    (id) => {
      if (!id) return;
      const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      navigate(`/review-center/checkins/${id}${qs}`);
    },
    [navigate, clientId]
  );

  const appendComposerLine = useCallback((line) => {
    setAdjustmentComposer((prev) => (prev?.trim() ? `${prev.trim()}\n${line}` : line));
  }, []);

  const handleMarkReviewed = useCallback(async () => {
    if (!checkinId || marking) return false;
    setMarking(true);
    try {
      const ok = await markCheckinReviewed(checkinId);
      if (ok) {
        toast.success('Marked as reviewed');
        queryClient.invalidateQueries({ queryKey: ['checkin-review', checkinId] });
        queryClient.invalidateQueries({ queryKey: ['checkins-by-client-review', clientId] });
      } else {
        toast.error('Could not mark as reviewed');
      }
      return ok;
    } finally {
      setMarking(false);
    }
  }, [checkinId, marking, queryClient, clientId]);

  const buildOutboundMessage = useCallback(() => {
    const parts = [responseText.trim(), adjustmentComposer.trim()].filter(Boolean);
    const adj = selectedAdjustment && selectedAdjustment !== 'keep_same' ? `Adjustment intent: ${String(selectedAdjustment).replace(/_/g, ' ')}` : '';
    const tail = [adj, sessionFlag === 'follow_up' ? '[Follow-up flagged]' : '', sessionFlag === 'urgent' ? '[Urgent]' : ''].filter(Boolean).join(' ');
    const base = parts.join('\n\n') || 'Thanks for the check-in — I’ve reviewed it and we’re aligned for the week ahead.';
    return tail ? `${base}\n\n${tail}`.trim() : base;
  }, [responseText, adjustmentComposer, selectedAdjustment, sessionFlag]);

  const onApproveAndMessage = useCallback(async () => {
    if (!clientId || !coachId) {
      toast.error('Sign in as coach to send');
      return;
    }
    setReplyBusy(true);
    try {
      const body = buildOutboundMessage();
      const thread = await ensureThreadForClient(clientId, coachId);
      if (!thread?.id) {
        toast.error('Could not open conversation');
        return;
      }
      const sent = await sendMessage(thread.id, body, coachId);
      if (!sent) {
        toast.error('Message not sent');
        return;
      }
      const ok = await markCheckinReviewed(checkinId);
      if (ok) {
        toast.success('Sent and marked reviewed');
        queryClient.invalidateQueries({ queryKey: ['checkin-review', checkinId] });
        queryClient.invalidateQueries({ queryKey: ['checkins-by-client-review', clientId] });
        if (nextCheckin?.id) navigateToReview(nextCheckin.id);
        else navigate('/review-center');
      } else {
        toast.message('Message sent — could not mark reviewed in app');
      }
    } finally {
      setReplyBusy(false);
    }
  }, [
    clientId,
    coachId,
    buildOutboundMessage,
    checkinId,
    queryClient,
    nextCheckin?.id,
    navigateToReview,
    navigate,
  ]);

  const onRequestUpdate = useCallback(async () => {
    if (!clientId || !coachId) {
      toast.error('Sign in as coach to send');
      return;
    }
    const note =
      responseText.trim() ||
      'Thanks for the update. Please send another check-in in a few days with weight, adherence, and a short note on recovery.';
    setReplyBusy(true);
    try {
      const thread = await ensureThreadForClient(clientId, coachId);
      if (!thread?.id) {
        toast.error('Could not open conversation');
        return;
      }
      const sent = await sendMessage(thread.id, note, coachId);
      if (sent) toast.success('Update request sent');
      else toast.error('Message not sent');
    } finally {
      setReplyBusy(false);
    }
  }, [clientId, coachId, responseText]);

  const quickHandlers = useMemo(
    () => ({
      onKeepPlan: () => {
        setSelectedAdjustment('keep_same');
        toast.message('Intent: keep plan');
      },
      onAdjustMacros: () => {
        appendComposerLine('[Macros] Review calorie/macro targets — specify direction and magnitude below.');
        toast.message('Added to adjustment notes');
      },
      onAdjustTraining: () => {
        appendComposerLine('[Training] Adjust load, volume, or exercise selection — specify below.');
        toast.message('Added to adjustment notes');
      },
      onAdjustCardio: () => {
        appendComposerLine('[Cardio] Adjust cardio (frequency, duration, intensity, or modality).');
        toast.message('Added to adjustment notes');
      },
      onAdjustWater: () => {
        appendComposerLine('[Water] Adjust daily water target / timing for prep.');
        toast.message('Added to adjustment notes');
      },
      onAdjustSodium: () => {
        appendComposerLine('[Sodium] Adjust sodium target / timing for prep.');
        toast.message('Added to adjustment notes');
      },
    }),
    [appendComposerLine]
  );

  const isReviewed = !!(checkin?.reviewed_at || checkin?.reviewed_by);
  const reviewStateLabel = useMemo(
    () => deriveReviewStateLabel(checkin, { sessionFlag }),
    [checkin, sessionFlag]
  );

  useEffect(() => {
    const desktop = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false;
    if (!desktop) return undefined;
    const onKeyDown = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      const isTypingTarget = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
      if (isTypingTarget || event.altKey || event.ctrlKey || event.metaKey) return;
      if (replyBusy) return;
      if (event.key === 'ArrowLeft' && previousCheckin?.id) {
        event.preventDefault();
        navigateToReview(previousCheckin.id);
        return;
      }
      if (event.key === 'ArrowRight' && nextCheckin?.id) {
        event.preventDefault();
        navigateToReview(nextCheckin.id);
        return;
      }
      if (isReviewed || marking) return;
      if (event.key === '1') {
        event.preventDefault();
        handleMarkReviewed();
      } else if (event.key === '2') {
        event.preventDefault();
        onApproveAndMessage();
      } else if (event.key === '3') {
        event.preventDefault();
        onRequestUpdate();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    previousCheckin?.id,
    nextCheckin?.id,
    navigateToReview,
    handleMarkReviewed,
    onApproveAndMessage,
    onRequestUpdate,
    isReviewed,
    marking,
    replyBusy,
  ]);

  if (checkinLoading) {
    const m = deriveCheckInReviewRouteState({ view: 'loading' });
    return (
      <div
        className="min-h-screen"
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{ background: colors.bg, color: colors.text, padding: spacing[20] }}
      >
        <PageLoader message="Loading check-in…" />
      </div>
    );
  }

  if (!checkin) {
    const m = deriveCheckInReviewRouteState({ view: 'not_found' });
    return (
      <div
        className="min-h-screen"
        {...atlasMigrationDataAttributes(m.phase, m.primary)}
        style={{ background: colors.bg, color: colors.text }}
      >
        <div className="p-6 text-center">
          <p style={{ color: colors.muted }}>Check-in not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const submissionAt = checkin.submitted_at || checkin.created_at || checkin.week_start;
  const shell = isDesktopWeb ? 'desktop_web' : 'mobile_app';

  return (
    <CheckInReviewDecisionWorkspace
      shell={shell}
      checkin={checkin}
      clientRow={clientRow}
      dashboardData={dashboardData}
      reviewContext={reviewContext}
      whatChanged={whatChanged}
      smartSignals={smartSignals}
      trackStatus={trackStatus}
      urgencyBadge={urgencyBadge}
      reviewStateLabel={reviewStateLabel}
      phaseWeekText={phaseWeekText}
      submissionAt={submissionAt}
      photoUrls={photoUrls}
      prevPhotoUrls={prevPhotoUrls}
      miniSeries={miniSeries}
      prepWaterSeries={prepWaterSeries}
      prepSodiumSeries={prepSodiumSeries}
      prepPrecision={prepPrecision}
      viewerWU={viewerWU}
      weightDeltaKg={weightDeltaKg}
      adherencePct={adherencePct}
      sessionsCompleted={sessionsCompleted}
      cardioOrSteps={cardioOrSteps}
      nav={{
        prevId: previousCheckin?.id,
        nextId: nextCheckin?.id,
        onPrev: () => navigateToReview(previousCheckin?.id),
        onNext: () => navigateToReview(nextCheckin?.id),
      }}
      selectedAdjustment={selectedAdjustment}
      onSelectAdjustment={setSelectedAdjustment}
      adjustmentComposer={adjustmentComposer}
      onAdjustmentComposerChange={setAdjustmentComposer}
      onAppendAdjustmentSnippet={onAppendAdjustmentSnippet}
      responseText={responseText}
      onResponseChange={setResponseText}
      onApplyTemplate={onApplyTemplate}
      onSaveDraft={onSaveDraft}
      quickHandlers={quickHandlers}
      sessionFlag={sessionFlag}
      onSetSessionFlag={onSetSessionFlag}
      onMarkReviewed={handleMarkReviewed}
      onApproveAndMessage={onApproveAndMessage}
      onRequestUpdate={onRequestUpdate}
      marking={marking}
      replyBusy={replyBusy}
      isReviewed={isReviewed}
    />
  );
}
