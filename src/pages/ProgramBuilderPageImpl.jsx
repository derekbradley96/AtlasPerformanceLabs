/**
 * ACTIVE program builder — this is the canonical version
 */
// TODO(refactor): Extract useProgramBuilderData hook.
// See docs/HOOKS_EXTRACTION_PLAN.md
/**
 * Program Builder MVP – coach or personal user creates/edits program blocks (Supabase):
 * program_blocks → program_weeks → program_days → program_exercises.
 * Personal blocks use owner_profile_id; coach blocks use client_id.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useProgramBuilderData } from '@/hooks/useProgramBuilderData';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { isCoach, isAdmin, isPersonal } from '@/lib/roles';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard, pageContainer, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import CoachFreeTextInput from '@/components/ui/CoachFreeTextInput';
import { PageLoader } from '@/components/ui/LoadingState';
import ProgramBuilderHeader from '@/components/program-builder/ProgramBuilderHeader';
import ProgramEntryPanel from '@/components/program-builder/ProgramEntryPanel';
import ProgramWeekView from '@/components/program-builder/ProgramWeekView';
import DuplicateToClientSheet from '@/components/program-builder/DuplicateToClientSheet';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import { personalColumnInnerBodyStyle } from '@/lib/personalShellLayout';
import ExercisePickerModal from '@/components/programs/ExercisePickerModal';
import { UserPlus, Save } from 'lucide-react';
import { duplicateBlockToClient } from '@/lib/supabaseRepo/phaseProgramRepo';
import { activatePersonalProgramAssignment } from '@/lib/personalProgramSeed';
import { ensureProgramWeekRowsForBlock } from '@/lib/programBlockWeeks';
import { trackFirstProgramCreated } from '@/services/firstSessionTracker';
import {
  generateQuickStartWeek,
  suggestWeekStructureType,
  getQuickStartWeekPreviewTitles,
} from '@/lib/workoutQuickStart';
import {
  ensureAtlasExerciseLibrarySeeded,
  listAtlasExerciseCandidates,
  searchAtlasExercises,
  trackExerciseUsage,
  trackUsageBatch,
} from '@/data/atlasExerciseLibraryService';


import { generateStarterProgram, chooseSplitForContext } from '@/lib/autoProgramBuilder';
import {
  canShowPersonalUpgradePrompt,
  canUsePersonalFeature,
  getPersonalUpgradeCopy,
  markPersonalUpgradePromptShown,
  PERSONAL_FEATURES,
  PERSONAL_UPGRADE_PROMPT_TYPES,
} from '@/lib/personalPlanAccess';
import { resolvePersonalPlanTier } from '@/config/plans';
import {
  personalBuilderIntro,
  personalBuilderLoadingHint,
  personalBuilderLoadingMessage,
  personalNoCloudCopy,
  personalSaveNameHint,
  personalCreateSuccessToast,
  personalSaveSuccessToast,
  personalEmptyWeekDescription,
} from '@/lib/personalPlanBuilderUx';
import { EXERCISES as PICKER_EXERCISES, getExerciseById } from '@/data/exercises/exerciseLibrary';
import { atlasMigrationDataAttributes, deriveProgramBuilderRouteState } from '@/lib/atlasMigrationPhases';
import { rememberProgramBuilderExerciseDefaults } from '@/lib/programBuilderDefaults';
import { getProgramTemplateById } from '@/lib/programTemplates';
import {
  fetchWeeks,
  fetchDays,
  fetchExercises,
  fetchNextDayNumberForWeek,
} from '@/lib/programBuilderApi';
import { insertNotificationForRecipient } from '@/lib/notifications';

/** Loose UUID check — avoids toasting for junk `blockId=` query values. */
function isLikelyProgramBlockUuid(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function buildSuggestionMap(exercises, rankedResultsByQuery) {
  const map = {};
  for (const ex of exercises || []) {
    const q = String(ex.exercise_name || '').trim().toLowerCase();
    const suggestions = (rankedResultsByQuery.get(q) || []).map((row) => row.name).filter(Boolean);
    map[ex.id] = suggestions.slice(0, 12);
  }
  return map;
}

function nextSupersetLetter(exercises = []) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const used = new Set(
    (exercises || [])
      .map((ex) => String(ex?.superset_group || '').trim().toUpperCase())
      .filter(Boolean),
  );
  return letters.find((l) => !used.has(l)) || 'A';
}

function buildSetsConfigPayload(exercise) {
  const setRows = Array.isArray(exercise?.setRows)
    ? exercise.setRows
    : (Array.isArray(exercise?.sets_config) ? exercise.sets_config : null);
  if (!Array.isArray(setRows) || setRows.length === 0) return null;
  return setRows.map((row, i) => ({
    set_number: i + 1,
    weight_kg: Number(row.weight_kg) || null,
    reps: Number(row.reps) || null,
    rir: row.rir != null ? Number(row.rir) : null,
    notes: row.notes || null,
  }));
}

const ENTRY_GOAL_OPTIONS = [
  { value: 'muscle', label: 'Muscle Building' },
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'competition', label: 'Competition Prep' },
  { value: 'strength', label: 'Strength' },
];
const ENTRY_TARGET_TEMPLATE = '__template__';

function normalizeEntryGoal(goal) {
  if (goal === 'strength') return 'muscle';
  return goal;
}

