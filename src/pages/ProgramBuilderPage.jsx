/**
 * Program Builder MVP – coach or personal user creates/edits program blocks (Supabase):
 * program_blocks → program_weeks → program_days → program_exercises.
 * Personal blocks use owner_profile_id; coach blocks use client_id.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { isCoach, isAdmin, isPersonal } from '@/lib/roles';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';
import { standardCard, pageContainer, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingState';
import BlockHeader from '@/components/program-builder/BlockHeader';
import WeekTabs from '@/components/program-builder/WeekTabs';
import DayTabs from '@/components/program-builder/DayTabs';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import { personalColumnInnerBodyStyle } from '@/lib/personalShellLayout';
import ExerciseEditor from '@/components/program-builder/ExerciseEditor';
import ExercisePickerModal from '@/components/programs/ExercisePickerModal';
import { UserPlus, Save, User, ArrowLeft, Lightbulb, Calendar, Loader2, Wand2, X } from 'lucide-react';
import { suggestLoadIncrease } from '@/lib/programProgression';
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
import {
  ATLAS_MOVEMENT_PATTERNS,
  ATLAS_MUSCLES,
  ATLAS_EQUIPMENT_PRIMARY,
  MOVEMENT_LABELS,
  MUSCLE_LABELS,
  EQUIPMENT_PRIMARY_LABELS,
} from '@/lib/exerciseTaxonomy';
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
import { EXERCISES as PICKER_EXERCISES } from '@/data/exercises/exerciseLibrary';
import { atlasMigrationDataAttributes, deriveProgramBuilderRouteState } from '@/lib/atlasMigrationPhases';

/** Fetch coach's clients (coach_id or trainer_id = userId). */
async function fetchCoachClients(supabase, userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('name');
  if (error) return [];
  return (data || []).map((c) => ({ id: c.id, name: c.name || 'Client' }));
}

/** Fetch block by id — returns Supabase error separately from “no row” (RLS / missing). */
async function fetchBlock(supabase, blockId) {
  if (!supabase || !blockId) return { data: null, error: null };
  const { data, error } = await supabase.from('program_blocks').select('*').eq('id', blockId).maybeSingle();
  return { data: data ?? null, error: error ?? null };
}

