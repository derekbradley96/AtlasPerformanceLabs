/**
 * Coach-side check-in review — decision workspace (desktop 3-column vs app shell).
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { navigateToThread } from '@/lib/messagesPath';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import CheckInReviewDecisionWorkspace from '@/components/checkin-review/CheckInReviewDecisionWorkspace';
import TopBar from '@/components/ui/TopBar';
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
// Seeds local cache before navigation — ChatThread / useData use Supabase as source of truth.
// TODO: Use ensureThreadForClient(clientId) (already imported) instead of messageStore.openOrCreateThread.
import { openOrCreateThread } from '@/lib/messaging/messageStore';
import { getClientNutritionSnapshot } from '@/lib/clientNutritionPlan';
import { analyseMacroAdjustment } from '@/lib/macroAdjustmentEngine';
import AtlasMacroSuggestionCard from '@/components/checkin-review/AtlasMacroSuggestionCard';
import CoachFreeTextInput from '@/components/ui/CoachFreeTextInput';
import { draftCheckinResponse } from '@/lib/checkinResponseDraft';
import { incrementReviewActionCount, maybeRequestReview } from '@/lib/appReview';

const DRAFT_PREFIX = 'atlas_checkin_review_draft_';
const FLAG_PREFIX = 'atlas_checkin_review_flag_';
const MACRO_DISMISS_PREFIX = 'atlas_macro_suggestion_dismiss_v1_';
const DRAFT_CACHE_KEY = (checkinId) => `atlas_checkin_draft_${checkinId}_v1`;

function isoDaysAgoFromToday(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

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
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [openingThread, setOpeningThread] = useState(false);
  const [macroDismissed, setMacroDismissed] = useState(false);
  const [aiDraftText, setAiDraftText] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftError, setAiDraftError] = useState('');
  const [showAiDraftCard, setShowAiDraftCard] = useState(true);
  const [sendingAiDraft, setSendingAiDraft] = useState(false);
  const [draftTrigger, setDraftTrigger] = useState(0);
  const [reviewTags, setReviewTags] = useState([]);
  const [draftReady, setDraftReady] = useState(false);
  const draftInFlightRef = useRef(new Set());

  const { data: checkin, isLoading: checkinLoading } = useQuery({
    queryKey: ['checkin-review', checkinId],
    queryFn: () => getCheckinById(checkinId),
    enabled: !!checkinId,
  });

  const clientId = checkin?.client_id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  useEffect(() => {
    const raw = checkin?.coach_review_tags;
    if (Array.isArray(raw)) {
      setReviewTags(raw.map((t) => String(t).trim()).filter(Boolean));
    } else {
      setReviewTags([]);
    }
  }, [checkin?.id, checkin?.coach_review_tags]);

  const { data: clientRow } = useQuery({
    queryKey: ['client-row-checkin-review', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, user_id, name, full_name, client_type, delivery_context, client_goal, created_at,
          profiles:profiles!clients_user_id_fkey(display_name, avatar_url)
        `)
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const profileJoin = Array.isArray(data?.profiles) ? data.profiles[0] : data?.profiles;
      return {
        ...data,
        display_name: profileJoin?.display_name ?? null,
        avatar_url: profileJoin?.avatar_url ?? null,
      };
    },
    enabled: !!supabase && !!clientId,
  });

  const clientDisplayName = useMemo(
    () => clientRow?.display_name ?? clientRow?.name ?? 'Client',
    [clientRow]
  );

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

  const weightFromIso = isoDaysAgoFromToday(13);
  const adherenceFromIso = isoDaysAgoFromToday(6);
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: weightLogs14 = [] } = useQuery({
    queryKey: ['checkin-review-weight-logs', clientId, weightFromIso],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('client_weight_logs')
        .select('log_date, weight')
        .eq('client_id', clientId)
        .gte('log_date', weightFromIso)
        .lte('log_date', todayIso)
        .order('log_date', { ascending: true });
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: adherence7 = [] } = useQuery({
    queryKey: ['checkin-review-nutrition-adherence', clientId, adherenceFromIso, todayIso],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('nutrition_daily_adherence')
        .select('day_date, macros_hit_percent')
        .eq('client_id', clientId)
        .gte('day_date', adherenceFromIso)
        .lte('day_date', todayIso)
        .order('day_date', { ascending: true });
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: nutritionSnapshot } = useQuery({
    queryKey: ['checkin-review-nutrition-snapshot', clientId],
    queryFn: () => getClientNutritionSnapshot(clientId),
    enabled: !!clientId && hasSupabase,
  });

  const reviewContext = useMemo(
    () => resolveCheckinReviewContext(clientRow, checkin, dashboardData),
    [clientRow, checkin, dashboardData]
  );

  useEffect(() => {
    if (!clientId) return;
    try {
      const raw = localStorage.getItem(`${MACRO_DISMISS_PREFIX}${clientId}`);
      if (!raw) {
        setMacroDismissed(false);
        return;
      }
      const j = JSON.parse(raw);
      setMacroDismissed(Boolean(j?.until && new Date(j.until) > new Date()));
    } catch {
      setMacroDismissed(false);
    }
  }, [clientId]);

  const weeksToShow = useMemo(() => {
    const tw = Number(dashboardData?.total_weeks);
    const cw = Number(dashboardData?.current_week);
    if (!Number.isFinite(tw) || !Number.isFinite(cw)) return null;
    return Math.max(0, Math.round(tw - cw));
  }, [dashboardData]);

  const clientGoalForMacro = useMemo(() => {
    if (reviewContext.emphasis === 'competition_prep') return 'competition_prep';
    const dt = String(nutritionSnapshot?.diet_type ?? '').toLowerCase();
    if (dt === 'cut') return 'lose_fat';
    if (dt === 'bulk') return 'build_muscle';
    return 'maintenance';
  }, [reviewContext.emphasis, nutritionSnapshot?.diet_type]);

  const currentPlanForMacro = useMemo(
    () => ({
      calories: Number(nutritionSnapshot?.calories ?? nutritionSnapshot?.calorie_target) || null,
      protein: Number(nutritionSnapshot?.protein ?? nutritionSnapshot?.protein_g) || null,
      carbs: Number(nutritionSnapshot?.carbs ?? nutritionSnapshot?.carbs_g) || null,
      fats: Number(nutritionSnapshot?.fats ?? nutritionSnapshot?.fat_g ?? nutritionSnapshot?.fats_g) || null,
    }),
    [nutritionSnapshot]
  );

  const macroAnalysis = useMemo(() => {
    if (!nutritionSnapshot || !currentPlanForMacro?.calories) return null;
    return analyseMacroAdjustment({
      currentPlan: currentPlanForMacro,
      recentWeights: weightLogs14,
      recentAdherence: adherence7,
      clientGoal: clientGoalForMacro,
      weeksToShow,
    });
  }, [nutritionSnapshot, currentPlanForMacro, weightLogs14, adherence7, clientGoalForMacro, weeksToShow]);

  const onDismissMacroSuggestion = useCallback(() => {
    if (!clientId) return;
    try {
      const until = new Date(Date.now() + 7 * 86400000).toISOString();
      localStorage.setItem(`${MACRO_DISMISS_PREFIX}${clientId}`, JSON.stringify({ until }));
    } catch {
      /* ignore */
    }
    setMacroDismissed(true);
    toast.message('Macro suggestion hidden for 7 days');
  }, [clientId]);

  const onApplyMacroSuggestion = useCallback(() => {
    if (!clientId || !macroAnalysis?.suggestedCalories) return;
    const q = new URLSearchParams();
    q.set('clientId', clientId);
    q.set('suggestCalories', String(Math.round(macroAnalysis.suggestedCalories)));
    if (macroAnalysis.suggestedProtein != null) q.set('suggestProtein_g', String(Math.round(macroAnalysis.suggestedProtein)));
    if (macroAnalysis.suggestedCarbs != null) q.set('suggestCarbs_g', String(Math.round(macroAnalysis.suggestedCarbs)));
    if (macroAnalysis.suggestedFats != null) q.set('suggestFats_g', String(Math.round(macroAnalysis.suggestedFats)));
    navigate(`/nutrition-builder?${q.toString()}`);
  }, [clientId, macroAnalysis, navigate]);

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

  const displayWeight = checkin?.weight_kg ?? checkin?.weight ?? null;
  const currentWeight = displayWeight;
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
    setShowAiDraftCard(true);
    setAiDraftText('');
    setAiDraftError('');
    setDraftTrigger(0);
  }, [checkinId]);

  useEffect(() => {
    setDraftReady(false);
    const timer = setTimeout(() => setDraftReady(true), 2000);
    return () => {
      clearTimeout(timer);
      setDraftReady(false);
    };
  }, [checkinId]);

  const runDraftCheckinResponse = useCallback(async () => {
    if (!checkin || !clientRow || !checkinId) return;
    if (draftInFlightRef.current.has(checkinId)) return;
    draftInFlightRef.current.add(checkinId);
    const cacheKey = DRAFT_CACHE_KEY(checkinId);
    setAiDraftLoading(true);
    setAiDraftError('');
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAiDraftText(cached);
        setAiDraftLoading(false);
        return;
      }
      // Server-side copilot: the edge function assembles this client's
      // check-in history itself, so the page only sends the id.
      const result = await draftCheckinResponse({ checkinId });
      const draftText = result?.draft || '';
      setAiDraftText(draftText);
      if (draftText) {
        sessionStorage.setItem(cacheKey, draftText);
      }
      if (!draftText) {
        setAiDraftError('Could not generate draft — write your own response below');
      }
    } catch {
      setAiDraftError('Could not generate draft — write your own response below');
      setAiDraftText('');
    } finally {
      draftInFlightRef.current.delete(checkinId);
      setAiDraftLoading(false);
    }
  }, [checkin, clientRow, checkinId]);

  useEffect(() => {
    if (!checkin || !clientRow || !showAiDraftCard || !draftReady) return;
    runDraftCheckinResponse();
  }, [checkin?.id, clientRow?.id, showAiDraftCard, draftTrigger, draftReady, runDraftCheckinResponse]);

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
      if (import.meta.env.DEV) {
        console.log('[CheckInReview] photos array:', checkin?.photos);
      }
      if (!checkin?.photos || !Array.isArray(checkin.photos) || checkin.photos.length === 0) {
        if (!cancelled) {
          setPhotoUrls([]);
        }
        return;
      }
      const resolved = await Promise.all(
        checkin.photos.map(async (path) => {
          const signed = await createCheckinPhotoSignedUrl(path);
          if (!signed && import.meta.env.DEV) {
            console.warn('[CheckInReview] failed to sign:', path);
          }
          return { path, url: signed || null, error: !signed };
        })
      );
      if (!cancelled) {
        setPhotoUrls(resolved.map((r) => r.url).filter(Boolean));
      }
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

  const markReviewedMutation = useMutation({
    mutationFn: () => markCheckinReviewed(checkinId),
    onMutate: async (tags) => {
      await queryClient.cancelQueries({ queryKey: ['checkins-by-client-review', clientId] });
      await queryClient.cancelQueries({ queryKey: ['checkin-review', checkinId] });
      const previousList = queryClient.getQueryData(['checkins-by-client-review', clientId]);
      const previousDetail = queryClient.getQueryData(['checkin-review', checkinId]);
      queryClient.setQueryData(['checkins-by-client-review', clientId], (old) =>
        Array.isArray(old) ? old.filter((row) => String(row?.id) !== String(checkinId)) : old
      );
      queryClient.setQueryData(['checkin-review', checkinId], (old) =>
        old && typeof old === 'object'
          ? {
              ...old,
              reviewed_at: new Date().toISOString(),
              reviewed_by: coachId || true,
              coach_review_tags: Array.isArray(tags) ? tags : [],
            }
          : old
      );
      return { previousList, previousDetail };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(['checkins-by-client-review', clientId], context.previousList);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(['checkin-review', checkinId], context.previousDetail);
      }
      toast.error('Could not save — please try again');
    },
    onSuccess: () => {
      const count = incrementReviewActionCount();
      void maybeRequestReview(count);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin-review', checkinId] });
      queryClient.invalidateQueries({ queryKey: ['checkins-by-client-review', clientId] });
      queryClient.invalidateQueries({ queryKey: ['coach-home-workload'] });
    },
  });

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
      const ok = await markReviewedMutation.mutateAsync(reviewTags);
      if (ok) {
        const baseFeedback = (responseText || adjustmentComposer || '').trim() || 'Great check-in this week. Keep momentum and message me if anything changes.';
        setReviewCompleted(true);
        setFeedbackDraft(baseFeedback);
        toast.success('✓ Marked as reviewed');
      } else {
        toast.error('Could not mark as reviewed');
      }
      return ok;
    } finally {
      setMarking(false);
    }
  }, [checkinId, marking, clientId, responseText, adjustmentComposer, markReviewedMutation, reviewTags]);

  const handleSendToClient = useCallback(async () => {
    if (!clientId) return;
    setOpeningThread(true);
    try {
      await openOrCreateThread({ clientId, clientName: clientDisplayName });
      navigateToThread(navigate, clientId, {
        state: { prefilledMessage: feedbackDraft || responseText || '' },
      });
    } finally {
      setOpeningThread(false);
    }
  }, [clientId, clientDisplayName, navigate, feedbackDraft, responseText]);

  const handleSkipAfterReview = useCallback(() => {
    navigate('/review-center/checkins');
  }, [navigate]);

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
      const ok = await markReviewedMutation.mutateAsync(reviewTags);
      if (ok) {
        toast.success('Sent and marked reviewed');
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
    nextCheckin?.id,
    navigateToReview,
    navigate,
    markReviewedMutation,
    reviewTags,
  ]);

  const onSendAiDraft = useCallback(async () => {
    if (!clientId || !coachId) {
      toast.error('Sign in as coach to send');
      return;
    }
    const message = aiDraftText.trim();
    if (!message) {
      toast.error('Write a response before sending');
      return;
    }
    setSendingAiDraft(true);
    try {
      const thread = await ensureThreadForClient(clientId, coachId);
      if (!thread?.id) {
        toast.error('Could not open conversation');
        return;
      }
      const sent = await sendMessage(thread.id, message, coachId);
      if (!sent) {
        toast.error('Message not sent');
        return;
      }
      toast.success(`Sent to ${clientDisplayName}`);
    } finally {
      setSendingAiDraft(false);
    }
  }, [clientId, coachId, aiDraftText, clientDisplayName]);

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

  const macroSuggestionSlot = useMemo(() => {
    if (macroDismissed || isReviewed || !macroAnalysis) return null;
    const show = macroAnalysis.shouldAdjust || macroAnalysis.adherenceNote;
    if (!show) return null;
    const displayName = clientDisplayName;
    return (
      <AtlasMacroSuggestionCard
        clientName={displayName}
        analysis={macroAnalysis}
        currentPlan={currentPlanForMacro}
        onDismiss={onDismissMacroSuggestion}
        onApplySuggested={onApplyMacroSuggestion}
      />
    );
  }, [
    macroDismissed,
    isReviewed,
    macroAnalysis,
    clientDisplayName,
    currentPlanForMacro,
    onDismissMacroSuggestion,
    onApplyMacroSuggestion,
  ]);

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
    const pageContainer = {
      minHeight: '100vh',
      background: colors.bg,
      color: colors.text,
    };
    const pulse = { animation: 'atlas-pulse 1.5s ease-in-out infinite' };
    return (
      <div className="min-h-screen" {...atlasMigrationDataAttributes(m.phase, m.primary)} style={pageContainer}>
        <TopBar title="Check-in review" onBack={() => navigate(-1)} />
        <div style={{ padding: `${spacing[16]}px` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[12],
              marginBottom: spacing[20],
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: colors.surface2,
                ...pulse,
              }}
            />
            <div>
              <div
                style={{
                  width: 140,
                  height: 16,
                  borderRadius: 8,
                  background: colors.surface2,
                  marginBottom: spacing[6],
                  ...pulse,
                }}
              />
              <div
                style={{
                  width: 100,
                  height: 12,
                  borderRadius: 6,
                  background: colors.surface2,
                  ...pulse,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: spacing[8],
              marginBottom: spacing[16],
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 72,
                  borderRadius: 12,
                  background: colors.surface2,
                  ...pulse,
                }}
              />
            ))}
          </div>

          <div
            style={{
              width: '100%',
              height: 200,
              borderRadius: 16,
              background: colors.surface2,
              marginBottom: spacing[16],
              ...pulse,
            }}
          />

          <div
            style={{
              width: '100%',
              height: 120,
              borderRadius: 12,
              background: colors.surface2,
              ...pulse,
            }}
          />
        </div>
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
    <div>
      {reviewCompleted ? (
        <div style={{ padding: spacing[16], background: colors.surface1, borderBottom: `1px solid ${colors.border}` }}>
          <p style={{ margin: 0, fontWeight: 700, color: colors.success }}>✓ Marked as reviewed</p>
          <p style={{ margin: `${spacing[8]}px 0`, fontSize: 13, color: colors.muted }}>Send feedback message</p>
          <textarea
            value={feedbackDraft}
            onChange={(e) => setFeedbackDraft(e.target.value)}
            rows={4}
            style={{ width: '100%', background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: spacing[10] }}
          />
          <div style={{ display: 'flex', gap: spacing[12], marginTop: spacing[10], alignItems: 'center' }}>
            <Button type="button" onClick={handleSendToClient} disabled={openingThread}>
              {openingThread ? 'Opening…' : 'Send to client'}
            </Button>
            <button type="button" onClick={handleSkipAfterReview} style={{ color: colors.muted, background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
              Skip
            </button>
          </div>
        </div>
      ) : null}

      {showAiDraftCard ? (
        <section style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}`, background: colors.bg }}>
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: spacing[12], background: colors.surface1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.primary }}>
              Atlas AI draft — edit before sending
            </p>
            {aiDraftLoading ? (
              <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[8] }}>
                <div style={{ height: 12, borderRadius: 6, background: colors.surface2 }} />
                <div style={{ height: 12, borderRadius: 6, background: colors.surface2 }} />
                <div style={{ height: 12, borderRadius: 6, width: '80%', background: colors.surface2 }} />
              </div>
            ) : (
              <>
                {aiDraftError ? (
                  <p style={{ margin: `${spacing[8]}px 0 0`, color: colors.warning, fontSize: 12 }}>{aiDraftError}</p>
                ) : null}
                <textarea
                  value={aiDraftText}
                  onChange={(e) => setAiDraftText(e.target.value)}
                  rows={4}
                  style={{
                    marginTop: spacing[10],
                    width: '100%',
                    background: colors.surface2,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: spacing[10],
                  }}
                />
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, color: colors.muted }}>
                  {aiDraftText?.length ?? 0} / 500 characters
                </p>
                {(aiDraftText?.length ?? 0) > 500 ? (
                  <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.warning }}>
                    This draft is over 500 characters. Consider tightening it for readability.
                  </p>
                ) : null}
                <div style={{ marginTop: spacing[10], display: 'flex', gap: spacing[10], alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button onClick={onSendAiDraft} disabled={sendingAiDraft || aiDraftLoading}>
                    {sendingAiDraft ? 'Sending…' : `Send to ${clientDisplayName.split(' ')[0]}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      sessionStorage.removeItem(DRAFT_CACHE_KEY(checkinId));
                      setAiDraftText('');
                      setAiDraftError('');
                      setAiDraftLoading(true);
                      setDraftTrigger((t) => t + 1);
                    }}
                    disabled={aiDraftLoading}
                  >
                    Regenerate
                  </Button>
                  <button
                    type="button"
                    style={{ color: colors.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => setShowAiDraftCard(false)}
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}

      {!isReviewed ? (
        <section style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}`, background: colors.surface1 }}>
          <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, fontWeight: 700, color: colors.text }}>Review tags</p>
          {reviewTags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: spacing[10] }}>
              {reviewTags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 28,
                    padding: '2px 10px',
                    borderRadius: 999,
                    background: colors.primarySubtle,
                    border: `1px solid ${colors.primary}`,
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove ${t}`}
                    onClick={() => setReviewTags((prev) => prev.filter((x) => x !== t))}
                    style={{
                      marginLeft: 6,
                      border: 'none',
                      background: 'transparent',
                      color: colors.muted,
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <CoachFreeTextInput
            category="checkin_tag"
            placeholder="Tag this review, e.g. great week, macro check, sleep issue…"
            label=""
            maxTerms={3}
            allowMultiple
            onConfirm={(terms) => {
              setReviewTags((prev) => {
                const merged = [...new Set([...prev, ...terms])];
                return merged.slice(0, 3);
              });
            }}
          />
        </section>
      ) : null}

      <CheckInReviewDecisionWorkspace
        shell={shell}
        checkinId={checkinId}
        clientId={clientId}
        clientUserId={clientRow?.user_id}
        coachId={profile?.id ?? user?.id ?? checkin?.trainer_id ?? checkin?.coach_id}
        coachName={profile?.display_name ?? profile?.full_name ?? 'Your coach'}
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
        macroSuggestionSlot={macroSuggestionSlot}
      />
    </div>
  );
}