export default function ProgramBuilderPage() {
  const { isDesktopWeb } = usePresentationMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  const blockIdParam = searchParams.get('blockId');
  /** Legacy PersonalMyProgram linked `/programbuilder?id=<localProgramId>`; canonical route keeps `id` in the query but the builder reads `blockId`. */
  const legacyProgramIdParam = searchParams.get('id');
  const contextSource = searchParams.get('source') || '';
  const contextReviewId = searchParams.get('review_id') || '';
  const contextNote = searchParams.get('note') || '';
  const { user, profile, supabaseUser, effectiveRole, coachFocus: rawCoachFocus } = useAuth();
  /** coach_focus from public.profiles (role=coach); drives prep-oriented labels. transformation = standard only. */
  const coachFocus = (rawCoachFocus ?? 'transformation').toString().trim().toLowerCase();
  const isPrepOriented = coachFocus === 'competition' || coachFocus === 'integrated';
  const adjustmentMode = contextSource === 'checkin' || contextSource === 'pose_check' || contextSource === 'client_detail';
  const contextBannerLabel =
    contextSource === 'checkin'
      ? 'check-in review'
      : contextSource === 'pose_check'
        ? 'pose check'
        : contextSource === 'client_detail'
          ? 'current client program'
          : '';
  const contextBannerTitle =
    contextSource === 'checkin'
      ? 'Adjusting plan after check-in review'
      : contextSource === 'pose_check'
        ? 'Adjusting prep plan after pose check'
        : contextSource === 'client_detail'
          ? 'Adjusting current client program'
          : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignClientId, setAssignClientId] = useState(clientIdParam || '');
  const [assignStartDate, setAssignStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [liveProgramContext, setLiveProgramContext] = useState(null);
  const [clientId, setClientId] = useState(clientIdParam || '');
  const [block, setBlock] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);

  const [blockName, setBlockName] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(4);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  /** Block-level coach notes (client-visible programme copy); persisted as newline-separated `program_blocks.coach_notes`. */
  const [phaseCoachNotesLines, setPhaseCoachNotesLines] = useState([]);
  const [duplicateTargetClientId, setDuplicateTargetClientId] = useState('');
  const [quickGoal, setQuickGoal] = useState('muscle');
  const [quickDaysPerWeek, setQuickDaysPerWeek] = useState(3);
  const [quickDaysPerWeekInput, setQuickDaysPerWeekInput] = useState('3');
  const [entryGoal, setEntryGoal] = useState('muscle');
  const [entryDaysPerWeek, setEntryDaysPerWeek] = useState(3);
  const [entryWeeksPreset, setEntryWeeksPreset] = useState('4');
  const [entryCustomWeeks, setEntryCustomWeeks] = useState('6');
  const [entryWhoFor, setEntryWhoFor] = useState('');
  const [weekStructureType, setWeekStructureType] = useState('full_body');
  const [rankedResultsByQuery, setRankedResultsByQuery] = useState(() => new Map());
  const [libraryByName, setLibraryByName] = useState(() => new Map());
  const [sourceBlocks, setSourceBlocks] = useState([]);
  const [sourceBlockId, setSourceBlockId] = useState('');
  const [libraryFilterMovement, setLibraryFilterMovement] = useState('');
  useEffect(() => {
    document.title = 'Program Builder — Atlas';
  }, []);
  const [libraryFilterMuscle, setLibraryFilterMuscle] = useState('');
  const [libraryFilterEquipment, setLibraryFilterEquipment] = useState('');
  const [showBuildSequence, setShowBuildSequence] = useState(false);
  const [buildStepIndex, setBuildStepIndex] = useState(0);
  const [generatedReveal, setGeneratedReveal] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLastWeekExercises, setPickerLastWeekExercises] = useState([]);
  const postBlockCreateRef = useRef(null);
  /** Latest weeks value from BlockHeader (banner / sticky save + handleSaveBlock fallback). */
  const headerEffectiveWeeksRef = useRef(4);
  /** Dedupe load-failure toasts (Strict Mode / rapid re-fetch). */
  const loadBlockFailToastRef = useRef({ key: '', at: 0 });
  const [recentExerciseNames, setRecentExerciseNames] = useState(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const raw = window.localStorage.getItem('atlas_builder_recent_exercises');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  const isCoachRole = isCoach(effectiveRole) || isAdmin(effectiveRole);
  const isPersonalRole = isPersonal(effectiveRole);
  const personalPlanTier = isPersonalRole ? resolvePersonalPlanTier(profile, user) : null;
  const personalEnhancedExperience = isPersonalRole && (personalPlanTier === 'enhanced' || personalPlanTier === 'free');
  const personalBasicExperience = isPersonalRole && !personalEnhancedExperience;
  const fromTodayContext = isPersonalRole && searchParams.get('from') === 'today';

  const dismissTodayFromBuilder = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('from');
    const qs = next.toString();
    navigate({ pathname: '/program-builder', search: qs ? `?${qs}` : '' }, { replace: true });
  }, [navigate, searchParams]);


  const canUsePersonalAutoBuilder = !isPersonalRole || canUsePersonalFeature({
    profile,
    user,
    feature: PERSONAL_FEATURES.AUTO_PROGRAM_BUILDER,
  });
  const personalUpgradeCopy = getPersonalUpgradeCopy('builder_empty');
  const personalFeatureGateCopy = getPersonalUpgradeCopy('feature_access');
  const personalBuilderEmptyCopy = getPersonalUpgradeCopy('builder_empty');
  const showPersonalBuilderEmptyHint =
    isPersonalRole
    && !canUsePersonalAutoBuilder
    && canShowPersonalUpgradePrompt(PERSONAL_UPGRADE_PROMPT_TYPES.BUILDER_EMPTY, Date.now(), profile);
  const canUseBuilder = isCoachRole || isPersonalRole;
  const supabase = hasSupabase ? getSupabase() : null;
  const isUuid = (value) =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const actorProfileId = profile?.id ?? supabaseUser?.id ?? user?.id ?? null;
  const coachId = isUuid(actorProfileId) ? actorProfileId : null;

  useEffect(() => {
    if (!isPersonalRole || blockIdParam || !legacyProgramIdParam || !supabase || !coachId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('personal_program_assignments')
        .select('program_block_id')
        .eq('profile_id', coachId)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled || error || !data?.program_block_id) return;
      const next = new URLSearchParams(searchParams);
      next.delete('id');
      next.set('personal', '1');
      next.set('blockId', data.program_block_id);
      navigate({ pathname: '/program-builder', search: `?${next.toString()}` }, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [isPersonalRole, blockIdParam, legacyProgramIdParam, supabase, coachId, navigate, searchParams]);

  const selectedWeek = weeks[selectedWeekIndex] || null;
  const selectedDay = days[selectedDayIndex] || null;
  const personalProfileIdForHistory = isPersonalRole ? coachId : null;
  const suggestionByExerciseId = useMemo(
    () => buildSuggestionMap(exercises, rankedResultsByQuery),
    [exercises, rankedResultsByQuery]
  );
  const currentDayRecentNames = useMemo(() => {
    const names = exercises
      .map((e) => String(e.exercise_name || '').trim())
      .filter(Boolean)
      .reverse();
    const merged = [...new Set([...names, ...recentExerciseNames])];
    return merged.slice(0, 8);
  }, [exercises, recentExerciseNames]);
  const coachClientIdForHistory = !isPersonalRole ? (clientId || block?.client_id || null) : null;
  const coachExerciseNamesForHistory = useMemo(
    () => Array.from(new Set(exercises.map((e) => String(e.exercise_name || '').trim()).filter(Boolean))),
    [exercises],
  );
  const {
    block: queriedBlock,
    weeks: queriedWeeks,
    days: queriedDays,
    exercises: queriedExercises,
    coachClients,
    suggestionsRows,
    builderLoading,
    blockError,
    latestCoachPerformanceByName = {},
    previousExercisePerformanceQueries,
  } = useProgramBuilderData({
    blockId: blockIdParam,
    coachId,
    isCoachMode: isCoachRole && !isPersonalRole,
    clientIdForSuggestions: clientId || block?.client_id || null,
    isPersonalRole,
    personalProfileIdForHistory,
    selectedDayId: selectedDay?.id,
    exercises,
    coachClientIdForHistory,
    coachExerciseNamesForHistory,
  });
  const previousPerformanceHintByExerciseId = useMemo(() => {
    if (!isPersonalRole || !exercises.length) return {};
    const out = {};
    for (let i = 0; i < exercises.length; i += 1) {
      const exercise = exercises[i];
      const map = previousExercisePerformanceQueries[i]?.data;
      if (!exercise?.id || !map || typeof map !== 'object') continue;
      const setNumbers = Object.keys(map)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n) && n >= 1)
        .sort((a, b) => a - b);
      for (const setNumber of setNumbers) {
        const perf = map[setNumber];
        if (!perf) continue;
        const parts = [];
        if (perf.weight_done != null) parts.push(`${perf.weight_done} kg`);
        if (perf.reps_done != null) parts.push(`${perf.reps_done} reps`);
        if (!parts.length) continue;
        out[exercise.id] = {
          weight: perf.weight_done != null ? Number(perf.weight_done) : null,
          reps: perf.reps_done != null ? Number(perf.reps_done) : null,
          date: null,
        };
        break;
      }
    }
    return out;
  }, [isPersonalRole, exercises, previousExercisePerformanceQueries]);
  const coachPreviousPerformanceByExerciseId = useMemo(() => {
    if (isPersonalRole || !exercises.length) return {};
    const out = {};
    for (const exercise of exercises) {
      const normalizedName = String(exercise.exercise_name || '').trim().toLowerCase();
      if (!normalizedName) continue;
      const perf = latestCoachPerformanceByName?.[normalizedName];
      if (!perf || perf.weight == null) continue;
      out[exercise.id] = {
        weight: perf.weight != null ? Number(perf.weight) : null,
        reps: perf.reps != null ? Number(perf.reps) : null,
        date: perf.date || null,
      };
    }
    return out;
  }, [isPersonalRole, exercises, latestCoachPerformanceByName]);
  const previousPerformanceByExerciseId = isPersonalRole
    ? previousPerformanceHintByExerciseId
    : coachPreviousPerformanceByExerciseId;
  const personalExperienceLevel = useMemo(() => {
    if (!isPersonalRole) return 'intermediate';
    try {
      const stored = localStorage.getItem('atlas_personal_experience_level_v1');
      if (stored === 'beginner' || stored === 'intermediate' || stored === 'advanced') return stored;
    } catch {
      // ignore
    }
    return 'intermediate';
  }, [isPersonalRole]);

  const pushRecentExerciseName = useCallback((name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    setRecentExerciseNames((prev) => {
      const next = [trimmed, ...prev.filter((n) => n !== trimmed)].slice(0, 20);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('atlas_builder_recent_exercises', JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const BUILD_STEPS = useMemo(
    () => ['Choosing the right split...', 'Adding exercises...', 'Setting up your weeks...'],
    []
  );

  const runBuildSequence = useCallback(async () => {
    setGeneratedReveal(null);
    setShowBuildSequence(true);
    setBuildStepIndex(0);
    const started = Date.now();
    for (let i = 0; i < BUILD_STEPS.length; i += 1) {
      setBuildStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 380));
    }
    const elapsed = Date.now() - started;
    if (elapsed < 1500) {
      await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
    }
    setShowBuildSequence(false);
  }, [BUILD_STEPS]);

  const emitLoadBlockFailureToast = useCallback((message) => {
    const key = `${blockIdParam}:${message}`;
    const now = Date.now();
    if (
      loadBlockFailToastRef.current.key === key
      && now - loadBlockFailToastRef.current.at < 2800
    ) {
      return;
    }
    loadBlockFailToastRef.current = { key, at: now };
    toast.error(message);
  }, [blockIdParam]);

  const reportHeaderEffectiveWeeks = useCallback((n) => {
    const v = Math.max(1, Math.min(52, Math.round(Number(n)) || 4));
    headerEffectiveWeeksRef.current = v;
  }, []);

  useEffect(() => {
    if (isPersonalRole) {
      setClients([]);
      if (clientIdParam) setClientId('');
      setLoading(blockIdParam ? builderLoading : false);
      return;
    }

    if (!isCoachRole) {
      setLoading(blockIdParam ? builderLoading : false);
      return;
    }

    const nextClients = Array.isArray(coachClients) ? coachClients : [];
    setClients(nextClients);
    if (clientIdParam) {
      setClientId(clientIdParam);
    } else if (!blockIdParam && !clientId && nextClients.length === 1) {
      setClientId(nextClients[0].id);
    }
    setLoading(blockIdParam ? builderLoading : false);
  }, [isCoachRole, isPersonalRole, blockIdParam, clientIdParam, clientId, builderLoading, coachClients]);

  useEffect(() => {
    if (!blockIdParam) {
      setLoading(false);
      return;
    }
    if (builderLoading) {
      setLoading(true);
      return;
    }
    if (blockError) {
      setBlock(null);
      setPhaseCoachNotesLines([]);
      setWeeks([]);
      setDays([]);
      setExercises([]);
      emitLoadBlockFailureToast(
        blockError?.message
          || (isPersonalRole
            ? 'Could not open this plan. Check your connection and try again.'
            : 'Could not load this program block. Check your connection and try again.')
      );
      setLoading(false);
      return;
    }
    if (!queriedBlock) {
      setBlock(null);
      setPhaseCoachNotesLines([]);
      setWeeks([]);
      setDays([]);
      setExercises([]);
      if (isLikelyProgramBlockUuid(blockIdParam)) {
        emitLoadBlockFailureToast(
          isPersonalRole
            ? 'This plan wasn’t found or isn’t available. Open My Program to continue.'
            : 'This program block was not found or you don’t have access. Check the link or open My Program.'
        );
      }
      setLoading(false);
      return;
    }
    if (block?.id === queriedBlock.id) {
      setLoading(false);
      return;
    }

    setBlock(queriedBlock);
    const cn = typeof queriedBlock.coach_notes === 'string' ? queriedBlock.coach_notes : '';
    setPhaseCoachNotesLines(
      cn.trim() ? cn.split('\n').map((line) => line.trim()).filter(Boolean) : [],
    );
    setClientId(queriedBlock.client_id || '');
    setBlockName(queriedBlock.title || '');
    const tw = Math.max(1, Math.min(52, Math.round(Number(queriedBlock.total_weeks)) || 4));
    setTotalWeeks(tw);
    headerEffectiveWeeksRef.current = tw;

    const nextWeeks = Array.isArray(queriedWeeks) ? queriedWeeks : [];
    setWeeks(nextWeeks);
    setSelectedWeekIndex(0);

    const firstWeekId = nextWeeks[0]?.id;
    const nextDays = firstWeekId
      ? (Array.isArray(queriedDays) ? queriedDays.filter((d) => d.week_id === firstWeekId) : [])
      : [];
    setDays(nextDays);
    setSelectedDayIndex(0);

    const firstDayId = nextDays[0]?.id;
    const nextExercises = firstDayId
      ? (Array.isArray(queriedExercises) ? queriedExercises.filter((e) => e.day_id === firstDayId) : [])
      : [];
    setExercises(nextExercises);
    setLoading(false);
  }, [
    blockIdParam,
    builderLoading,
    blockError,
    queriedBlock,
    queriedWeeks,
    queriedDays,
    queriedExercises,
    emitLoadBlockFailureToast,
    isPersonalRole,
    block?.id,
  ]);

  useEffect(() => {
    if (isPersonalRole) {
      setEntryWhoFor('myself');
      return;
    }
    if (clientIdParam) {
      setEntryWhoFor(clientIdParam);
      return;
    }
    if (clients.length === 1) {
      setEntryWhoFor(clients[0].id);
      return;
    }
    if (clients.length > 1) {
      setEntryWhoFor((prev) => {
        if (prev === ENTRY_TARGET_TEMPLATE) return prev;
        if (clients.some((c) => c.id === prev)) return prev;
        return clients[0].id;
      });
      return;
    }
    setEntryWhoFor(ENTRY_TARGET_TEMPLATE);
  }, [isPersonalRole, clientIdParam, clients]);

  useEffect(() => {
    if (clientId) setAssignClientId(clientId);
    else if (block?.client_id) setAssignClientId(block.client_id);
  }, [clientId, block?.client_id]);

  useEffect(() => {
    setWeekStructureType(suggestWeekStructureType(quickDaysPerWeek));
  }, [quickDaysPerWeek]);

  useEffect(() => {
    setQuickDaysPerWeekInput(String(quickDaysPerWeek));
  }, [quickDaysPerWeek]);

  const refreshExerciseRankings = useCallback(async () => {
    if (!coachId) return;
    await ensureAtlasExerciseLibrarySeeded();
    const filters = {
      movementPattern: libraryFilterMovement || undefined,
      primaryMuscle: libraryFilterMuscle || undefined,
      equipmentPrimary: libraryFilterEquipment || undefined,
    };
    const queries = [...new Set(
      ['', ...exercises.map((e) => String(e.exercise_name || '').trim().toLowerCase()).filter(Boolean)]
    )];
    const map = new Map();
    const byName = new Map();
    for (const q of queries) {
      const ranked = await searchAtlasExercises({ userId: coachId, query: q, limit: 20, filters });
      map.set(q, ranked);
      for (const item of ranked) {
        byName.set(String(item.name || '').toLowerCase(), item);
      }
    }
    setRankedResultsByQuery(map);
    setLibraryByName(byName);
  }, [coachId, exercises, libraryFilterMovement, libraryFilterMuscle, libraryFilterEquipment]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coachId) return;
      await refreshExerciseRankings();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, block?.id, refreshExerciseRankings]);

  useEffect(() => {
    if (!supabase || !block?.id) {
      setSourceBlocks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let query = supabase.from('program_blocks').select('id, title, client_id, owner_profile_id').neq('id', block.id).order('created_at', { ascending: false });
      if (isPersonalRole) {
        query = query.eq('owner_profile_id', coachId);
      } else {
        query = query.eq('client_id', clientId || block.client_id || '');
      }
      const { data } = await query.limit(12);
      if (!cancelled) setSourceBlocks(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, block?.id, block?.client_id, clientId, coachId, isPersonalRole]);

  const commitQuickDaysPerWeek = useCallback(() => {
    const parsed = Number(quickDaysPerWeekInput);
    const clamped = Number.isFinite(parsed) ? Math.max(2, Math.min(6, parsed)) : 3;
    setQuickDaysPerWeek(clamped);
    setQuickDaysPerWeekInput(String(clamped));
  }, [quickDaysPerWeekInput]);

  useEffect(() => {
    if (!selectedWeek || !supabase) return;
    let cancelled = false;
    fetchDays(supabase, selectedWeek.id).then((dList) => {
      if (!cancelled) setDays(dList);
    });
    return () => { cancelled = true; };
  }, [selectedWeek?.id, supabase]);

  useEffect(() => {
    if (!selectedDay || !supabase) return;
    let cancelled = false;
    fetchExercises(supabase, selectedDay.id).then((exList) => {
      if (!cancelled) setExercises(exList);
    });
    return () => { cancelled = true; };
  }, [selectedDay?.id, supabase]);

  useEffect(() => {
    if (!supabase || !block?.id || isPersonalRole) {
      setLiveProgramContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: assignment } = await supabase
        .from('program_block_assignments')
        .select('id, client_id, is_active')
        .eq('program_block_id', block.id)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!assignment?.client_id || cancelled) {
        if (!cancelled) setLiveProgramContext(null);
        return;
      }
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, name, user_id')
        .eq('id', assignment.client_id)
        .maybeSingle();
      if (cancelled) return;
      setLiveProgramContext(clientRow ? {
        clientId: clientRow.id,
        clientName: clientRow.name || 'Client',
        recipientProfileId: clientRow.user_id || null,
      } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, block?.id, isPersonalRole]);

  const coachSuggestions = useMemo(() => {
    if (!block?.id || (!clientId && !block?.client_id) || exercises.length === 0) return [];
    const rows = Array.isArray(suggestionsRows) ? suggestionsRows : [];
    if (!rows.length) return [];
    let up = 0;
    let down = 0;
    let flat = 0;
    for (const row of rows) {
      const n = Number(row?.trend);
      if (Number.isFinite(n)) {
        if (n > 0.5) up += 1;
        else if (n < -0.5) down += 1;
        else flat += 1;
        continue;
      }
      const s = String(row?.trend || '').toLowerCase();
      if (s.includes('up') || s.includes('improv')) up += 1;
      else if (s.includes('down') || s.includes('declin') || s.includes('regress')) down += 1;
      else if (s) flat += 1;
    }
    const suggestions = [];
    if (up > 0) suggestions.push('Increase load on progressing lifts for this block.');
    if (down > 0) suggestions.push('Reduce sets or volume on lifts that are regressing.');
    if (down >= 2 || flat >= 3) suggestions.push('Add a deload week or lighter microcycle to restore momentum.');
    return suggestions;
  }, [block?.id, clientId, block?.client_id, exercises.length, suggestionsRows]);

  const trackUsageFromCurrentWeek = useCallback(async () => {
    if (!coachId || !Array.isArray(exercises) || exercises.length === 0) return;
    await trackUsageBatch({
      userId: coachId,
      rows: exercises
        .map((ex) => {
          const name = String(ex.exercise_name || '').trim();
          const lib = libraryByName.get(name.toLowerCase());
          return {
            exerciseId: lib?.id || ex.exercise_library_id || null,
            sets: ex.sets ?? null,
            reps: ex.reps ?? null,
            restSeconds: ex.rest_seconds ?? null,
          };
        })
        .filter((row) => !!row.exerciseId),
    });
    await refreshExerciseRankings();
  }, [coachId, exercises, libraryByName, refreshExerciseRankings]);

  const handleSaveBlock = async (saveOpts = {}) => {
    if (!supabase) {
      toast.error('You are not connected. Check your connection and try again.');
      return;
    }
    if (!coachId) {
      toast.error('Sign in to create or save your program.');
      return;
    }
    const fromOpts =
      saveOpts && typeof saveOpts.totalWeeks === 'number' && Number.isFinite(saveOpts.totalWeeks);
    const effectiveWeeks = fromOpts
      ? Math.max(1, Math.min(52, Math.round(saveOpts.totalWeeks)))
      : Math.max(1, Math.min(52, Math.round(Number(headerEffectiveWeeksRef.current)) || 4));
    if (!blockName.trim()) {
      toast.error(isPersonalRole ? 'Enter a plan name' : 'Enter a program name');
      return;
    }
    if (!isPersonalRole) {
      if (!clientId && !block?.client_id) {
        toast.error('Select a client');
        return;
      }
    }
    const cId = clientId || block?.client_id;
    if (!isPersonalRole && !cId) {
      toast.error('Select a client before creating a block.');
      return;
    }
    const prevSelectedWeekNumber = weeks[selectedWeekIndex]?.week_number ?? null;
    setSaving(true);
    try {
      if (block?.id) {
        const coachNotesPayload = !isPersonalRole
          ? (phaseCoachNotesLines.length > 0 ? phaseCoachNotesLines.join('\n') : null)
          : null;
        const { error } = await supabase
          .from('program_blocks')
          .update({
            title: blockName.trim(),
            total_weeks: effectiveWeeks,
            ...(isPersonalRole ? {} : { coach_notes: coachNotesPayload }),
          })
          .eq('id', block.id);
        if (error) throw error;
        setTotalWeeks(effectiveWeeks);
        const { error: ensureErr } = await ensureProgramWeekRowsForBlock(supabase, block.id, effectiveWeeks);
        if (ensureErr && import.meta.env.DEV) {
          if (import.meta.env.DEV) {
            console.warn('[ProgramBuilder] ensure weeks on save', ensureErr?.message || ensureErr);
          }
        }
        const wListAfter = await fetchWeeks(supabase, block.id);
        setWeeks(wListAfter);
        if (prevSelectedWeekNumber != null) {
          const idx = wListAfter.findIndex((w) => Number(w.week_number) === Number(prevSelectedWeekNumber));
          if (idx >= 0) setSelectedWeekIndex(idx);
        } else if (selectedWeekIndex >= wListAfter.length) {
          setSelectedWeekIndex(Math.max(0, wListAfter.length - 1));
        }
        let personalActiveOk = true;
        if (isPersonalRole && coachId) {
          try {
            await activatePersonalProgramAssignment(supabase, coachId, block.id);
          } catch (assignErr) {
            personalActiveOk = false;
            if (import.meta.env.DEV) console.warn('[ProgramBuilder] activatePersonalProgramAssignment', assignErr);
          }
        }
        toast.success(
          isPersonalRole
            ? personalSaveSuccessToast({ assignmentSyncOk: !(coachId && !personalActiveOk) })
            : 'Saved',
        );
        if (ensureErr) toast.warning('Save again for week tabs');
        await trackUsageFromCurrentWeek();
        queryClient.invalidateQueries({ queryKey: ['personal-my-program-supabase'] });
        queryClient.invalidateQueries({ queryKey: ['personal-home-assigned-today'] });
      } else if (isPersonalRole) {
        const { data: inserted, error } = await supabase
          .from('program_blocks')
          .insert({
            owner_profile_id: coachId,
            coach_id: coachId,
            title: blockName.trim(),
            total_weeks: effectiveWeeks,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        setTotalWeeks(effectiveWeeks);
        setBlock({
          id: inserted.id,
          client_id: null,
          owner_profile_id: coachId,
          title: blockName.trim(),
          total_weeks: effectiveWeeks,
        });
        setClientId('');
        const { error: weekErr } = await ensureProgramWeekRowsForBlock(supabase, inserted.id, effectiveWeeks);
        if (weekErr) throw weekErr;
        await activatePersonalProgramAssignment(supabase, coachId, inserted.id);
        const wList = await fetchWeeks(supabase, inserted.id);
        setWeeks(wList);
        setSelectedWeekIndex(0);
        if (wList.length > 0) {
          const dList = await fetchDays(supabase, wList[0].id);
          setDays(dList);
          setSelectedDayIndex(0);
          if (dList.length > 0) {
            const exList = await fetchExercises(supabase, dList[0].id);
            setExercises(exList);
          } else {
            setExercises([]);
          }
        } else {
          setDays([]);
          setExercises([]);
        }
        toast.success(personalCreateSuccessToast());
        await trackUsageFromCurrentWeek();
        queryClient.invalidateQueries({ queryKey: ['personal-my-program-supabase'] });
        queryClient.invalidateQueries({ queryKey: ['personal-home-assigned-today'] });
        navigate(`/program-builder?personal=1&blockId=${encodeURIComponent(inserted.id)}`, { replace: true });
        window.setTimeout(() => {
          postBlockCreateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      } else {
        const { data: inserted, error } = await supabase
          .from('program_blocks')
          .insert({
            client_id: cId,
            coach_id: coachId,
            title: blockName.trim(),
            total_weeks: effectiveWeeks,
            coach_notes: phaseCoachNotesLines.length > 0 ? phaseCoachNotesLines.join('\n') : null,
          })
          .select('id')
          .single();
        if (error) throw error;
        setTotalWeeks(effectiveWeeks);
        setBlock({
          id: inserted.id,
          client_id: cId,
          title: blockName.trim(),
          total_weeks: effectiveWeeks,
          coach_notes: phaseCoachNotesLines.length > 0 ? phaseCoachNotesLines.join('\n') : null,
        });
        const { error: weekErr } = await ensureProgramWeekRowsForBlock(supabase, inserted.id, effectiveWeeks);
        if (weekErr) throw weekErr;
        const wList = await fetchWeeks(supabase, inserted.id);
        setWeeks(wList);
        setSelectedWeekIndex(0);
        if (wList.length > 0) {
          const dList = await fetchDays(supabase, wList[0].id);
          setDays(dList);
          setSelectedDayIndex(0);
          if (dList.length > 0) {
            const exList = await fetchExercises(supabase, dList[0].id);
            setExercises(exList);
          } else {
            setExercises([]);
          }
        } else {
          setDays([]);
          setExercises([]);
        }
        toast.success('Block created');
        await trackUsageFromCurrentWeek();
        if (coachId) trackFirstProgramCreated(coachId, { client_id: cId, block_id: inserted.id });
        navigate(`/program-builder?clientId=${encodeURIComponent(cId)}&blockId=${encodeURIComponent(inserted.id)}`, { replace: true });
        window.setTimeout(() => {
          postBlockCreateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectWeek = (weekIndex) => {
    setSelectedWeekIndex(weekIndex);
    setSelectedDayIndex(0);
    setDays([]);
    setExercises([]);
  };

  const handleAddDay = async () => {
    if (!supabase || !selectedWeek) return;
    setSaving(true);
    try {
      const nextNum = await fetchNextDayNumberForWeek(supabase, selectedWeek.id);
      if (nextNum > 7) {
        toast.error('Max 7 days per week');
        return;
      }
      const { data: inserted, error } = await supabase
        .from('program_days')
        .insert({ week_id: selectedWeek.id, day_number: nextNum, title: `Day ${nextNum}` })
        .select('*')
        .single();
      if (error) throw error;
      const dList = await fetchDays(supabase, selectedWeek.id);
      setDays(dList);
      const idx = dList.findIndex((d) => d.id === inserted.id);
      setSelectedDayIndex(idx >= 0 ? idx : dList.length - 1);
      toast.success('Day added');
    } catch (e) {
      toast.error(e?.message || 'Failed to add day');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExercise = async (prefill = {}, options = {}) => {
    if (!supabase || !selectedDay) return;
    const silent = options?.silent === true;
    setSaving(true);
    try {
      const nextOrder = exercises.length;
      const previous = exercises.length > 0 ? exercises[exercises.length - 1] : null;
      const previousRest = previous?.rest_seconds != null ? Number(previous.rest_seconds) : 90;
      const previousSets = previous?.sets != null ? Number(previous.sets) : 3;
      const previousReps = previous?.reps != null ? Number(previous.reps) : 10;
      const exerciseName = String(prefill.exercise_name || '').trim() || 'New exercise';
      const matchedLibraryExercise = libraryByName.get(exerciseName.toLowerCase()) || null;
      const usage = matchedLibraryExercise?.usage || null;
      const usageSets = toPositiveInt(usage?.last_sets, null);
      const usageReps = usage?.last_reps != null ? String(usage.last_reps) : null;
      const usageRest = toPositiveInt(usage?.last_rest_seconds, null);
      const { data: inserted, error } = await supabase
        .from('program_exercises')
        .insert({
          day_id: selectedDay.id,
          exercise_library_id: matchedLibraryExercise?.id || null,
          exercise_name: exerciseName,
          sets: prefill.sets != null ? Number(prefill.sets) : (usageSets ?? previousSets),
          reps: prefill.reps != null ? String(prefill.reps) : (usageReps ?? previousReps),
          rest_seconds: prefill.rest_seconds != null ? Number(prefill.rest_seconds) : (usageRest ?? previousRest),
          weight_kg: prefill.weight_kg != null ? Number(prefill.weight_kg) : null,
          rir: prefill.rir != null ? Number(prefill.rir) : null,
          sets_config: buildSetsConfigPayload(prefill),
          tempo: prefill.tempo || null,
          superset_group: prefill.superset_group || null,
          is_warmup_parent: Boolean(prefill.is_warmup_parent),
          percentage: prefill.percentage != null ? Number(prefill.percentage) : (previous?.percentage ?? null),
          notes: prefill.notes ?? null,
          sort_order: nextOrder,
        })
        .select('*')
        .single();
      if (error) throw error;
      setExercises((ex) => [...ex, inserted]);
      rememberProgramBuilderExerciseDefaults({ sets: inserted?.sets, reps: inserted?.reps });
      pushRecentExerciseName(exerciseName);
      await trackExerciseUsage({
        userId: coachId,
        exerciseId: matchedLibraryExercise?.id || inserted?.exercise_library_id || null,
        sets: inserted?.sets ?? null,
        reps: inserted?.reps ?? null,
        restSeconds: inserted?.rest_seconds ?? null,
      });
      await refreshExerciseRankings();
      if (!silent) toast.success('Exercise added');
      return inserted;
    } catch (e) {
      toast.error(e?.message || 'Failed to add exercise');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openExercisePicker = useCallback(() => {
    if (!selectedDay) {
      toast.error('Select a day first');
      return;
    }
    setPickerOpen(true);
  }, [selectedDay]);

  useEffect(() => {
    let cancelled = false;
    const loadLastWeek = async () => {
      if (!pickerOpen || !personalEnhancedExperience || !selectedWeek || !selectedDay || Number(selectedWeek.week_number) <= 1) {
        if (!cancelled) setPickerLastWeekExercises([]);
        return;
      }
      try {
        const prevWeek = weeks.find((w) => Number(w.week_number) === Number(selectedWeek.week_number) - 1);
        if (!prevWeek?.id) {
          if (!cancelled) setPickerLastWeekExercises([]);
          return;
        }
        const prevDays = await fetchDays(supabase, prevWeek.id);
        const prevDay = prevDays.find((d) => Number(d.day_number) === Number(selectedDay.day_number)) || prevDays[selectedDayIndex] || null;
        if (!prevDay?.id) {
          if (!cancelled) setPickerLastWeekExercises([]);
          return;
        }
        const prevExercises = await fetchExercises(supabase, prevDay.id);
        const mapped = prevExercises
          .map((ex) => {
            const name = String(ex?.exercise_name || '').trim();
            if (!name) return null;
            const found = PICKER_EXERCISES.find((p) => String(p?.name || '').toLowerCase() === name.toLowerCase());
            return found || { id: `prev-${name.toLowerCase().replace(/\s+/g, '-')}`, name, primaryMuscle: '', equipment: [] };
          })
          .filter(Boolean)
          .slice(0, 10);
        if (!cancelled) setPickerLastWeekExercises(mapped);
      } catch {
        if (!cancelled) setPickerLastWeekExercises([]);
      }
    };
    loadLastWeek();
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, personalEnhancedExperience, selectedWeek, selectedDay, selectedDayIndex, weeks, supabase]);

  const pickerSuggestedExercises = useMemo(() => {
    if (!personalEnhancedExperience) return [];
    const names = exercises.map((ex) => String(ex.exercise_name || '').toLowerCase());
    const hasPush = names.some((n) => /press|push/.test(n));
    const hasPull = names.some((n) => /row|pull|pulldown|chin-up|pull-up/.test(n));
    const hasQuad = names.some((n) => /squat|lunge|leg press|quad/.test(n));
    const hasHam = names.some((n) => /rdl|hamstring|leg curl|hinge/.test(n));
    const hasArms = names.some((n) => /curl|tricep|pushdown|extension/.test(n));
    const out = [];
    if (hasPush && !hasPull) out.push('Cable Row');
    if (hasQuad && !hasHam) out.push('Leg Curl');
    if (!hasArms) out.push('Hammer Curl', 'Tricep Pushdown');
    return out
      .map((name) => PICKER_EXERCISES.find((e) => e.name === name))
      .filter(Boolean)
      .slice(0, 8);
  }, [personalEnhancedExperience, exercises]);

  const handlePickerSelect = useCallback(async (exercise) => {
    if (!exercise) return;
    const inserted = await handleAddExercise({ exercise_name: exercise.name || 'New exercise' }, { silent: true });
    setPickerOpen(false);
    if (inserted?.id && typeof document !== 'undefined') {
      window.setTimeout(() => {
        const el = document.querySelector(`[data-exercise-row-id="${inserted.id}"]`);
        if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  }, [handleAddExercise]);

  const handleAddExerciseRef = useRef(handleAddExercise);
  handleAddExerciseRef.current = handleAddExercise;

  useEffect(() => {
    const sid = searchParams.get('suggestedExercise');
    if (!sid || loading || !selectedDay?.id || !block?.id) return;

    const marker = `${block.id}:${selectedDay.id}:${sid}`;
    const doneKey = `atlas_pb_suggested_done_v1:${marker}`;
    const pendingKey = `atlas_pb_suggested_pending_v1:${marker}`;

    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(doneKey)) {
        if (searchParams.has('suggestedExercise')) {
          const next = new URLSearchParams(searchParams);
          next.delete('suggestedExercise');
          const qs = next.toString();
          navigate({ pathname: '/program-builder', search: qs ? `?${qs}` : '' }, { replace: true });
        }
        return;
      }
      if (sessionStorage.getItem(pendingKey)) return;
      sessionStorage.setItem(pendingKey, '1');
    }

    const ex = getExerciseById(sid);
    const stripSuggestedFromUrl = () => {
      if (!searchParams.has('suggestedExercise')) return;
      const next = new URLSearchParams(searchParams);
      next.delete('suggestedExercise');
      const qs = next.toString();
      navigate({ pathname: '/program-builder', search: qs ? `?${qs}` : '' }, { replace: true });
    };

    if (!ex) {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(pendingKey);
      toast.error('Exercise not found in library');
      stripSuggestedFromUrl();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const inserted = await handleAddExerciseRef.current({ exercise_name: ex.name });
        if (cancelled) {
          if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(pendingKey);
          return;
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(pendingKey);
          if (inserted) sessionStorage.setItem(doneKey, '1');
        }
        stripSuggestedFromUrl();
        if (inserted?.id && typeof document !== 'undefined') {
          window.setTimeout(() => {
            const el = document.querySelector(`[data-exercise-row-id="${inserted.id}"]`);
            if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 80);
        }
      } catch {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(pendingKey);
      }
    })();

    return () => {
      cancelled = true;
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(pendingKey);
    };
  }, [loading, block?.id, selectedDay?.id, searchParams, navigate]);

  const handleUpdateExercise = async (exerciseId, updates) => {
    if (!supabase || !exerciseId) return;
    const nextUpdates = { ...updates };
    if (typeof nextUpdates.exercise_name === 'string') {
      const matched = libraryByName.get(String(nextUpdates.exercise_name || '').trim().toLowerCase());
      nextUpdates.exercise_library_id = matched?.id || null;
    }
    if (liveProgramContext?.clientId) {
      nextUpdates.coach_updated_at = new Date().toISOString();
    }
    const currentExercise = exercises.find((e) => e.id === exerciseId);
    const { error } = await supabase.from('program_exercises').update(nextUpdates).eq('id', exerciseId);
    if (error) toast.error('Update failed');
    else {
      if (typeof updates.exercise_name === 'string') pushRecentExerciseName(updates.exercise_name);
      setExercises((ex) => ex.map((e) => (e.id === exerciseId ? { ...e, ...nextUpdates } : e)));
      if (liveProgramContext?.recipientProfileId) {
        const exerciseName = String(nextUpdates.exercise_name || currentExercise?.exercise_name || 'an exercise');
        const diffParts = [];
        if (updates.exercise_name && currentExercise?.exercise_name && updates.exercise_name !== currentExercise.exercise_name) {
          diffParts.push(`renamed to ${updates.exercise_name}`);
        }
        const numericFields = [
          { key: 'sets', label: 'sets', fmt: (v) => String(v) },
          { key: 'weight_kg', label: 'weight', fmt: (v) => `${v}kg` },
          { key: 'rest_seconds', label: 'rest', fmt: (v) => `${v}s` },
        ];
        for (const { key, label, fmt } of numericFields) {
          if (key in updates && currentExercise) {
            const before = currentExercise[key];
            const after = updates[key];
            if (after != null && String(before) !== String(after)) {
              diffParts.push(`${label}: ${before != null ? fmt(before) : '–'}→${fmt(after)}`);
            }
          }
        }
        if ('reps' in updates && currentExercise) {
          const before = currentExercise.reps;
          const after = updates.reps;
          if (after != null && String(before) !== String(after)) {
            diffParts.push(`reps: ${before ?? '–'}→${after}`);
          }
        }
        if ('tempo' in updates && currentExercise) {
          const before = currentExercise.tempo;
          const after = updates.tempo;
          if (after && String(before) !== String(after)) {
            diffParts.push(`tempo: ${before ?? '–'}→${after}`);
          }
        }
        const diffText = diffParts.length > 0 ? ` (${diffParts.join(', ')})` : '';
        await insertNotificationForRecipient(
          liveProgramContext.recipientProfileId,
          'program_update',
          'Your programme has been updated',
          `${profile?.full_name || 'Your coach'} updated ${exerciseName}${diffText}`,
          { action_url: '/today', subtype: 'programme_updated', coach_update_note: nextUpdates.coach_update_note || null },
          block?.id || null,
          { dedupeKey: `programme_updated:${block?.id || 'block'}:${exerciseId}` },
        );
      }
    }
  };

  useEffect(() => {
    const focusExerciseId = searchParams.get('focusExercise');
    const prefillWeightRaw = searchParams.get('prefillWeightKg');
    const prefillWeight = Number(prefillWeightRaw);
    if (!focusExerciseId || loading || !block?.id) return;

    const marker = `${block.id}:${focusExerciseId}:${prefillWeightRaw || 'none'}`;
    const doneKey = `atlas_pb_review_adjust_done_v1:${marker}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(doneKey)) return;

    const target = exercises.find((row) => String(row?.id) === String(focusExerciseId));
    if (!target) return;

    let cancelled = false;
    void (async () => {
      if (Number.isFinite(prefillWeight) && prefillWeight > 0) {
        const current = Number(target.weight_kg);
        if (!Number.isFinite(current) || Math.abs(current - prefillWeight) > 0.001) {
          await handleUpdateExercise(focusExerciseId, {
            weight_kg: prefillWeight,
            coach_update_note: 'Updated from workout review suggestion',
          });
        }
      }

      if (cancelled) return;
      if (typeof document !== 'undefined') {
        window.setTimeout(() => {
          const el = document.querySelector(`[data-exercise-row-id="${focusExerciseId}"]`);
          if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(doneKey, '1');
      if (searchParams.has('focusExercise') || searchParams.has('prefillWeightKg')) {
        const next = new URLSearchParams(searchParams);
        next.delete('focusExercise');
        next.delete('prefillWeightKg');
        const qs = next.toString();
        navigate({ pathname: '/program-builder', search: qs ? `?${qs}` : '' }, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, loading, block?.id, exercises, handleUpdateExercise, navigate]);

  const handleCopyPreviousRowSetup = async (exerciseId) => {
    const idx = exercises.findIndex((e) => e.id === exerciseId);
    if (idx <= 0) return;
    const prev = exercises[idx - 1];
    if (!prev) return;
    await handleUpdateExercise(exerciseId, {
      sets: prev.sets ?? null,
      reps: prev.reps ?? null,
      rest_seconds: prev.rest_seconds ?? null,
      percentage: prev.percentage ?? null,
    });
    toast.success('Copied previous row values');
  };

  const handleLinkSuperset = async (exerciseId, partnerExerciseId) => {
    if (!supabase || !exerciseId || !partnerExerciseId || exerciseId === partnerExerciseId) return;
    const exercise = exercises.find((e) => e.id === exerciseId);
    const partner = exercises.find((e) => e.id === partnerExerciseId);
    if (!exercise || !partner) return;
    const chosenLetter =
      String(exercise.superset_group || '').trim().toUpperCase()
      || String(partner.superset_group || '').trim().toUpperCase()
      || nextSupersetLetter(exercises);
    const payload = { superset_group: chosenLetter };
    const { error } = await supabase.from('program_exercises').update(payload).in('id', [exerciseId, partnerExerciseId]);
    if (error) {
      toast.error('Could not link superset');
      return;
    }
    setExercises((prev) =>
      prev.map((row) => (row.id === exerciseId || row.id === partnerExerciseId ? { ...row, superset_group: chosenLetter } : row)),
    );
    toast.success(`Superset ${chosenLetter} linked`);
  };

  const handleRemoveSuperset = async (exerciseId) => {
    if (!supabase || !exerciseId) return;
    const exercise = exercises.find((e) => e.id === exerciseId);
    const group = String(exercise?.superset_group || '').trim();
    if (!group) return;
    const peerIds = exercises.filter((e) => String(e.superset_group || '').trim() === group).map((e) => e.id);
    const { error } = await supabase.from('program_exercises').update({ superset_group: null }).in('id', peerIds);
    if (error) {
      toast.error('Could not remove superset');
      return;
    }
    setExercises((prev) => prev.map((row) => (peerIds.includes(row.id) ? { ...row, superset_group: null } : row)));
    toast.success('Removed from superset');
  };

  const handleRemoveExercise = async (exerciseId) => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('program_exercises').delete().eq('id', exerciseId);
      if (error) throw error;
      setExercises((ex) => ex.filter((e) => e.id !== exerciseId));
      toast.success('Removed');
    } catch (e) {
      toast.error(e?.message || 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveExercise = async (index, direction) => {
    if (!supabase || index === undefined || exercises.length === 0) return;
    const next = index + direction;
    if (next < 0 || next >= exercises.length) return;
    const reordered = [...exercises];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(next, 0, removed);
    setSaving(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('program_exercises').update({ sort_order: i }).eq('id', reordered[i].id);
      }
      setExercises(reordered.map((e, i) => ({ ...e, sort_order: i })));
    } catch (e) {
      toast.error('Reorder failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateExercise = async (exercise, index) => {
    if (!supabase || !selectedDay || index == null) return;
    setSaving(true);
    try {
      const insertOrder = index + 1;
      const { error: insertErr } = await supabase.from('program_exercises').insert({
        day_id: selectedDay.id,
        exercise_name: exercise.exercise_name || 'New exercise',
        sets: exercise.sets ?? 3,
        reps: exercise.reps ?? 10,
        rest_seconds: exercise.rest_seconds ?? 90,
        weight_kg: exercise.weight_kg ?? null,
        rir: exercise.rir ?? null,
        sets_config: buildSetsConfigPayload(exercise),
        tempo: exercise.tempo ?? null,
        superset_group: exercise.superset_group ?? null,
        is_warmup_parent: Boolean(exercise.is_warmup_parent),
        percentage: exercise.percentage ?? null,
        notes: exercise.notes ?? null,
        sort_order: insertOrder,
      });
      if (insertErr) throw insertErr;
      for (let i = insertOrder; i < exercises.length; i++) {
        await supabase.from('program_exercises').update({ sort_order: i + 1 }).eq('id', exercises[i].id);
      }
      const exList = await fetchExercises(supabase, selectedDay.id);
      setExercises(exList);
      toast.success('Exercise duplicated');
    } catch (e) {
      toast.error(e?.message || 'Duplicate failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSmartSwapExercise = useCallback(async (exercise) => {
    if (!exercise?.id) return;
    const current = String(exercise.exercise_name || '').trim().toLowerCase();
    const ranked = Array.from(libraryByName.values());
    const candidate = ranked.find((row) => {
      const name = String(row?.name || '').trim().toLowerCase();
      return name && name !== current;
    });
    if (!candidate) {
      toast.message('No smart swap available yet');
      return;
    }
    await handleUpdateExercise(exercise.id, {
      exercise_name: candidate.name,
      exercise_library_id: candidate.id || null,
    });
    toast.success('Exercise swapped');
  }, [libraryByName]);

  const handleDuplicateDay = async () => {
    if (!supabase || !selectedWeek || !selectedDay) return;
    setSaving(true);
    try {
      const nextDayNum = await fetchNextDayNumberForWeek(supabase, selectedWeek.id);
      if (nextDayNum > 7) {
        toast.error('Max 7 days per week');
        return;
      }
      const { data: newDay, error: dayErr } = await supabase
        .from('program_days')
        .insert({
          week_id: selectedWeek.id,
          day_number: nextDayNum,
          title: `Copy of ${selectedDay.title || `Day ${selectedDay.day_number}`}`,
        })
        .select('*')
        .single();
      if (dayErr) throw dayErr;
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        await supabase.from('program_exercises').insert({
          day_id: newDay.id,
          exercise_name: ex.exercise_name || 'New exercise',
          sets: ex.sets ?? 3,
          reps: ex.reps ?? 10,
          rest_seconds: ex.rest_seconds ?? 90,
          weight_kg: ex.weight_kg ?? null,
          rir: ex.rir ?? null,
          sets_config: buildSetsConfigPayload(ex),
          tempo: ex.tempo ?? null,
          superset_group: ex.superset_group ?? null,
          is_warmup_parent: Boolean(ex.is_warmup_parent),
          percentage: ex.percentage ?? null,
          notes: ex.notes ?? null,
          sort_order: i,
        });
      }
      const dList = await fetchDays(supabase, selectedWeek.id);
      setDays(dList);
      setSelectedDayIndex(dList.length - 1);
      setExercises(
        (await fetchExercises(supabase, newDay.id)).map((e, i) => ({ ...e, sort_order: i }))
      );
      toast.success('Day duplicated');
    } catch (e) {
      toast.error(e?.message || 'Duplicate day failed');
    } finally {
      setSaving(false);
    }
  };

  const copyWeekBetweenBlocks = async ({ sourceBlockId, sourceWeekNumber, targetWeekNumber }) => {
    if (!supabase || !block?.id || !sourceBlockId) return false;
    const { data: sourceWeeks } = await supabase
      .from('program_weeks')
      .select('id, week_number')
      .eq('block_id', sourceBlockId)
      .eq('week_number', sourceWeekNumber)
      .limit(1);
    const sourceWeek = sourceWeeks?.[0];
    if (!sourceWeek) {
      toast.error(`Source week ${sourceWeekNumber} not found`);
      return false;
    }
    let targetWeek = weeks.find((w) => w.week_number === targetWeekNumber);
    if (!targetWeek) {
      const { data: inserted, error: weekErr } = await supabase
        .from('program_weeks')
        .insert({ block_id: block.id, week_number: targetWeekNumber })
        .select('*')
        .single();
      if (weekErr) throw weekErr;
      targetWeek = inserted;
      setWeeks((w) => [...w, inserted].sort((a, b) => a.week_number - b.week_number));
    }

    const existingTargetDays = await fetchDays(supabase, targetWeek.id);
    for (const day of existingTargetDays) {
      await supabase.from('program_exercises').delete().eq('day_id', day.id);
    }
    if (existingTargetDays.length > 0) {
      await supabase.from('program_days').delete().eq('week_id', targetWeek.id);
    }

    const sourceDays = await fetchDays(supabase, sourceWeek.id);
    for (const sourceDay of sourceDays) {
      const sourceExercises = await fetchExercises(supabase, sourceDay.id);
      const { data: createdDay, error: dayErr } = await supabase
        .from('program_days')
        .insert({
          week_id: targetWeek.id,
          day_number: sourceDay.day_number,
          title: sourceDay.title || `Day ${sourceDay.day_number}`,
        })
        .select('*')
        .single();
      if (dayErr) throw dayErr;
      for (let i = 0; i < sourceExercises.length; i++) {
        const ex = sourceExercises[i];
        await supabase.from('program_exercises').insert({
          day_id: createdDay.id,
          exercise_name: ex.exercise_name || 'New exercise',
          sets: ex.sets ?? 3,
          reps: ex.reps ?? 10,
          rest_seconds: ex.rest_seconds ?? 90,
          weight_kg: ex.weight_kg ?? null,
          rir: ex.rir ?? null,
          sets_config: buildSetsConfigPayload(ex),
          tempo: ex.tempo ?? null,
          superset_group: ex.superset_group ?? null,
          is_warmup_parent: Boolean(ex.is_warmup_parent),
          percentage: ex.percentage ?? null,
          notes: ex.notes ?? null,
          sort_order: i,
        });
      }
    }
    return true;
  };

  const handleCopyWeek1ToWeek = async (targetWeekNumber) => {
    if (!block?.id || targetWeekNumber < 2 || targetWeekNumber > totalWeeks) return;
    setSaving(true);
    try {
      const ok = await copyWeekBetweenBlocks({
        sourceBlockId: block.id,
        sourceWeekNumber: 1,
        targetWeekNumber,
      });
      if (ok) toast.success(`Week 1 copied to Week ${targetWeekNumber}`);
    } catch (e) {
      toast.error(e?.message || 'Copy week failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPreviousWeek = async () => {
    if (!selectedWeek?.week_number || selectedWeek.week_number <= 1) return;
    setSaving(true);
    try {
      const ok = await copyWeekBetweenBlocks({
        sourceBlockId: block.id,
        sourceWeekNumber: selectedWeek.week_number - 1,
        targetWeekNumber: selectedWeek.week_number,
      });
      if (ok) toast.success(`Week ${selectedWeek.week_number - 1} copied to Week ${selectedWeek.week_number}`);
    } catch (e) {
      toast.error(e?.message || 'Copy previous week failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWeekToEnd = async () => {
    if (!selectedWeek?.week_number || !block?.id) return;
    const sourceWeekNumber = Number(selectedWeek.week_number);
    if (!Number.isFinite(sourceWeekNumber) || sourceWeekNumber < 1) return;
    setSaving(true);
    try {
      const nextWeekNumber = Math.max(
        1,
        ...weeks.map((w) => Number(w.week_number)).filter((n) => Number.isFinite(n) && n >= 1),
      ) + 1;
      const ok = await copyWeekBetweenBlocks({
        sourceBlockId: block.id,
        sourceWeekNumber,
        targetWeekNumber: nextWeekNumber,
      });
      if (!ok) return;
      setTotalWeeks((prev) => Math.max(Number(prev) || 1, nextWeekNumber));
      headerEffectiveWeeksRef.current = Math.max(Number(headerEffectiveWeeksRef.current) || 1, nextWeekNumber);
      toast.success(`Week ${sourceWeekNumber} copied to Week ${nextWeekNumber}`);
    } catch (e) {
      toast.error(e?.message || 'Copy week failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromSourceBlock = async () => {
    if (!selectedWeek?.week_number || !sourceBlockId) {
      toast.error('Select a source block first');
      return;
    }
    setSaving(true);
    try {
      const ok = await copyWeekBetweenBlocks({
        sourceBlockId,
        sourceWeekNumber: selectedWeek.week_number,
        targetWeekNumber: selectedWeek.week_number,
      });
      if (ok) toast.success('Copied matching week from source block');
    } catch (e) {
      toast.error(e?.message || 'Copy from source block failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateBlockToClient = async () => {
    if (!block?.id || !duplicateTargetClientId) {
      toast.error('Select a target client');
      return;
    }
    setSaving(true);
    try {
      const { blockId } = await duplicateBlockToClient(block.id, duplicateTargetClientId, { titlePrefix: 'Copy' });
      toast.success('Block duplicated');
      navigate(`/program-builder?clientId=${encodeURIComponent(duplicateTargetClientId)}&blockId=${encodeURIComponent(blockId)}`);
    } catch (e) {
      toast.error(e?.message || 'Could not duplicate block');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignNow = async () => {
    if (!supabase || !block?.id) {
      toast.error('Save the block first');
      return;
    }
    if (!assignClientId) {
      toast.error('Select a client');
      return;
    }
    setSaving(true);
    try {
      await handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current });
      const { error: deactivateErr } = await supabase
        .from('program_block_assignments')
        .update({ is_active: false })
        .eq('client_id', assignClientId);
      if (deactivateErr) throw deactivateErr;
      const { error: insertErr } = await supabase
        .from('program_block_assignments')
        .insert({
          client_id: assignClientId,
          program_block_id: block.id,
          start_date: assignStartDate,
          is_active: true,
        });
      if (insertErr) throw insertErr;
      const client = clients.find((c) => c.id === assignClientId);
      if (client?.user_id) {
        await insertNotificationForRecipient(
          client.user_id,
          'program_update',
          'New training programme assigned',
          `${blockName || 'Your programme'} starts ${assignStartDate}. Open Atlas to see your workouts.`,
          { action_url: '/today', subtype: 'programme_assigned', program_block_id: block.id },
          block.id,
          { dedupeKey: `programme_assigned:${block.id}:${assignClientId}` },
        );
      }
      toast.success(`${client?.name || 'Client'}'s programme is live. They've been notified.`);
      setAssignSheetOpen(false);
      setLiveProgramContext({
        clientId: assignClientId,
        clientName: client?.name || 'Client',
        recipientProfileId: client?.user_id || null,
      });
    } catch (e) {
      toast.error(e?.message || 'Could not assign programme');
    } finally {
      setSaving(false);
    }
  };

  const persistGeneratedWeek = useCallback(async (generated, targetWeekId = null) => {
    const weekId = targetWeekId || selectedWeek?.id;
    if (!supabase || !weekId) return;
    const existingDays = await fetchDays(supabase, weekId);
    if (existingDays.length > 0) {
      await supabase.from('program_days').delete().eq('week_id', weekId);
    }
    for (let i = 0; i < (generated?.days || []).length; i++) {
      const dayPlan = generated.days[i];
      const { data: createdDay, error: dayErr } = await supabase
        .from('program_days')
        .insert({
          week_id: weekId,
          day_number: i + 1,
          title: dayPlan.title,
        })
        .select('*')
        .single();
      if (dayErr) throw dayErr;
      for (let j = 0; j < (dayPlan.exercises || []).length; j++) {
        const ex = dayPlan.exercises[j];
        await supabase.from('program_exercises').insert({
          day_id: createdDay.id,
          exercise_name: ex.name,
          exercise_library_id: ex.exerciseId || null,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.restSeconds,
          tempo: ex.tempo || null,
          notes: ex.reason || ex.notes || null,
          sort_order: j,
        });
      }
    }
    const dList = await fetchDays(supabase, weekId);
    setDays(dList);
    setSelectedDayIndex(0);
    if (dList[0]?.id) {
      const exList = await fetchExercises(supabase, dList[0].id);
      setExercises(exList);
    }
  }, [supabase, selectedWeek]);

  const buildSmartWeek = useCallback(async () => {
    if (!supabase || !coachId) return null;
    await ensureAtlasExerciseLibrarySeeded();
    const exerciseCandidates = await listAtlasExerciseCandidates({
      limit: 500,
      filters: {
        movementPattern: libraryFilterMovement || undefined,
        primaryMuscle: libraryFilterMuscle || undefined,
        equipmentPrimary: libraryFilterEquipment || undefined,
      },
    });
    if (!exerciseCandidates.length) return null;
    const context = {
      role: isPersonalRole ? 'personal' : 'coach',
      personalPlanTier: isPersonalRole ? personalPlanTier : null,
      goal: quickGoal,
      daysPerWeek: quickDaysPerWeek,
      structureType: weekStructureType,
      experienceLevel: isPrepOriented ? 'advanced' : 'intermediate',
      equipmentAccess: libraryFilterEquipment ? [libraryFilterEquipment] : [],
      focusAreas: libraryFilterMuscle ? [libraryFilterMuscle] : [],
      phase: isPrepOriented ? 'pre_contest' : 'off_season',
      isPrepOriented,
      fatiguePreference: quickGoal === 'fat_loss' ? 'low' : 'moderate',
      exerciseCandidates,
    };
    const splitChoice = chooseSplitForContext(context);
    const generated = generateStarterProgram({ ...context, splitType: splitChoice?.splitId });
    return generated;
  }, [
    supabase,
    coachId,
    quickGoal,
    quickDaysPerWeek,
    weekStructureType,
    isPrepOriented,
    isPersonalRole,
    personalPlanTier,
    libraryFilterMovement,
    libraryFilterMuscle,
    libraryFilterEquipment,
  ]);

  const handleQuickStartGenerate = async ({ weekOverride = null } = {}) => {
    const targetWeek = weekOverride || selectedWeek;
    if (!supabase || !targetWeek) return;
    if (!block?.id) {
      toast.error('Save first');
      return;
    }
    if (isPersonalRole && !canUsePersonalAutoBuilder) {
      if (canShowPersonalUpgradePrompt(PERSONAL_UPGRADE_PROMPT_TYPES.FEATURE_ACCESS, Date.now(), profile)) {
        markPersonalUpgradePromptShown(PERSONAL_UPGRADE_PROMPT_TYPES.FEATURE_ACCESS);
      }
      toast.error(personalFeatureGateCopy.body);
      return;
    }
    setSaving(true);
    try {
      await runBuildSequence();
      const smart = await buildSmartWeek();
      if (!smart) {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) {
            console.warn('[ProgramBuilder] Exercise library returned no candidates; using template quick-start week.');
          }
        }
        if (isPersonalRole) {
          toast.message('Template week — seed library or edit for smarter exercise picks');
        }
      }
      const generated = smart || generateQuickStartWeek({
        goal: quickGoal,
        daysPerWeek: quickDaysPerWeek,
        structureType: weekStructureType,
      });
      await persistGeneratedWeek(generated, targetWeek.id);
      setAutoBuildExplainability(smart?.explainability || [
        `Built for ${quickGoal} and ${quickDaysPerWeek} training days`,
        'Matched to your available equipment',
      ]);
      setGeneratedReveal({
        goal: quickGoal,
        daysPerWeek: quickDaysPerWeek,
        splitType: generated?.structureType || generated?.splitType || weekStructureType,
        days: Array.isArray(generated?.days) ? generated.days : [],
      });
      toast.success(smart ? 'Smart draft ready' : 'Week ready');
      queryClient.invalidateQueries({ queryKey: ['personal-my-program-supabase'] });
      queryClient.invalidateQueries({ queryKey: ['personal-home-assigned-today'] });
    } catch (e) {
      toast.error(e?.message || 'Quick Start failed');
    } finally {
      setSaving(false);
    }
  };

  const resolveEntryTotalWeeks = useCallback(() => {
    if (entryWeeksPreset === 'custom') {
      const parsed = Number(entryCustomWeeks);
      if (!Number.isFinite(parsed)) return 6;
      return Math.max(1, Math.min(52, Math.round(parsed)));
    }
    const preset = Number(entryWeeksPreset);
    if (!Number.isFinite(preset)) return 4;
    return Math.max(1, Math.min(52, Math.round(preset)));
  }, [entryWeeksPreset, entryCustomWeeks]);

  const handleStartBlank = () => {
    const weeks = resolveEntryTotalWeeks();
    setTotalWeeks(weeks);
    headerEffectiveWeeksRef.current = weeks;
    handleSaveBlock({ totalWeeks: weeks });
  };

  const handleEntryGenerateProgram = useCallback(async () => {
    if (!supabase || !coachId) return;
    const isSelfTarget = isPersonalRole;
    const isTemplateTarget = !isPersonalRole && entryWhoFor === ENTRY_TARGET_TEMPLATE;
    if (!isSelfTarget && !entryWhoFor) {
      toast.error('Select who this program is for.');
      return;
    }

    if (isPersonalRole && !canUsePersonalAutoBuilder) {
      if (canShowPersonalUpgradePrompt(PERSONAL_UPGRADE_PROMPT_TYPES.FEATURE_ACCESS, Date.now(), profile)) {
        markPersonalUpgradePromptShown(PERSONAL_UPGRADE_PROMPT_TYPES.FEATURE_ACCESS);
      }
      toast.error(personalFeatureGateCopy.body);
      return;
    }

    const totalWeeksFromEntry = resolveEntryTotalWeeks();
    const normalizedGoal = normalizeEntryGoal(entryGoal);
    const structureType = suggestWeekStructureType(entryDaysPerWeek);
    const generatedTitle = `${ENTRY_GOAL_OPTIONS.find((g) => g.value === entryGoal)?.label || 'Generated'} Program`;
    const title = (blockName || '').trim() || generatedTitle;

    setQuickGoal(normalizedGoal);
    setQuickDaysPerWeek(entryDaysPerWeek);
    setQuickDaysPerWeekInput(String(entryDaysPerWeek));
    setWeekStructureType(structureType);
    setBlockName(title);

    setSaving(true);
    try {
      await runBuildSequence();

      let insertedBlock = null;
      if (isSelfTarget) {
        const { data, error } = await supabase
          .from('program_blocks')
          .insert({
            owner_profile_id: coachId,
            coach_id: coachId,
            title,
            total_weeks: totalWeeksFromEntry,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        insertedBlock = data;
      } else if (isTemplateTarget) {
        const { data, error } = await supabase
          .from('program_blocks')
          .insert({
            coach_id: coachId,
            title,
            total_weeks: totalWeeksFromEntry,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        insertedBlock = data;
      } else {
        const { data, error } = await supabase
          .from('program_blocks')
          .insert({
            client_id: entryWhoFor,
            coach_id: coachId,
            title,
            total_weeks: totalWeeksFromEntry,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        insertedBlock = data;
      }

      const { error: weekErr } = await ensureProgramWeekRowsForBlock(supabase, insertedBlock.id, totalWeeksFromEntry);
      if (weekErr) throw weekErr;

      if (isSelfTarget) {
        await activatePersonalProgramAssignment(supabase, coachId, insertedBlock.id);
      }

      const wList = await fetchWeeks(supabase, insertedBlock.id);
      if (!wList.length) throw new Error('No weeks available after generation setup.');

      await ensureAtlasExerciseLibrarySeeded();
      const exerciseCandidates = await listAtlasExerciseCandidates({
        limit: 500,
        filters: {
          movementPattern: libraryFilterMovement || undefined,
          primaryMuscle: libraryFilterMuscle || undefined,
          equipmentPrimary: libraryFilterEquipment || undefined,
        },
      });

      const context = {
        role: isSelfTarget ? 'personal' : 'coach',
        personalPlanTier: isSelfTarget ? (isPersonalRole ? personalPlanTier : 'enhanced') : null,
        goal: normalizedGoal,
        daysPerWeek: entryDaysPerWeek,
        structureType,
        experienceLevel: isPrepOriented ? 'advanced' : 'intermediate',
        equipmentAccess: libraryFilterEquipment ? [libraryFilterEquipment] : [],
        focusAreas: libraryFilterMuscle ? [libraryFilterMuscle] : [],
        phase: isPrepOriented ? 'pre_contest' : 'off_season',
        isPrepOriented,
        fatiguePreference: normalizedGoal === 'fat_loss' ? 'low' : 'moderate',
        exerciseCandidates,
      };
      const splitChoice = chooseSplitForContext(context);
      const generated = exerciseCandidates.length
        ? generateStarterProgram({ ...context, splitType: splitChoice?.splitId })
        : generateQuickStartWeek({
            goal: normalizedGoal,
            daysPerWeek: entryDaysPerWeek,
            structureType,
          });

      for (const week of wList) {
        await persistGeneratedWeek(generated, week.id);
      }

      const firstWeekIndex = wList.findIndex((w) => Number(w.week_number) === 1);
      const weekIdx = firstWeekIndex >= 0 ? firstWeekIndex : 0;
      const firstWeek = wList[weekIdx];
      const firstWeekDays = await fetchDays(supabase, firstWeek.id);
      setDays(firstWeekDays);
      setSelectedWeekIndex(weekIdx);
      setSelectedDayIndex(0);
      if (firstWeekDays[0]?.id) {
        const exList = await fetchExercises(supabase, firstWeekDays[0].id);
        setExercises(exList);
      } else {
        setExercises([]);
      }

      setTotalWeeks(totalWeeksFromEntry);
      headerEffectiveWeeksRef.current = totalWeeksFromEntry;
      setWeeks(wList);
      setBlock(insertedBlock);
      setClientId(isSelfTarget || isTemplateTarget ? '' : (insertedBlock.client_id || entryWhoFor));
      setStartFromScratchSelected(false);

      if (isSelfTarget) {
        queryClient.invalidateQueries({ queryKey: ['personal-my-program-supabase'] });
        queryClient.invalidateQueries({ queryKey: ['personal-home-assigned-today'] });
        navigate(`/program-builder?personal=1&blockId=${encodeURIComponent(insertedBlock.id)}`, { replace: true });
      } else if (isTemplateTarget) {
        navigate(`/program-builder?blockId=${encodeURIComponent(insertedBlock.id)}`, { replace: true });
      } else {
        if (coachId) trackFirstProgramCreated(coachId, { client_id: insertedBlock.client_id, block_id: insertedBlock.id });
        navigate(`/program-builder?clientId=${encodeURIComponent(insertedBlock.client_id)}&blockId=${encodeURIComponent(insertedBlock.id)}`, { replace: true });
      }
      toast.success('Program generated');
    } catch (e) {
      toast.error(e?.message || 'Could not generate program');
    } finally {
      setSaving(false);
    }
  }, [
    supabase,
    coachId,
    isPersonalRole,
    entryWhoFor,
    canUsePersonalAutoBuilder,
    profile,
    personalFeatureGateCopy.body,
    resolveEntryTotalWeeks,
    entryGoal,
    entryDaysPerWeek,
    blockName,
    runBuildSequence,
    libraryFilterMovement,
    libraryFilterMuscle,
    libraryFilterEquipment,
    isPrepOriented,
    personalPlanTier,
    persistGeneratedWeek,
    queryClient,
    navigate,
    entryWeeksPreset,
    entryCustomWeeks,
  ]);

  const handleEntryUseTemplate = useCallback(async (templateId) => {
    if (!supabase || !coachId) return;
    const template = getProgramTemplateById(templateId);
    if (!template) {
      toast.error('Template not found');
      return;
    }

    const isSelfTarget = isPersonalRole;
    const isTemplateTarget = !isPersonalRole && entryWhoFor === ENTRY_TARGET_TEMPLATE;
    if (!isSelfTarget && !entryWhoFor) {
      toast.error('Select who this program is for.');
      return;
    }

    const totalWeeksFromEntry = resolveEntryTotalWeeks();
    const structureType = suggestWeekStructureType(template.days.length || entryDaysPerWeek || 3);
    const title = (blockName || '').trim() || `${template.name} Program`;

    setQuickGoal('muscle');
    setQuickDaysPerWeek(template.days.length || 3);
    setQuickDaysPerWeekInput(String(template.days.length || 3));
    setWeekStructureType(structureType);
    setBlockName(title);

    setSaving(true);
    try {
      await runBuildSequence();

      let insertedBlock = null;
      if (isSelfTarget) {
        const { data, error } = await supabase
          .from('program_blocks')
          .insert({
            owner_profile_id: coachId,
            coach_id: coachId,
            title,
            total_weeks: totalWeeksFromEntry,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        insertedBlock = data;
      } else if (isTemplateTarget) {
        const { data, error } = await supabase
          .from('program_blocks')
          .insert({
            coach_id: coachId,
            title,
            total_weeks: totalWeeksFromEntry,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        insertedBlock = data;
      } else {
        const { data, error } = await supabase
          .from('program_blocks')
          .insert({
            client_id: entryWhoFor,
            coach_id: coachId,
            title,
            total_weeks: totalWeeksFromEntry,
          })
          .select('id, owner_profile_id, client_id, title, total_weeks')
          .single();
        if (error) throw error;
        insertedBlock = data;
      }

      const { error: weekErr } = await ensureProgramWeekRowsForBlock(supabase, insertedBlock.id, totalWeeksFromEntry);
      if (weekErr) throw weekErr;

      if (isSelfTarget) {
        await activatePersonalProgramAssignment(supabase, coachId, insertedBlock.id);
      }

      const wList = await fetchWeeks(supabase, insertedBlock.id);
      if (!wList.length) throw new Error('No weeks available after template setup.');

      const templateProgram = {
        days: (template.days || []).map((day) => ({
          title: day.title,
          exercises: (day.exercises || []).map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets ?? 3,
            reps: exercise.reps ?? '8-12',
            restSeconds: exercise.restSeconds ?? 90,
            notes: `Template: ${template.name}`,
          })),
        })),
      };

      for (const week of wList) {
        await persistGeneratedWeek(templateProgram, week.id);
      }

      const firstWeekIndex = wList.findIndex((w) => Number(w.week_number) === 1);
      const weekIdx = firstWeekIndex >= 0 ? firstWeekIndex : 0;
      const firstWeek = wList[weekIdx];
      const firstWeekDays = await fetchDays(supabase, firstWeek.id);
      setDays(firstWeekDays);
      setSelectedWeekIndex(weekIdx);
      setSelectedDayIndex(0);
      if (firstWeekDays[0]?.id) {
        const exList = await fetchExercises(supabase, firstWeekDays[0].id);
        setExercises(exList);
      } else {
        setExercises([]);
      }

      setTotalWeeks(totalWeeksFromEntry);
      headerEffectiveWeeksRef.current = totalWeeksFromEntry;
      setWeeks(wList);
      setBlock(insertedBlock);
      setClientId(isSelfTarget || isTemplateTarget ? '' : (insertedBlock.client_id || entryWhoFor));

      if (isSelfTarget) {
        queryClient.invalidateQueries({ queryKey: ['personal-my-program-supabase'] });
        queryClient.invalidateQueries({ queryKey: ['personal-home-assigned-today'] });
        navigate(`/program-builder?personal=1&blockId=${encodeURIComponent(insertedBlock.id)}`, { replace: true });
      } else if (isTemplateTarget) {
        navigate(`/program-builder?blockId=${encodeURIComponent(insertedBlock.id)}`, { replace: true });
      } else {
        if (coachId) trackFirstProgramCreated(coachId, { client_id: insertedBlock.client_id, block_id: insertedBlock.id });
        navigate(`/program-builder?clientId=${encodeURIComponent(insertedBlock.client_id)}&blockId=${encodeURIComponent(insertedBlock.id)}`, { replace: true });
      }
      toast.success(`${template.name} loaded`);
    } catch (e) {
      toast.error(e?.message || 'Could not load template');
    } finally {
      setSaving(false);
    }
  }, [
    supabase,
    coachId,
    isPersonalRole,
    entryWhoFor,
    resolveEntryTotalWeeks,
    entryDaysPerWeek,
    blockName,
    runBuildSequence,
    persistGeneratedWeek,
    queryClient,
    navigate,
  ]);

  const quickStartPreviewTitles = useMemo(
    () => getQuickStartWeekPreviewTitles(weekStructureType, quickDaysPerWeek),
    [weekStructureType, quickDaysPerWeek]
  );
  const dayPromptActions = useMemo(() => {
    if (!personalEnhancedExperience) return [];
    return [
      {
        id: 'upper-back-balance',
        label: 'Add upper-back balance',
        onClick: () => handleAddExercise({ exercise_name: 'Chest Supported Row', sets: 3, reps: '10-12', rest_seconds: 90 }),
      },
      {
        id: 'simplify-session',
        label: 'Simplify this session',
        onClick: () => {
          if (!selectedDay || exercises.length <= 4) return;
          toast.message('Try keeping 4 core lifts for a lower-fatigue session.');
        },
      },
      {
        id: 'repeat-last-week',
        label: 'Repeat last week structure',
        onClick: handleCopyPreviousWeek,
      },
    ];
  }, [personalEnhancedExperience, handleAddExercise, selectedDay, exercises.length, handleCopyPreviousWeek]);

  const programBuilderRoleView = isPersonalRole ? 'personal' : 'coach';
  const showCoachNoClientsGateEarly = !isPersonalRole && !blockIdParam && clients.length === 0;
  const programBuilderMigrationAttrs = useMemo(() => {
    let surface = 'active';
    if (!canUseBuilder) surface = 'access_denied';
    else if (isPersonalRole && !hasSupabase) surface = 'no_supabase';
    else if (loading) surface = 'loading';
    else if (showCoachNoClientsGateEarly) surface = 'no_clients';
    const s = deriveProgramBuilderRouteState({ roleView: programBuilderRoleView, surface });
    return atlasMigrationDataAttributes(s.phase, s.primary);
  }, [
    canUseBuilder,
    isPersonalRole,
    hasSupabase,
    loading,
    showCoachNoClientsGateEarly,
    programBuilderRoleView,
  ]);

  if (!canUseBuilder) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: colors.bg, color: colors.text }}
        {...programBuilderMigrationAttrs}
      >
        <p style={{ color: colors.muted }}>Program Builder isn&apos;t available for this account type.</p>
      </div>
    );
  }

  if (isPersonalRole && !hasSupabase) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 p-6"
        style={{ background: colors.bg, color: colors.text }}
        {...programBuilderMigrationAttrs}
      >
        <TopBar title={isPersonalRole ? 'My program' : 'Program Builder'} onBack={() => navigate(-1)} />
        <p style={{ color: colors.muted, textAlign: 'center', maxWidth: 320 }}>
          {personalNoCloudCopy()}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }} {...programBuilderMigrationAttrs}>
        <TopBar title={isPersonalRole ? 'My program' : 'Program Builder'} onBack={() => navigate(-1)} />
        <PageLoader
          message={isPersonalRole ? personalBuilderLoadingMessage() : 'Loading builder…'}
          hint={isPersonalRole ? personalBuilderLoadingHint() : 'Fetching clients and program block.'}
        />
      </div>
    );
  }

  const saveDisabled = isPersonalRole
    ? !blockName.trim()
    : !blockName.trim() || (!clientId && !block?.client_id);
  const saveHint = isPersonalRole
    ? personalSaveNameHint({ hasBlock: !!block?.id })
    : !blockName.trim()
      ? 'Add a block name to continue.'
      : !clientId && !block?.client_id
        ? 'Select a client to create this block.'
        : '';
  const showCoachNoClientsGate = !isPersonalRole && !blockIdParam && clients.length === 0;

  return (
    <PersonalCanvas>
    <div
      className="min-h-screen pb-8"
      style={{ background: isPersonalRole ? 'transparent' : colors.bg, color: colors.text }}
      {...programBuilderMigrationAttrs}
    >
      <TopBar title={isPersonalRole ? 'My program' : 'Program Builder'} onBack={() => navigate(-1)} />
      <PersonalColumn variant={isPersonalRole ? 'wide' : 'default'}>
      <div
        style={
          isPersonalRole
            ? personalColumnInnerBodyStyle()
            : { ...pageContainer, maxWidth: isDesktopWeb ? 1240 : undefined, margin: '0 auto', paddingBottom: spacing[24] }
        }
      >
        {/* Entry panel — shown whenever no block is open yet */}
        {!block?.id && (
          <ProgramEntryPanel
            isPersonalRole={isPersonalRole}
            clients={clients}
            saving={saving}
            blockName={blockName}
            setBlockName={setBlockName}
            entryGoal={entryGoal}
            setEntryGoal={setEntryGoal}
            entryDaysPerWeek={entryDaysPerWeek}
            setEntryDaysPerWeek={setEntryDaysPerWeek}
            entryWeeksPreset={entryWeeksPreset}
            setEntryWeeksPreset={setEntryWeeksPreset}
            entryCustomWeeks={entryCustomWeeks}
            setEntryCustomWeeks={setEntryCustomWeeks}
            entryWhoFor={entryWhoFor}
            onEntryWhoForChange={(val) => {
              setEntryWhoFor(val);
              if (val && val !== ENTRY_TARGET_TEMPLATE) setClientId(val);
              else setClientId('');
            }}
            onGenerate={handleEntryGenerateProgram}
            onStartBlank={handleStartBlank}
          />
        )}

        {/* Editing header — shown when a block is open */}
        {block?.id && (
          <ProgramBuilderHeader
            showCoachNoClientsGate={showCoachNoClientsGate}
            navigate={navigate}
            clients={clients}
            isPersonalRole={isPersonalRole}
            personalBuilderIntro={personalBuilderIntro}
            block={block}
            personalBasicExperience={personalBasicExperience}
            fromTodayContext={fromTodayContext}
            dismissTodayFromBuilder={dismissTodayFromBuilder}
            adjustmentMode={adjustmentMode}
            contextBannerTitle={contextBannerTitle}
            contextNote={contextNote}
            handleSaveBlock={handleSaveBlock}
            headerEffectiveWeeksRef={headerEffectiveWeeksRef}
            saving={saving}
            clientId={clientId}
            contextReviewId={contextReviewId}
            contextSource={contextSource}
            setClientId={setClientId}
            standardCard={standardCard}
            sectionGap={sectionGap}
            sectionLabel={sectionLabel}
            blockName={blockName}
            setBlockName={setBlockName}
            totalWeeks={totalWeeks}
            setTotalWeeks={setTotalWeeks}
            reportHeaderEffectiveWeeks={reportHeaderEffectiveWeeks}
            saveDisabled={saveDisabled}
            saveHint={saveHint}
            isPrepOriented={isPrepOriented}
            personalSaveNameHint={personalSaveNameHint}
            personalEnhancedExperience={personalEnhancedExperience}
          />
        )}
        {!isPersonalRole && block?.id ? (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[12] }}>
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div style={{ fontSize: 12, color: colors.muted }}>
                Assign this programme without leaving the builder.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current })}
                  disabled={saving}
                  style={{
                    minHeight: touchTargetMin,
                    padding: `${spacing[10]}px ${spacing[14]}px`,
                    borderRadius: radii.button,
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setAssignSheetOpen(true)}
                  disabled={saving}
                  style={{
                    minHeight: touchTargetMin,
                    padding: `${spacing[10]}px ${spacing[14]}px`,
                    borderRadius: radii.button,
                    border: `1px solid ${colors.primary}`,
                    background: 'transparent',
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: 700,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  Assign to client ▾
                </button>
              </div>
            </div>
          </Card>
        ) : null}
        {!isPersonalRole && (clientId || block?.client_id) ? (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[10] }}>Coach notes for this phase</p>
            <p style={{ fontSize: 12, color: colors.muted, marginTop: 0, marginBottom: spacing[12], lineHeight: 1.45 }}>
              Clients can see these on their programme timeline when no week-specific note is set. Save the block to
              publish changes.
            </p>
            <CoachFreeTextInput
              category="programme_note"
              placeholder="Add a note for this phase, e.g. deload week, high volume block…"
              label=""
              allowMultiple={false}
              maxTerms={1}
              onConfirm={(terms) => {
                const next = terms.filter(Boolean);
                if (!next.length) return;
                setPhaseCoachNotesLines((prev) => [...prev, ...next]);
              }}
            />
            {phaseCoachNotesLines.length > 0 ? (
              <div style={{ marginTop: spacing[12] }}>
                <p style={{ fontSize: 11, color: colors.muted, marginBottom: spacing[6] }}>On this block</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {phaseCoachNotesLines.map((line) => (
                    <div
                      key={line}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        minHeight: touchTargetMin,
                        padding: '4px 10px',
                        borderRadius: 20,
                        border: `1px solid ${colors.border}`,
                        background: colors.surface1,
                        fontSize: 13,
                        color: colors.text,
                      }}
                    >
                      <span>{line}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${line}`}
                        onClick={() => setPhaseCoachNotesLines((prev) => prev.filter((t) => t !== line))}
                        style={{
                          fontSize: 11,
                          cursor: 'pointer',
                          color: colors.muted,
                          border: 'none',
                          background: 'transparent',
                          padding: '4px 6px',
                          minWidth: 32,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}


        {block?.id && !isPersonalRole && (clientId || block.client_id) && (
          <div className="flex flex-wrap gap-2" style={{ marginBottom: sectionGap }}>
            <button
              type="button"
              onClick={() => navigate(`/program-assignments?blockId=${encodeURIComponent(block.id)}&clientId=${encodeURIComponent(clientId || block.client_id)}`)}
              className="inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-opacity"
              style={{
                minHeight: touchTargetMin,
                padding: `${spacing[12]}px ${spacing[16]}px`,
                border: `1px solid ${colors.primary}`,
                background: 'transparent',
                color: colors.primary,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={18} /> Assign to client
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(`/program-assignments?blockId=${encodeURIComponent(block.id)}&clientId=${encodeURIComponent(clientId || block.client_id)}&quickAssign=1`)
              }
              className="inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-opacity"
              style={{
                minHeight: touchTargetMin,
                padding: `${spacing[12]}px ${spacing[16]}px`,
                border: `1px solid ${shell.cardBorder}`,
                background: colors.surface2,
                color: colors.text,
                cursor: 'pointer',
              }}
            >
              <Save size={16} /> Quick assign now
            </button>
          </div>
        )}

        <DuplicateToClientSheet
          block={block}
          clients={clients}
          isPersonalRole={isPersonalRole}
          clientId={clientId}
          duplicateTargetClientId={duplicateTargetClientId}
          setDuplicateTargetClientId={setDuplicateTargetClientId}
          onDuplicate={handleDuplicateBlockToClient}
          saving={saving}
        />

        {block?.id ? <div ref={postBlockCreateRef} style={{ scrollMarginTop: 72, height: 0 }} aria-hidden /> : null}
        <ProgramWeekView
          block={block}
          weeks={weeks}
          isPersonalRole={isPersonalRole}
          selectedWeek={selectedWeek}
          totalWeeks={totalWeeks}
          selectedWeekIndex={selectedWeekIndex}
          handleSelectWeek={handleSelectWeek}
          handleCopyWeekToEnd={handleCopyWeekToEnd}
          saving={saving}
          personalBasicExperience={personalBasicExperience}
          sectionLabel={sectionLabel}
          sectionGap={sectionGap}
          sourceBlockId={sourceBlockId}
          setSourceBlockId={setSourceBlockId}
          sourceBlocks={sourceBlocks}
          handleCopyFromSourceBlock={handleCopyFromSourceBlock}
          handleCopyPreviousWeek={handleCopyPreviousWeek}
          personalEnhancedExperience={personalEnhancedExperience}
          days={days}
          handleAddDay={handleAddDay}
          personalEmptyWeekDescription={personalEmptyWeekDescription}
          selectedDayIndex={selectedDayIndex}
          setSelectedDayIndex={setSelectedDayIndex}
          handleDuplicateDay={handleDuplicateDay}
          selectedDay={selectedDay}
          libraryFilterMovement={libraryFilterMovement}
          setLibraryFilterMovement={setLibraryFilterMovement}
          libraryFilterMuscle={libraryFilterMuscle}
          setLibraryFilterMuscle={setLibraryFilterMuscle}
          libraryFilterEquipment={libraryFilterEquipment}
          setLibraryFilterEquipment={setLibraryFilterEquipment}
          liveProgramContext={liveProgramContext}
          exerciseEntryProps={{
            standardCard,
            sectionGap,
            shell,
            exercises,
            handleAddExercise,
            openExercisePicker,
            handleUpdateExercise,
            handleRemoveExercise,
            handleMoveExercise,
            handleDuplicateExercise,
            handleCopyPreviousRowSetup,
            currentDayRecentNames,
            personalBasicExperience,
            suggestionByExerciseId,
            previousPerformanceByExerciseId,
            saving,
            personalEnhancedExperience,
            dayPromptActions,
            handleSmartSwapExercise,
            isPrepOriented,
            isCoachRole,
            clientId,
            block,
            personalExperienceLevel,
            handleLinkSuperset,
            handleRemoveSuperset,
            showPersonalBuilderEmptyHint,
            personalBuilderEmptyCopy,
          }}
          handleSaveBlock={handleSaveBlock}
          headerEffectiveWeeksRef={headerEffectiveWeeksRef}
          openExercisePicker={openExercisePicker}
          isCoachRole={isCoachRole}
          clientId={clientId}
          standardCard={standardCard}
        />
      </div>
      </PersonalColumn>
      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        coachId={coachId}
        isTrainer={!isPersonalRole}
        mode={personalEnhancedExperience ? 'enhanced' : 'basic'}
        suggestedExercises={pickerSuggestedExercises}
        lastWeekExercises={pickerLastWeekExercises}
        compactBasic={personalBasicExperience}
      />
      {assignSheetOpen && !isPersonalRole ? (
        <div
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(2,6,23,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: spacing[12] }}
          onClick={() => setAssignSheetOpen(false)}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, padding: spacing[16], borderRadius: 16 }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>Assign programme</p>
            <p style={{ margin: `${spacing[6]}px 0 ${spacing[12]}px`, fontSize: 12, color: colors.muted }}>Select client and start date, then assign now.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <select
                value={assignClientId}
                onChange={(e) => setAssignClientId(e.target.value)}
                style={{ minHeight: touchTargetMin, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, padding: '0 10px' }}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={assignStartDate}
                onChange={(e) => setAssignStartDate(e.target.value)}
                style={{ minHeight: touchTargetMin, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, padding: '0 10px' }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignSheetOpen(false)}
                  style={{ flex: 1, minHeight: touchTargetMin, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignNow}
                  disabled={saving}
                  style={{ flex: 1, minHeight: touchTargetMin, borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, opacity: saving ? 0.7 : 1 }}
                >
                  Assign now
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
    </PersonalCanvas>
  );
}