/** Loose UUID check — avoids toasting for junk `blockId=` query values. */
function isLikelyProgramBlockUuid(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/** Fetch weeks for block. */
async function fetchWeeks(supabase, blockId) {
  if (!supabase || !blockId) return [];
  const { data, error } = await supabase
    .from('program_weeks')
    .select('*')
    .eq('block_id', blockId)
    .order('week_number');
  return error ? [] : (data || []);
}

/** Fetch days for a week. */
async function fetchDays(supabase, weekId) {
  if (!supabase || !weekId) return [];
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('week_id', weekId)
    .order('day_number');
  return error ? [] : (data || []);
}

/** Fetch exercises for a day. */
async function fetchExercises(supabase, dayId) {
  if (!supabase || !dayId) return [];
  const { data, error } = await supabase
    .from('program_exercises')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');
  return error ? [] : (data || []);
}

/** Next free `day_number` for UNIQUE(week_id, day_number) — never trust local `days` (race / week switch). */
async function fetchNextDayNumberForWeek(supabase, weekId) {
  if (!supabase || !weekId) return 1;
  const { data, error } = await supabase.from('program_days').select('day_number').eq('week_id', weekId);
  if (error) throw error;
  const used = (data || [])
    .map((r) => Number(r.day_number))
    .filter((n) => Number.isFinite(n) && n >= 1);
  return used.length ? Math.max(...used) + 1 : 1;
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

const QUICK_START_GOAL_OPTIONS = [
  { value: 'muscle', label: 'Build muscle' },
  { value: 'fat_loss', label: 'Lose fat' },
  { value: 'competition', label: 'Competition prep' },
];

const WEEK_STRUCTURE_OPTIONS = [
  { id: 'full_body', label: 'Full body', description: 'Whole body each session' },
  { id: 'upper_lower', label: 'Upper / lower', description: 'Alternate upper and lower days' },
  { id: 'push_pull_legs', label: 'Push / pull / legs', description: 'Classic PPL rhythm' },
  { id: 'body_part', label: 'Body part split', description: 'One main area per day' },
  { id: 'custom', label: 'Custom', description: 'Day 1, Day 2… — you name the flow' },
];

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
  const [clientId, setClientId] = useState(clientIdParam || '');
  const [block, setBlock] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);

  const [blockName, setBlockName] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(4);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [coachSuggestions, setCoachSuggestions] = useState([]);
  const [duplicateTargetClientId, setDuplicateTargetClientId] = useState('');
  const [quickGoal, setQuickGoal] = useState('muscle');
  const [quickDaysPerWeek, setQuickDaysPerWeek] = useState(3);
  const [quickDaysPerWeekInput, setQuickDaysPerWeekInput] = useState('3');
  const [weekStructureType, setWeekStructureType] = useState('full_body');
  const [rankedResultsByQuery, setRankedResultsByQuery] = useState(() => new Map());
  const [libraryByName, setLibraryByName] = useState(() => new Map());
  const [sourceBlocks, setSourceBlocks] = useState([]);
  const [sourceBlockId, setSourceBlockId] = useState('');
  const [libraryFilterMovement, setLibraryFilterMovement] = useState('');
  const [libraryFilterMuscle, setLibraryFilterMuscle] = useState('');
  const [libraryFilterEquipment, setLibraryFilterEquipment] = useState('');
  const [autoBuildExplainability, setAutoBuildExplainability] = useState([]);
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
  const personalEnhancedExperience = isPersonalRole && personalPlanTier === 'enhanced';
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
    () => ['Analysing goal', 'Matching training days', 'Selecting exercises', 'Balancing fatigue'],
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

  const loadBlock = useCallback(async () => {
    if (!supabase || !blockIdParam) {
      setBlock(null);
      setWeeks([]);
      setDays([]);
      setExercises([]);
      setLoading(false);
      return;
    }
    const { data: b, error: blockErr } = await fetchBlock(supabase, blockIdParam);

    if (blockErr) {
      setBlock(null);
      setWeeks([]);
      setDays([]);
      setExercises([]);
      emitLoadBlockFailureToast(
        blockErr.message
          || (isPersonalRole
            ? 'Could not open this plan. Check your connection and try again.'
            : 'Could not load this program block. Check your connection and try again.')
      );
      setLoading(false);
      return;
    }

    setBlock(b);
    if (b) {
      setClientId(b.client_id || '');
      setBlockName(b.title || '');
      const tw = Math.max(1, Math.min(52, Math.round(Number(b.total_weeks)) || 4));
      setTotalWeeks(tw);
      headerEffectiveWeeksRef.current = tw;
      const { error: ensureErr } = await ensureProgramWeekRowsForBlock(supabase, b.id, tw);
      if (ensureErr && import.meta.env.DEV) {
        console.warn('[ProgramBuilder] ensureProgramWeekRowsForBlock on load', ensureErr?.message || ensureErr);
      }
      const wList = await fetchWeeks(supabase, b.id);
      setWeeks(wList);
      if (wList.length > 0) {
        const dList = await fetchDays(supabase, wList[0].id);
        setDays(dList);
        if (dList.length > 0) {
          const exList = await fetchExercises(supabase, dList[0].id);
          setExercises(exList);
        } else setExercises([]);
      } else setDays([]), setExercises([]);
    } else {
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
    }
    setLoading(false);
  }, [supabase, blockIdParam, emitLoadBlockFailureToast, isPersonalRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isPersonalRole) {
        setClients([]);
        if (clientIdParam) setClientId('');
        if (blockIdParam && supabase) {
          await loadBlock();
        } else if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      if (!isCoachRole) {
        if (!cancelled) setLoading(false);
        return;
      }

      const list = await fetchCoachClients(supabase, coachId);
      if (!cancelled) setClients(list);
      if (clientIdParam) {
        setClientId(clientIdParam);
      } else if (!blockIdParam && !clientId && list.length === 1) {
        setClientId(list[0].id);
      }
      if (blockIdParam) await loadBlock();
      else if (!cancelled) setLoading(false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCoachRole, isPersonalRole, coachId, blockIdParam, clientIdParam, clientId, loadBlock, supabase]);

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

  // Smart suggestions based on recent performance (v_exercise_progress)
  useEffect(() => {
    if (!supabase || !block?.id || (!clientId && !block?.client_id) || exercises.length === 0) {
      setCoachSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cId = clientId || block.client_id;
        const exerciseIds = exercises.map((e) => e.id).filter(Boolean);
        if (!exerciseIds.length) {
          if (!cancelled) setCoachSuggestions([]);
          return;
        }
        const { data, error } = await supabase
          .from('v_exercise_progress')
          .select('exercise_id, last_weight, last_reps, previous_weight, previous_reps, progression')
          .eq('client_id', cId)
          .in('exercise_id', exerciseIds);
        if (error || !data) {
          if (!cancelled) setCoachSuggestions([]);
          return;
        }
        let increaseCount = 0;
        let regressCount = 0;
        let flatCount = 0;
        for (const row of data) {
          const prog = row.progression != null ? Number(row.progression) : null;
          const loadSuggestion = suggestLoadIncrease(row);
          if (loadSuggestion) increaseCount += 1;
          if (prog != null && !Number.isNaN(prog)) {
            if (prog < -0.5) regressCount += 1;
            else if (Math.abs(prog) <= 0.5) flatCount += 1;
          }
        }
        const suggestions = [];
        if (increaseCount > 0) {
          suggestions.push('Increase load on progressing lifts for this block.');
        }
        if (regressCount > 0) {
          suggestions.push('Reduce sets or volume on lifts that are regressing.');
        }
        if (regressCount >= 2 || flatCount >= 3) {
          suggestions.push('Add a deload week or lighter microcycle to restore momentum.');
        }
        if (!cancelled) setCoachSuggestions(suggestions);
      } catch {
        if (!cancelled) setCoachSuggestions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, block?.id, clientId, block?.client_id, exercises]);

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
        const { error } = await supabase
          .from('program_blocks')
          .update({ title: blockName.trim(), total_weeks: effectiveWeeks })
          .eq('id', block.id);
        if (error) throw error;
        setTotalWeeks(effectiveWeeks);
        const { error: ensureErr } = await ensureProgramWeekRowsForBlock(supabase, block.id, effectiveWeeks);
        if (ensureErr && import.meta.env.DEV) {
          console.warn('[ProgramBuilder] ensure weeks on save', ensureErr?.message || ensureErr);
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
          })
          .select('id')
          .single();
        if (error) throw error;
        setTotalWeeks(effectiveWeeks);
        setBlock({ id: inserted.id, client_id: cId, title: blockName.trim(), total_weeks: effectiveWeeks });
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
          reps: prefill.reps != null ? String(prefill.reps) : (usageReps ?? String(previousReps)),
          rest_seconds: prefill.rest_seconds != null ? Number(prefill.rest_seconds) : (usageRest ?? previousRest),
          percentage: prefill.percentage != null ? Number(prefill.percentage) : (previous?.percentage ?? null),
          notes: prefill.notes ?? null,
          sort_order: nextOrder,
        })
        .select('*')
        .single();
      if (error) throw error;
      setExercises((ex) => [...ex, inserted]);
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

  const handleUpdateExercise = async (exerciseId, updates) => {
    if (!supabase || !exerciseId) return;
    const nextUpdates = { ...updates };
    if (typeof nextUpdates.exercise_name === 'string') {
      const matched = libraryByName.get(String(nextUpdates.exercise_name || '').trim().toLowerCase());
      nextUpdates.exercise_library_id = matched?.id || null;
    }
    const { error } = await supabase.from('program_exercises').update(nextUpdates).eq('id', exerciseId);
    if (error) toast.error('Update failed');
    else {
      if (typeof updates.exercise_name === 'string') pushRecentExerciseName(updates.exercise_name);
      setExercises((ex) => ex.map((e) => (e.id === exerciseId ? { ...e, ...nextUpdates } : e)));
    }
  };

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
          title: `${selectedDay.title || `Day ${selectedDay.day_number}`} (copy)`,
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
    const generated = generateStarterProgram({ ...context, splitType: splitTypeOverride || splitChoice?.splitId });
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
          console.warn('[ProgramBuilder] Exercise library returned no candidates; using template quick-start week.');
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
        <TopBar title={isPersonalRole ? 'Your plan' : 'Program Builder'} onBack={() => navigate(-1)} />
        <p style={{ color: colors.muted, textAlign: 'center', maxWidth: 320 }}>
          {personalNoCloudCopy()}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }} {...programBuilderMigrationAttrs}>
        <TopBar title={isPersonalRole ? 'Your plan' : 'Program Builder'} onBack={() => navigate(-1)} />
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
  const revealDays = Array.isArray(generatedReveal?.days) ? generatedReveal.days.slice(0, 4) : [];

  return (
    <PersonalCanvas>
    <div
      className="min-h-screen pb-8"
      style={{ background: isPersonalRole ? 'transparent' : colors.bg, color: colors.text }}
      {...programBuilderMigrationAttrs}
    >
      <TopBar title={isPersonalRole ? 'Your plan' : 'Program Builder'} onBack={() => navigate(-1)} />
      <PersonalColumn variant={isPersonalRole ? 'wide' : 'default'}>
      <div
        style={
          isPersonalRole
            ? personalColumnInnerBodyStyle()
            : { ...pageContainer, maxWidth: isDesktopWeb ? 1240 : undefined, margin: '0 auto', paddingBottom: spacing[24] }
        }
      >
        {showCoachNoClientsGate ? (
          <div style={{ marginBottom: sectionGap }}>
            <EmptyState
              title="No clients yet"
              description="Add someone to your roster first. Then you can build blocks, weeks, and exercises for them."
              icon={UserPlus}
              actionLabel="Open Clients"
              onAction={() => navigate('/clients')}
            />
          </div>
        ) : (
          <>
        {(clients.length > 0 || isPersonalRole) && (
          <p style={{ fontSize: 13, color: colors.muted, marginBottom: spacing[16], lineHeight: 1.45, marginTop: 0 }}>
            {isPersonalRole
              ? personalBuilderIntro({ hasBlock: !!block?.id, basic: personalBasicExperience })
              : 'Pick the client, name the block, then add training days and lifts. Save often — changes sync to Supabase.'}
          </p>
        )}
        {fromTodayContext && (
          <Card
            style={{
              marginBottom: spacing[16],
              padding: `${spacing[12]}px ${spacing[14]}px`,
              background: colors.primarySubtle,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing[12],
            }}
          >
            <p style={{ fontSize: 13, color: colors.text, margin: 0, flex: 1, lineHeight: 1.45 }}>
              Build your program and it&apos;ll show up here in Today.
            </p>
            <button
              type="button"
              onClick={dismissTodayFromBuilder}
              aria-label="Dismiss"
              style={{
                flexShrink: 0,
                minWidth: touchTargetMin,
                minHeight: touchTargetMin,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.button,
                border: 'none',
                background: 'transparent',
                color: colors.muted,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={18} aria-hidden />
            </button>
          </Card>
        )}
        {adjustmentMode && contextBannerTitle && (
          <Card
            style={{
              marginBottom: spacing[16],
              padding: spacing[16],
              background: colors.primarySubtle,
              border: `1px solid ${colors.primary}`,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: 0 }}>
              {contextBannerTitle}
            </p>
            {contextNote && (
              <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: 4 }} title={contextNote}>
                {contextNote.length > 80 ? `${contextNote.slice(0, 80)}…` : contextNote}
              </p>
            )}
            <div
              className="flex flex-wrap gap-2"
              style={{ marginTop: spacing[12], paddingTop: spacing[12], borderTop: `1px solid ${shell.cardBorder}` }}
            >
              <button
                type="button"
                onClick={() => handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current })}
                disabled={saving}
                className="inline-flex items-center gap-1.5"
                style={{
                  minHeight: touchTargetMin,
                  padding: `${spacing[10]}px ${spacing[16]}px`,
                  borderRadius: radii.button,
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Save size={14} /> Save changes
              </button>
              {block?.id && (clientId || block.client_id) && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/program-assignments?clientId=${encodeURIComponent(clientId || block.client_id)}&blockId=${encodeURIComponent(block.id)}`
                    )
                  }
                  className="inline-flex items-center gap-1.5"
                  style={{
                    minHeight: touchTargetMin,
                    padding: `${spacing[10]}px ${spacing[16]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.primary,
                    border: `1px solid ${colors.primary}`,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <UserPlus size={14} /> Reassign updated plan
                </button>
              )}
              {(clientId || block?.client_id) && (
                <button
                  type="button"
                  onClick={() => navigate(`/clients/${clientId || block.client_id}`)}
                  className="inline-flex items-center gap-1.5"
                  style={{
                    minHeight: touchTargetMin,
                    padding: `${spacing[10]}px ${spacing[16]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${shell.cardBorder}`,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <User size={14} /> Return to Client
                </button>
              )}
              {contextReviewId && (contextSource === 'checkin' || contextSource === 'pose_check') && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      contextSource === 'checkin'
                        ? `/review-center/checkins/${contextReviewId}`
                        : `/review-center/pose-checks/${contextReviewId}`
                    )
                  }
                  className="inline-flex items-center gap-1.5"
                  style={{
                    minHeight: touchTargetMin,
                    padding: `${spacing[10]}px ${spacing[16]}px`,
                    borderRadius: radii.button,
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${shell.cardBorder}`,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={14} /> Return to Review
                </button>
              )}
            </div>
          </Card>
        )}
        {!block && !isPersonalRole && clients.length > 0 && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Client (required)</p>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{
                width: '100%',
                padding: `${spacing[12]}px ${spacing[14]}px`,
                borderRadius: 10,
                background: colors.surface2,
                border: `1px solid ${shell.cardBorder}`,
                color: colors.text,
                fontSize: 14,
              }}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {clients.length === 1 && clientId ? (
              <p className="text-xs mt-2" style={{ color: colors.muted, marginBottom: 0 }}>
                Auto-selected your only client to speed up setup.
              </p>
            ) : null}
          </Card>
        )}

        <BlockHeader
          blockName={blockName}
          onBlockNameChange={setBlockName}
          totalWeeks={totalWeeks}
          onTotalWeeksChange={setTotalWeeks}
          onSave={handleSaveBlock}
          onEffectiveWeeksChange={reportHeaderEffectiveWeeks}
          saving={saving}
          saveDisabled={saveDisabled}
          hasBlock={!!block?.id}
          blockNamePlaceholder={
            isPersonalRole
              ? 'Plan name (e.g. Spring strength)'
              : isPrepOriented
                ? 'Block name (e.g. Prep Block)'
                : 'Block name'
          }
          saveHint={saveHint}
          planMode={isPersonalRole}
          hideWeekCount={personalBasicExperience && !!block?.id}
        />
        {block?.id && (!personalBasicExperience || personalEnhancedExperience) && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[6] }}>
              {personalEnhancedExperience ? 'Smart Builder' : 'Quick start'}
            </p>
            <p style={{ fontSize: 13, color: colors.muted, marginTop: 0, marginBottom: spacing[16], lineHeight: 1.45 }}>
              {personalEnhancedExperience
                ? 'Build your week faster. Atlas drafts a smart week, and you keep full control to edit everything.'
                : 'Build your first week. Atlas creates a clean starting point you can edit manually.'}
            </p>
            {isPersonalRole && !canUsePersonalAutoBuilder && !personalBasicExperience && (
              <div style={{ marginBottom: spacing[10], padding: spacing[12], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius, background: colors.surface1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>{personalUpgradeCopy.title}</p>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
                  {personalUpgradeCopy.body}
                </p>
              </div>
            )}
            {personalEnhancedExperience && autoBuildExplainability.length > 0 && (
              <ul className="space-y-1" style={{ margin: `0 0 ${spacing[16]}px`, paddingLeft: spacing[16] }}>
                {autoBuildExplainability.slice(0, 3).map((line, idx) => (
                  <li key={`auto-explain-${idx}`} className="text-xs" style={{ color: colors.muted }}>
                    {line}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginBottom: spacing[20] }}>
              <p style={{ ...sectionLabel, marginBottom: spacing[10], fontSize: 11 }}>Goal</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: `0 0 ${spacing[10]}px` }}>
                What are you training for?
              </p>
              <div className="flex flex-wrap" style={{ gap: spacing[8] }}>
                {QUICK_START_GOAL_OPTIONS.map((opt) => {
                  const active = quickGoal === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuickGoal(opt.value)}
                      style={{
                        minHeight: touchTargetMin - 2,
                        padding: `${spacing[10]}px ${spacing[16]}px`,
                        borderRadius: radii.button,
                        border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                        background: active ? colors.primarySubtle : colors.surface2,
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: spacing[20] }}>
              <p style={{ ...sectionLabel, marginBottom: spacing[10], fontSize: 11 }}>
                {personalEnhancedExperience ? 'Week structure + preferences' : 'Week structure'}
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: `0 0 ${spacing[8]}px` }}>
                How many days per week?
              </p>
              <div className="flex flex-wrap" style={{ gap: spacing[8], marginBottom: spacing[16] }}>
                {[2, 3, 4, 5, 6].map((n) => {
                  const active = quickDaysPerWeek === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setQuickDaysPerWeek(n);
                        setQuickDaysPerWeekInput(String(n));
                      }}
                      style={{
                        minWidth: 44,
                        minHeight: touchTargetMin - 2,
                        padding: spacing[8],
                        borderRadius: radii.button,
                        border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                        background: active ? colors.primarySubtle : colors.surface2,
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: `0 0 ${spacing[10]}px` }}>
                How do you want to structure your week?
              </p>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                style={{ marginBottom: spacing[14] }}
              >
                {WEEK_STRUCTURE_OPTIONS.map((opt) => {
                  const active = weekStructureType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setWeekStructureType(opt.id)}
                      style={{
                        textAlign: 'left',
                        minHeight: touchTargetMin + 12,
                        padding: spacing[14],
                        borderRadius: shell.cardRadius,
                        border: active ? `2px solid ${colors.primary}` : `1px solid ${shell.cardBorder}`,
                        background: active ? colors.primarySubtle : colors.surface1,
                        color: colors.text,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{opt.label}</span>
                      <span style={{ display: 'block', fontSize: 12, color: colors.muted, marginTop: spacing[4], lineHeight: 1.35 }}>
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  padding: spacing[14],
                  borderRadius: shell.cardRadius,
                  border: `1px dashed ${shell.cardBorder}`,
                  background: colors.surface2,
                }}
              >
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Preview
                </p>
                <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
                  {quickStartPreviewTitles.join(' · ')}
                </p>
              </div>
              {personalEnhancedExperience && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ marginTop: spacing[12] }}>
                  <label style={{ display: 'grid', gap: spacing[6] }}>
                    <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Equipment preference
                    </span>
                    <select
                      value={libraryFilterEquipment}
                      onChange={(e) => setLibraryFilterEquipment(e.target.value)}
                      style={{
                        minHeight: touchTargetMin,
                        borderRadius: shell.cardRadius,
                        border: `1px solid ${shell.cardBorder}`,
                        background: colors.surface1,
                        color: colors.text,
                        padding: `${spacing[8]}px ${spacing[10]}px`,
                        fontSize: 13,
                      }}
                    >
                      <option value="">Any equipment</option>
                      {ATLAS_EQUIPMENT_PRIMARY.map((k) => (
                        <option key={k} value={k}>{EQUIPMENT_PRIMARY_LABELS[k] || k}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: spacing[6] }}>
                    <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Focus bias
                    </span>
                    <select
                      value={libraryFilterMuscle}
                      onChange={(e) => setLibraryFilterMuscle(e.target.value)}
                      style={{
                        minHeight: touchTargetMin,
                        borderRadius: shell.cardRadius,
                        border: `1px solid ${shell.cardBorder}`,
                        background: colors.surface1,
                        color: colors.text,
                        padding: `${spacing[8]}px ${spacing[10]}px`,
                        fontSize: 13,
                      }}
                    >
                      <option value="">Balanced</option>
                      {ATLAS_MUSCLES.map((k) => (
                        <option key={k} value={k}>{MUSCLE_LABELS[k] || k}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleQuickStartGenerate()}
              disabled={saving || !selectedWeek}
              style={{
                width: '100%',
                marginTop: spacing[4],
                minHeight: touchTargetMin + 4,
                padding: `${spacing[14]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 700,
                cursor: saving || !selectedWeek ? 'not-allowed' : 'pointer',
                opacity: saving || !selectedWeek ? 0.7 : 1,
              }}
            >
              {personalEnhancedExperience ? 'Generate smart draft' : 'Create week 1'}
            </button>
            {generatedReveal && (
              <div style={{ marginTop: spacing[12], border: `1px solid ${colors.border}`, borderRadius: radii.card, background: colors.surface2, padding: spacing[12] }}>
                <p style={{ margin: 0, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Program ready
                </p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 16, fontWeight: 700, color: colors.text }}>
                  {QUICK_START_GOAL_OPTIONS.find((o) => o.value === generatedReveal.goal)?.label || generatedReveal.goal}
                  {' · '}
                  {WEEK_STRUCTURE_OPTIONS.find((o) => o.id === generatedReveal.splitType)?.label
                    || String(generatedReveal.splitType || '').replaceAll('_', ' ')}
                  {' · '}
                  {generatedReveal.daysPerWeek} days
                </p>
                <div style={{ marginTop: spacing[10], display: 'grid', gap: spacing[8] }}>
                  {revealDays.map((d, idx) => {
                    const ex = Array.isArray(d?.exercises) ? d.exercises : [];
                    const shown = ex.slice(0, 4);
                    return (
                      <div key={`reveal-day-${idx}`} style={{ padding: spacing[10], borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: colors.surface1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text }}>{d?.title || `Day ${idx + 1}`}</p>
                        <ul style={{ margin: `${spacing[6]}px 0 0`, paddingLeft: spacing[16] }}>
                          {shown.map((item, i) => (
                            <li key={`reveal-ex-${idx}-${i}`} style={{ fontSize: 12, color: colors.muted, lineHeight: 1.35 }}>
                              {item?.name || 'Exercise'}
                            </li>
                          ))}
                        </ul>
                        {ex.length > shown.length ? (
                          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 11, color: colors.muted }}>
                            +{ex.length - shown.length} more
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: spacing[10], border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: spacing[10], background: colors.surface1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: colors.text }}>Why this works</p>
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                    The split matches your training days and goal. Exercise choices balance stimulus and fatigue so Day 1 feels clear and the week stays sustainable.
                  </p>
                </div>
                {personalEnhancedExperience && (
                  <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[10] }}>
                    <button
                      type="button"
                      onClick={() => handleAddExercise({ exercise_name: 'Incline Dumbbell Press', sets: 3, reps: '8-12', rest_seconds: 90 })}
                      style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px` }}
                    >
                      Add chest volume
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDaysPerWeek((n) => Math.max(2, Number(n || 3) - 1))}
                      style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px` }}
                    >
                      Simplify the week
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPreviousWeek}
                      disabled={!selectedWeek || Number(selectedWeek.week_number) <= 1}
                      style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px`, opacity: !selectedWeek || Number(selectedWeek.week_number) <= 1 ? 0.5 : 1 }}
                    >
                      Repeat last structure
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStartGenerate()}
                      style={{ minHeight: touchTargetMin - 4, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, fontSize: 12, fontWeight: 600, padding: `0 ${spacing[10]}px` }}
                    >
                      Adjust from recent training
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginTop: spacing[10] }}>
                  <button
                    type="button"
                    onClick={() => navigate('/today')}
                    style={{
                      minHeight: touchTargetMin,
                      borderRadius: radii.button,
                      border: 'none',
                      background: colors.primary,
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    Start program
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratedReveal(null)}
                    style={{
                      minHeight: touchTargetMin,
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface1,
                      color: colors.text,
                      fontWeight: 600,
                    }}
                  >
                    Adjust plan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStartGenerate()}
                    disabled={saving || !selectedWeek}
                    style={{
                      minHeight: touchTargetMin,
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface1,
                      color: colors.text,
                      fontWeight: 600,
                      opacity: saving || !selectedWeek ? 0.7 : 1,
                    }}
                  >
                    Rebuild
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {block?.id && (clientId || block.client_id) && coachSuggestions.length > 0 && (!isPersonalRole || canUsePersonalAutoBuilder) && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8], display: 'flex', alignItems: 'center', gap: spacing[6] }}>
              <Lightbulb size={14} style={{ color: colors.primary }} />
              Smart suggestions
            </p>
            <ul className="space-y-1" style={{ margin: 0, paddingLeft: spacing[18] }}>
              {coachSuggestions.map((s, idx) => (
                <li key={idx} className="text-sm" style={{ color: colors.text }}>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        )}

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

        {block?.id && clients.length > 0 && !isPersonalRole && (
          <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Duplicate full block to another client</p>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={duplicateTargetClientId}
                onChange={(e) => setDuplicateTargetClientId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: `${spacing[10]}px ${spacing[12]}px`,
                  borderRadius: 10,
                  background: colors.surface2,
                  border: `1px solid ${shell.cardBorder}`,
                  color: colors.text,
                  fontSize: 14,
                }}
              >
                <option value="">Select target client</option>
                {clients
                  .filter((c) => c.id !== (clientId || block.client_id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleDuplicateBlockToClient}
                disabled={saving || !duplicateTargetClientId}
                className="inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-opacity"
                style={{
                  minHeight: touchTargetMin,
                  padding: `${spacing[12]}px ${spacing[16]}px`,
                  border: `1px solid ${colors.primary}`,
                  background: 'transparent',
                  color: colors.primary,
                  cursor: saving || !duplicateTargetClientId ? 'not-allowed' : 'pointer',
                  opacity: saving || !duplicateTargetClientId ? 0.6 : 1,
                }}
              >
                <UserPlus size={16} /> Duplicate block
              </button>
            </div>
          </Card>
        )}

        {!block?.id && (
          <p className="text-[13px]" style={{ color: colors.muted, marginBottom: sectionGap }}>
            {isPersonalRole
              ? 'Name your plan above and tap Create — then add training days here.'
              : 'Create the block to add weeks and days.'}
          </p>
        )}

        {block?.id && (
          <>
            <div ref={postBlockCreateRef} style={{ scrollMarginTop: 72, height: 0 }} aria-hidden />
            {personalBasicExperience ? (
              <p style={{ ...sectionLabel, marginBottom: spacing[10] }}>Your week</p>
            ) : (
              <WeekTabs
                weeks={weeks}
                totalWeeks={totalWeeks}
                selectedWeekIndex={selectedWeekIndex}
                onSelectWeek={handleSelectWeek}
              />
            )}

            {selectedWeek && (!isPersonalRole || personalEnhancedExperience) && (
              <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[12] }}>
                <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Builder toolbar</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPreviousWeek}
                    disabled={saving || Number(selectedWeek.week_number) <= 1}
                    style={{
                      minHeight: touchTargetMin,
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface1,
                      color: colors.text,
                      fontWeight: 600,
                      opacity: saving || Number(selectedWeek.week_number) <= 1 ? 0.6 : 1,
                    }}
                  >
                    Copy previous week
                  </button>
                  {!isPersonalRole && (
                  <div className="flex gap-2">
                    <select
                      value={sourceBlockId}
                      onChange={(e) => setSourceBlockId(e.target.value)}
                      style={{
                        flex: 1,
                        minHeight: touchTargetMin,
                        borderRadius: radii.button,
                        border: `1px solid ${colors.border}`,
                        background: colors.surface1,
                        color: colors.text,
                        padding: `0 ${spacing[10]}px`,
                      }}
                    >
                      <option value="">Copy from this client block…</option>
                      {sourceBlocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title || 'Untitled block'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleCopyFromSourceBlock}
                      disabled={saving || !sourceBlockId}
                      style={{
                        minHeight: touchTargetMin,
                        borderRadius: radii.button,
                        border: `1px solid ${colors.primary}`,
                        background: 'transparent',
                        color: colors.primary,
                        fontWeight: 700,
                        opacity: saving || !sourceBlockId ? 0.6 : 1,
                        padding: `0 ${spacing[12]}px`,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:col-span-2" style={{ gap: spacing[10] }}>
                    <p style={{ flex: 1, margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                      Uses your <strong style={{ color: colors.text, fontWeight: 600 }}>Quick start</strong> choices above (goal, days, structure).
                    </p>
                    <button
                      type="button"
                      onClick={() => handleQuickStartGenerate()}
                      disabled={saving || !selectedWeek}
                      style={{
                        flexShrink: 0,
                        minHeight: touchTargetMin,
                        borderRadius: radii.button,
                        border: `1px solid ${colors.primary}`,
                        background: colors.primary,
                        color: '#fff',
                        fontWeight: 700,
                        opacity: saving || !selectedWeek ? 0.6 : 1,
                        padding: `0 ${spacing[16]}px`,
                        cursor: saving || !selectedWeek ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {personalEnhancedExperience ? 'Generate smart draft' : 'Build my week'}
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {selectedWeek?.week_number === 1 && weeks.find((w) => w.week_number === 1) && totalWeeks > 1 && !personalBasicExperience && (
              <div style={{ marginBottom: sectionGap }}>
                <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Copy Week 1 to</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.max(0, totalWeeks - 1) }, (_, i) => i + 2).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleCopyWeek1ToWeek(num)}
                      disabled={saving}
                      className="transition-opacity"
                      style={{
                        minHeight: touchTargetMin,
                        padding: `${spacing[10]}px ${spacing[16]}px`,
                        borderRadius: shell.cardRadius,
                        border: `1px solid ${shell.cardBorder}`,
                        background: 'transparent',
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      Week {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedWeek && (
              <>
                {days.length === 0 ? (
                  <div style={{ marginBottom: sectionGap }}>
                    <EmptyState
                      title="This week has no training days"
                      description={personalEmptyWeekDescription(!!personalBasicExperience)}
                      icon={Calendar}
                      actionLabel="Add first day"
                      onAction={handleAddDay}
                    />
                    {personalBasicExperience && Number(selectedWeek?.week_number) > 1 && (
                      <div style={{ marginTop: spacing[10], display: 'flex', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={handleCopyPreviousWeek}
                          disabled={saving}
                          style={{
                            minHeight: touchTargetMin,
                            padding: `${spacing[10]}px ${spacing[16]}px`,
                            borderRadius: shell.cardRadius,
                            border: `1px solid ${shell.cardBorder}`,
                            background: colors.surface1,
                            color: colors.text,
                            fontSize: 13,
                            fontWeight: 600,
                            opacity: saving ? 0.6 : 1,
                          }}
                        >
                          Duplicate previous week
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <DayTabs
                      days={days}
                      selectedDayIndex={selectedDayIndex}
                      onSelectDay={setSelectedDayIndex}
                      onAddDay={handleAddDay}
                      onDuplicateDay={handleDuplicateDay}
                      addDayDisabled={saving}
                      hideDuplicate={personalBasicExperience}
                    />

                    {selectedDay && !personalBasicExperience && (
                      <div style={{ marginBottom: spacing[12] }}>
                        <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Library filters</p>
                        <div className="flex flex-wrap gap-2" style={{ alignItems: 'center' }}>
                          <select
                            value={libraryFilterMovement}
                            onChange={(e) => setLibraryFilterMovement(e.target.value)}
                            aria-label="Filter by movement pattern"
                            style={{
                              minHeight: touchTargetMin,
                              borderRadius: shell.cardRadius,
                              border: `1px solid ${shell.cardBorder}`,
                              background: colors.surface1,
                              color: colors.text,
                              padding: `${spacing[8]}px ${spacing[10]}px`,
                              fontSize: 13,
                            }}
                          >
                            <option value="">Any movement</option>
                            {ATLAS_MOVEMENT_PATTERNS.map((k) => (
                              <option key={k} value={k}>
                                {MOVEMENT_LABELS[k] || k}
                              </option>
                            ))}
                          </select>
                          <select
                            value={libraryFilterMuscle}
                            onChange={(e) => setLibraryFilterMuscle(e.target.value)}
                            aria-label="Filter by muscle"
                            style={{
                              minHeight: touchTargetMin,
                              borderRadius: shell.cardRadius,
                              border: `1px solid ${shell.cardBorder}`,
                              background: colors.surface1,
                              color: colors.text,
                              padding: `${spacing[8]}px ${spacing[10]}px`,
                              fontSize: 13,
                            }}
                          >
                            <option value="">Any muscle</option>
                            {ATLAS_MUSCLES.map((k) => (
                              <option key={k} value={k}>
                                {MUSCLE_LABELS[k] || k}
                              </option>
                            ))}
                          </select>
                          <select
                            value={libraryFilterEquipment}
                            onChange={(e) => setLibraryFilterEquipment(e.target.value)}
                            aria-label="Filter by equipment"
                            style={{
                              minHeight: touchTargetMin,
                              borderRadius: shell.cardRadius,
                              border: `1px solid ${shell.cardBorder}`,
                              background: colors.surface1,
                              color: colors.text,
                              padding: `${spacing[8]}px ${spacing[10]}px`,
                              fontSize: 13,
                            }}
                          >
                            <option value="">Any equipment</option>
                            {ATLAS_EQUIPMENT_PRIMARY.map((k) => (
                              <option key={k} value={k}>
                                {EQUIPMENT_PRIMARY_LABELS[k] || k}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {selectedDay && (
                      <ExerciseEditor
                        exercises={exercises}
                        onAddExercise={handleAddExercise}
                        onAddExerciseFromRecent={(name) => handleAddExercise({ exercise_name: name })}
                        onOpenPicker={openExercisePicker}
                        onUpdateExercise={handleUpdateExercise}
                        onRemoveExercise={handleRemoveExercise}
                        onMoveExercise={handleMoveExercise}
                        onDuplicateExercise={handleDuplicateExercise}
                        onCopyPreviousValues={handleCopyPreviousRowSetup}
                        recentExerciseNames={currentDayRecentNames}
                        suggestionByExerciseId={personalBasicExperience ? {} : suggestionByExerciseId}
                        notesPlaceholder={isPrepOriented ? 'Notes (optional)' : 'Notes (optional)'}
                        saving={saving}
                        personalEditorMode={personalBasicExperience ? 'personal_basic' : personalEnhancedExperience ? 'personal_enhanced' : 'default'}
                        dayPromptActions={dayPromptActions}
                        onSmartSwapExercise={personalEnhancedExperience ? handleSmartSwapExercise : undefined}
                        emptyStateFooter={
                          showPersonalBuilderEmptyHint && exercises.length === 0 ? (
                            <Card
                              style={{
                                padding: spacing[12],
                                border: `1px solid ${colors.border}`,
                                background: colors.surface2,
                              }}
                            >
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: colors.text }}>{personalBuilderEmptyCopy.title}</p>
                              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                                {personalBuilderEmptyCopy.body}
                              </p>
                              <Link
                                to="/pricing"
                                onClick={() => markPersonalUpgradePromptShown(PERSONAL_UPGRADE_PROMPT_TYPES.BUILDER_EMPTY)}
                                className="inline-block mt-2 text-[11px] font-semibold"
                                style={{ color: colors.primary }}
                              >
                                See plans
                              </Link>
                            </Card>
                          ) : null
                        }
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
            {selectedDay && (
              <div
                className="sticky bottom-0"
                style={{
                  marginTop: spacing[12],
                  paddingTop: spacing[10],
                  paddingBottom: `calc(${spacing[10]}px + env(safe-area-inset-bottom, 0px))`,
                  background: colors.bg,
                  borderTop: `1px solid ${colors.border}`,
                  display: 'grid',
                  gap: spacing[8],
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current })}
                  disabled={saving}
                  style={{
                    minHeight: touchTargetMin + 4,
                    borderRadius: radii.button,
                    border: 'none',
                    background: colors.primary,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {isPersonalRole ? 'Save plan' : personalBasicExperience ? 'Save plan' : 'Save block'}
                </button>
                <div className={personalBasicExperience ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
                  <button
                    type="button"
                    onClick={openExercisePicker}
                    disabled={saving}
                    style={{
                      minHeight: touchTargetMin,
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface1,
                      color: colors.text,
                      fontWeight: 600,
                    }}
                  >
                    Add exercise
                  </button>
                  {!personalBasicExperience ? (
                  <button
                    type="button"
                    onClick={handleDuplicateDay}
                    disabled={saving}
                    style={{
                      minHeight: touchTargetMin,
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface1,
                      color: colors.text,
                      fontWeight: 600,
                    }}
                  >
                    Duplicate day
                  </button>
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
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
      {showBuildSequence && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: spacing[16],
          }}
        >
          <Card style={{ width: '100%', maxWidth: 420, padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <div className="flex items-center gap-2">
              <Wand2 size={18} style={{ color: colors.primary }} />
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>Building your program</p>
            </div>
            <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
              {BUILD_STEPS.map((step, idx) => (
                <div key={step} className="flex items-center gap-2" style={{ opacity: idx <= buildStepIndex ? 1 : 0.55 }}>
                  {idx === buildStepIndex ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: colors.primary }} />
                  ) : idx < buildStepIndex ? (
                    <span style={{ color: colors.success, fontSize: 14 }}>✓</span>
                  ) : (
                    <span style={{ color: colors.muted, fontSize: 14 }}>•</span>
                  )}
                  <span style={{ fontSize: 13, color: colors.text }}>{step}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
    </PersonalCanvas>
  );
}
