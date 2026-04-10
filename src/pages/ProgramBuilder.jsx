import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, Users, Bookmark, X, MoreVertical, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getProgramById, getPrograms, saveProgram, assignProgramToClient } from '@/lib/programsStore';
import { getExerciseById as getLibraryExerciseById } from '@/data/exerciseLibrary';
import { saveProgramAsTemplate, getDayTemplates, getProgramTemplates, saveDayAsTemplate } from '@/lib/programTemplatesStore';
import { addProgramChangeLog } from '@/lib/programChangeLogStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import { getClientById } from '@/data/selectors';
import { useAuth } from '@/lib/AuthContext';
import { GOALS } from '@/lib/programsStore';
import ExercisePickerModal from '@/components/programs/ExercisePickerModal';
import Button from '@/ui/Button';
import { impactLight } from '@/lib/haptics';
import { trackFriction } from '@/services/frictionTracker';
import { colors } from '@/ui/tokens';

const HEADER_SAVE_STYLE = { minHeight: 44, minWidth: 44, fontSize: 15, fontWeight: 600, color: colors.accent, background: 'transparent', border: 'none' };

const PROGRESSION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'double_progression', label: 'Double progression' },
  { value: 'linear_load', label: 'Linear load' },
  { value: 'rpe_progression', label: 'RPE progression' },
  { value: 'percent_1rm', label: '% 1RM' },
  { value: 'custom', label: 'Custom' },
];

const PROGRAM_ADVANCED_MODE_KEY = 'atlas_program_advanced_mode';

function getStoredProgramAdvancedMode() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(PROGRAM_ADVANCED_MODE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

function setStoredProgramAdvancedMode(value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(PROGRAM_ADVANCED_MODE_KEY, value ? '1' : '0');
  } catch {}
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultDay = () => ({ id: nextId('d'), dayName: '', exercises: [] });
const defaultExercise = () => ({
  id: nextId('e'),
  exerciseId: '',
  name: '',
  sets: '3',
  reps: '10',
  rir: '2',
  rpe: '',
  restSeconds: '90',
  tempo: '',
  notes: '',
  groupId: '',
  progressionRule: 'none',
  progressionNotes: '',
  targetLoad: undefined,
  lastWeekLoad: undefined,
  percentageOf1RM: undefined,
  bias: undefined,
  category: undefined,
});

const BIAS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'lengthened', label: 'Lengthened' },
  { value: 'shortened', label: 'Shortened' },
  { value: 'midrange', label: 'Mid-range' },
];
const CATEGORY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'compound', label: 'Compound' },
  { value: 'isolation', label: 'Isolation' },
];

export default function ProgramBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isDemoMode, coachFocus: rawCoachFocus } = useAuth();
  const coachFocus = String(rawCoachFocus || '').toLowerCase();
  const showCompPrepFields = coachFocus === 'competition' || coachFocus === 'integrated';
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const isPersonalUser = user?.user_type === 'personal' || user?.user_type === 'solo';
  const programId = searchParams.get('id');
  const assignToClientId = searchParams.get('assignTo') || searchParams.get('clientId');
  const { setHeaderRight, setHeaderTitle } = useOutletContext() || {};
  const [programAdvancedMode, setProgramAdvancedMode] = useState(getStoredProgramAdvancedMode);

  useEffect(() => {
    setProgramAdvancedMode(getStoredProgramAdvancedMode());
  }, []);

  const setProgramAdvancedModeOn = (value) => {
    const next = typeof value === 'function' ? value(getStoredProgramAdvancedMode()) : !!value;
    setStoredProgramAdvancedMode(next);
    setProgramAdvancedMode(next);
  };

  const [formData, setFormData] = useState({
    name: '',
    goal: 'general_fitness',
    duration_weeks: '4',
    usePhases: false,
    phaseName: 'Phase 1',
    phaseDurationWeeks: '4',
    isCompPrep: false,
    division: '',
  });
  const [days, setDays] = useState([]);
  const [saveState, setSaveState] = useState('saved');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // { dayIndex, exIndex }
  const [dayTemplateContext, setDayTemplateContext] = useState(null);
  const [showProgramTemplateModal, setShowProgramTemplateModal] = useState(false);
  const [dayMenuOpen, setDayMenuOpen] = useState(null);
  const [exMenuOpen, setExMenuOpen] = useState(null);
  const [dayCollapsed, setDayCollapsed] = useState({}); // { dayIndex: true }
  const [showPreview, setShowPreview] = useState(false);
  const [activeExerciseKey, setActiveExerciseKey] = useState(null);
  const [exExpanded, setExExpanded] = useState({}); // { exId: true } for row expand
  const [blockSplitType, setBlockSplitType] = useState('upper_lower');
  const [entryMode, setEntryMode] = useState(programId ? 'build' : null);
  const [entryPicker, setEntryPicker] = useState(null); // 'template' | 'duplicate' | null

  const program = programId ? getProgramById(programId) : null;
  const availablePrograms = getPrograms().filter((p) => p?.id !== programId);
  const availableTemplates = getProgramTemplates(trainerId);
  const clientForAssign = assignToClientId ? getClientById(assignToClientId) : null;
  const saveStateRef = useRef(saveState);
  const hasContentRef = useRef(false);
  const abandonPayloadRef = useRef({});
  saveStateRef.current = saveState;
  hasContentRef.current = !!(formData.name?.trim() || days.length > 0);
  abandonPayloadRef.current = { hadName: !!formData.name?.trim(), daysCount: days.length };

  useEffect(() => {
    return () => {
      if (saveStateRef.current !== 'saved' && hasContentRef.current) {
        trackFriction('program_builder_abandoned', abandonPayloadRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const p = programId ? getProgramById(programId) : null;
    const mapExercise = (e) => ({
      id: e.id || nextId('e'),
      exerciseId: e.exerciseId ?? '',
      name: e.name ?? '',
      sets: e.sets != null ? String(e.sets) : '3',
      reps: e.reps != null ? String(e.reps) : '10',
      rir: e.rir != null ? String(e.rir) : '2',
      rpe: e.rpe != null ? String(e.rpe) : '',
      restSeconds: e.restSeconds != null ? String(e.restSeconds) : '90',
      tempo: e.tempo ?? '',
      notes: e.notes ?? '',
      groupId: e.groupId ?? '',
      progressionRule: e.progressionRule ?? 'none',
      progressionNotes: e.progressionNotes ?? '',
      targetLoad: e.targetLoad,
      lastWeekLoad: e.lastWeekLoad,
      percentageOf1RM: e.percentageOf1RM,
      bias: e.bias ?? undefined,
      category: e.category ?? undefined,
    });
    const mapDay = (d) => ({
      ...d,
      id: d.id || nextId('d'),
      exercises: (d.exercises || []).map(mapExercise),
    });

    if (p) {
      const hasPhases = Array.isArray(p.phases) && p.phases.length > 0;
      const firstPhase = hasPhases ? p.phases[0] : null;
      const phaseWeeks = firstPhase?.weeks || [];
      const phaseDays = phaseWeeks.length > 0 && phaseWeeks[0].days
        ? phaseWeeks[0].days
        : hasPhases ? [] : (p.days || []);
      const daysSource = hasPhases ? phaseDays : (p.days || []);

      setFormData({
        name: p.name || '',
        goal: p.goal || 'general_fitness',
        duration_weeks: p.duration_weeks != null ? String(p.duration_weeks) : '4',
        usePhases: hasPhases,
        phaseName: firstPhase?.name || 'Phase 1',
        phaseDurationWeeks: firstPhase?.durationWeeks != null ? String(firstPhase.durationWeeks) : '4',
        isCompPrep: !!p.isCompPrep,
        division: p.division || '',
      });
      setDays(daysSource.length ? daysSource.map(mapDay) : [defaultDay()]);
      const loadedDayNames = (daysSource || []).map((d) => String(d?.dayName || '').toLowerCase());
      const isPPL = loadedDayNames.some((n) => n.includes('push') || n.includes('pull') || n.includes('legs'));
      const isUL = loadedDayNames.some((n) => n.includes('upper') || n.includes('lower'));
      setBlockSplitType(isPPL ? 'push_pull_legs' : (isUL ? 'upper_lower' : 'custom'));
    } else {
      setFormData({
        name: '',
        goal: 'general_fitness',
        duration_weeks: '4',
        usePhases: false,
        phaseName: 'Phase 1',
        phaseDurationWeeks: '4',
        isCompPrep: false,
        division: '',
      });
      setDays([defaultDay()]);
      setBlockSplitType('upper_lower');
    }
  }, [programId]);

  const loadProgramIntoBuilder = (p) => {
    if (!p) return;
    const mapExercise = (e) => ({
      id: nextId('e'),
      exerciseId: e.exerciseId ?? '',
      name: e.name ?? '',
      sets: e.sets != null ? String(e.sets) : '3',
      reps: e.reps != null ? String(e.reps) : '10',
      rir: e.rir != null ? String(e.rir) : '2',
      rpe: e.rpe != null ? String(e.rpe) : '',
      restSeconds: e.restSeconds != null ? String(e.restSeconds) : '90',
      tempo: e.tempo ?? '',
      notes: e.notes ?? '',
      groupId: e.groupId ?? '',
      progressionRule: e.progressionRule ?? 'none',
      progressionNotes: e.progressionNotes ?? '',
      targetLoad: e.targetLoad,
      lastWeekLoad: e.lastWeekLoad,
      percentageOf1RM: e.percentageOf1RM,
      bias: e.bias ?? undefined,
      category: e.category ?? undefined,
    });
    const daysSource = Array.isArray(p.days) ? p.days : [];
    setFormData((f) => ({
      ...f,
      name: p.name ? `${p.name} (copy)` : 'Copied Program',
      goal: p.goal || 'general_fitness',
      duration_weeks: p.duration_weeks != null ? String(p.duration_weeks) : '4',
      isCompPrep: !!p.isCompPrep,
      division: p.division || '',
    }));
    setDays(daysSource.length ? daysSource.map((d) => ({
      id: nextId('d'),
      dayName: d.dayName || '',
      exercises: (d.exercises || []).map(mapExercise),
    })) : [defaultDay()]);
    setEntryMode('build');
    setEntryPicker(null);
  };

  const generateDaysFromSplit = (split) => {
    if (split === 'push_pull_legs') {
      return [
        { id: nextId('d'), dayName: 'Push', exercises: [] },
        { id: nextId('d'), dayName: 'Pull', exercises: [] },
        { id: nextId('d'), dayName: 'Legs', exercises: [] },
      ];
    }
    if (split === 'upper_lower') {
      return [
        { id: nextId('d'), dayName: 'Upper A', exercises: [] },
        { id: nextId('d'), dayName: 'Lower A', exercises: [] },
        { id: nextId('d'), dayName: 'Upper B', exercises: [] },
        { id: nextId('d'), dayName: 'Lower B', exercises: [] },
      ];
    }
    return [
      { id: nextId('d'), dayName: 'Day 1', exercises: [] },
      { id: nextId('d'), dayName: 'Day 2', exercises: [] },
      { id: nextId('d'), dayName: 'Day 3', exercises: [] },
    ];
  };

  const handleSplitChange = (value) => {
    setBlockSplitType(value);
    setDays(generateDaysFromSplit(value));
    toast.success('Days auto-generated');
  };

  useEffect(() => {
    if (typeof setHeaderTitle === 'function') setHeaderTitle(programId ? 'Edit Program' : 'New Program');
  }, [programId, setHeaderTitle]);

  const canSave = formData.name?.trim() && !(saveState === 'saving');
  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast.error('Program name is required');
      return;
    }
    const parsedDuration = formData.duration_weeks === '' ? null : Number(formData.duration_weeks);
    if (parsedDuration == null || parsedDuration < 1 || parsedDuration > 52) {
      toast.error('Duration must be between 1 and 52 weeks');
      return;
    }
    setSaveState('saving');
    const exercisePayload = (e) => ({
      id: e.id,
      exerciseId: e.exerciseId || '',
      name: e.name || '',
      sets: e.sets === '' ? 0 : Number(e.sets) || 0,
      reps: typeof e.reps === 'string' ? e.reps : String(e.reps ?? ''),
      rir: e.rir === '' ? 0 : Number(e.rir) ?? 0,
      rpe: e.rpe === '' ? undefined : (Number(e.rpe) || undefined),
      restSeconds: e.restSeconds === '' ? 0 : Number(e.restSeconds) || 0,
      tempo: e.tempo || '',
      notes: e.notes || '',
      groupId: e.groupId || '',
      progressionRule: e.progressionRule || 'none',
      progressionNotes: e.progressionNotes || '',
      targetLoad: (e.targetLoad !== '' && e.targetLoad != null) ? Number(e.targetLoad) : undefined,
      lastWeekLoad: (e.lastWeekLoad !== '' && e.lastWeekLoad != null) ? Number(e.lastWeekLoad) : undefined,
      percentageOf1RM: (e.percentageOf1RM !== '' && e.percentageOf1RM != null) ? Number(e.percentageOf1RM) : undefined,
      bias: e.bias || undefined,
      category: e.category || undefined,
    });
    const daysPayload = days.map((d) => ({
      id: d.id,
      dayName: d.dayName || 'Day',
      exercises: (d.exercises || []).map(exercisePayload),
    }));

    const payload = {
      ...(programId ? { id: programId } : {}),
      name: formData.name,
      goal: formData.goal,
      duration_weeks: parsedDuration,
      isCompPrep: !!formData.isCompPrep,
      division: formData.division || undefined,
    };
    if (formData.usePhases) {
      payload.phases = [{
        id: nextId('phase'),
        name: formData.phaseName || 'Phase 1',
        durationWeeks: Number(formData.phaseDurationWeeks) || 4,
        weeks: [{ id: nextId('w'), days: daysPayload }],
      }];
    } else {
      payload.days = daysPayload;
    }
    const saved = saveProgram(payload);
    setSaveState('saved');
    const effectiveAssignToId = assignToClientId || (isPersonalUser ? user?.id : null);
    if (effectiveAssignToId) {
      const effectiveDate = new Date().toISOString().slice(0, 10);
      assignProgramToClient(effectiveAssignToId, saved.id, effectiveDate);
      addProgramChangeLog({ clientId: effectiveAssignToId, programId: saved.id, programName: saved.name, effectiveDate, action: 'assigned' });
      logAuditEvent({ actorUserId: user?.id ?? 'demo-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: saved.id, action: 'program_assigned', after: { clientId: effectiveAssignToId, programId: saved.id, programName: saved.name, effectiveDate } });
      if (isPersonalUser) {
        toast.success('Program saved to your plan!');
        navigate('/myprogram', { replace: true });
      } else {
        toast.success('Program saved and assigned to client!');
        navigate(`/clients/${effectiveAssignToId}?tab=program`, { replace: true });
      }
    } else {
      toast.success('Program saved!');
      if (!programId) navigate(`/programbuilder?id=${saved.id}`, { replace: true });
    }
  };

  useEffect(() => {
    if (typeof setHeaderRight !== 'function') return;
    setHeaderRight(
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: colors.muted }}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...HEADER_SAVE_STYLE,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? 'pointer' : 'default',
          }}
        >
          Save
        </button>
      </div>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, canSave, saveState]);

  const addDay = () => setDays((d) => [...d, defaultDay()]);
  const removeDay = (index) => setDays((d) => d.filter((_, i) => i !== index));
  const setDay = (index, field, value) =>
    setDays((d) => d.map((day, i) => (i === index ? { ...day, [field]: value } : day)));

  const addExercise = (dayIndex) =>
    setDays((d) =>
      d.map((day, i) =>
        i === dayIndex ? { ...day, exercises: [...(day.exercises || []), defaultExercise()] } : day
      )
    );
  const addExerciseAndPick = (dayIndex) => {
    const newEx = defaultExercise();
    setDays((d) =>
      d.map((day, i) =>
        i === dayIndex ? { ...day, exercises: [...(day.exercises || []), newEx] } : day
      )
    );
    setPickerTarget({ dayIndex, exIndex: (days[dayIndex]?.exercises || []).length });
    setPickerOpen(true);
  };
  const removeExercise = (dayIndex, exIndex) =>
    setDays((d) =>
      d.map((day, i) =>
        i === dayIndex ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) } : day
      )
    );
  const setExercise = (dayIndex, exIndex, field, value) =>
    setDays((d) =>
      d.map((day, i) => {
        if (i !== dayIndex) return day;
        const exercises = (day.exercises || []).map((ex, j) =>
          j === exIndex ? { ...ex, [field]: value } : ex
        );
        if (field === 'restSeconds' && day.exercises?.[exIndex]?.groupId) {
          const gid = day.exercises[exIndex].groupId;
          const valStr = typeof value === 'number' ? String(value) : value;
          return {
            ...day,
            exercises: exercises.map((ex, j) =>
              ex.groupId === gid ? { ...ex, restSeconds: valStr } : ex
            ),
          };
        }
        return { ...day, exercises };
      })
    );

  const reorderExercises = (dayIndex, startIndex, endIndex) => {
    if (startIndex === endIndex) return;
    setDays((d) =>
      d.map((day, i) => {
        if (i !== dayIndex) return day;
        const exs = [...(day.exercises || [])];
        const [removed] = exs.splice(startIndex, 1);
        exs.splice(endIndex, 0, removed);
        return { ...day, exercises: exs };
      })
    );
  };

  const duplicateDay = (dayIndex) => {
    const day = days[dayIndex];
    if (!day) return;
    const newDay = {
      ...defaultDay(),
      dayName: (day.dayName || 'Day') + ' (copy)',
      exercises: (day.exercises || []).map((e) => ({ ...defaultExercise(), ...e, id: nextId('e'), name: e.name, exerciseId: e.exerciseId })),
    };
    setDays((d) => [...d.slice(0, dayIndex + 1), newDay, ...d.slice(dayIndex + 1)]);
    toast.success('Day duplicated');
  };

  const duplicateExercise = (dayIndex, exIndex) => {
    const day = days[dayIndex];
    const ex = day?.exercises?.[exIndex];
    if (!day || !ex) return;
    const copy = { ...defaultExercise(), ...ex, id: nextId('e'), name: ex.name, exerciseId: ex.exerciseId, sets: ex.sets, reps: ex.reps, rir: ex.rir, rpe: ex.rpe, restSeconds: ex.restSeconds, tempo: ex.tempo, notes: ex.notes, groupId: '', progressionRule: ex.progressionRule ?? 'none', progressionNotes: ex.progressionNotes ?? '', targetLoad: ex.targetLoad, lastWeekLoad: ex.lastWeekLoad, percentageOf1RM: ex.percentageOf1RM, bias: ex.bias, category: ex.category };
    setDays((d) =>
      d.map((day, i) =>
        i !== dayIndex
          ? day
          : { ...day, exercises: [...(day.exercises || []).slice(0, exIndex + 1), copy, ...(day.exercises || []).slice(exIndex + 1)] }
      )
    );
    toast.success('Exercise duplicated');
  };

  const groupAsSuperset = (dayIndex, exIndex) => {
    const day = days[dayIndex];
    const exercises = day?.exercises || [];
    const ex = exercises[exIndex];
    if (!day || !ex) return;
    const used = new Set((exercises.map((e) => e.groupId).filter(Boolean)));
    const nextLetter = ['A', 'B', 'C'].find((l) => !used.has(l)) || 'A';
    const nextIndex = exIndex + 1;
    setDays((d) =>
      d.map((day, i) => {
        if (i !== dayIndex) return day;
        const exs = day.exercises || [];
        const updated = exs.map((e, j) => {
          if (j === exIndex) return { ...e, groupId: nextLetter };
          if (j === nextIndex && nextIndex < exs.length) return { ...e, groupId: nextLetter, restSeconds: ex.restSeconds || e.restSeconds };
          return e;
        });
        return { ...day, exercises: updated };
      })
    );
    toast.success('Grouped as superset');
  };

  const addDayFromTemplate = (dayIndex, template) => {
    const day = template?.day;
    if (!day) return;
    const newDay = {
      id: nextId('d'),
      dayName: day.dayName || 'Day',
      exercises: (day.exercises || []).map((e) => ({
        ...defaultExercise(),
        ...e,
        id: nextId('e'),
        exerciseId: e.exerciseId ?? '',
        name: e.name ?? '',
        sets: e.sets != null ? String(e.sets) : '3',
        reps: e.reps != null ? String(e.reps) : '10',
        rir: e.rir != null ? String(e.rir) : '2',
        rpe: e.rpe != null ? String(e.rpe) : '',
        restSeconds: e.restSeconds != null ? String(e.restSeconds) : '90',
        tempo: e.tempo ?? '',
        notes: e.notes ?? '',
        groupId: e.groupId ?? '',
        progressionRule: e.progressionRule ?? 'none',
        progressionNotes: e.progressionNotes ?? '',
        targetLoad: e.targetLoad,
        lastWeekLoad: e.lastWeekLoad,
        percentageOf1RM: e.percentageOf1RM,
        bias: e.bias ?? undefined,
        category: e.category ?? undefined,
      })),
    };
    setDays((d) => [...d.slice(0, dayIndex + 1), newDay, ...d.slice(dayIndex + 1)]);
    setDayTemplateContext(null);
    toast.success('Day added from template');
  };

  const toggleDayCollapsed = (dayIndex) => setDayCollapsed((prev) => ({ ...prev, [dayIndex]: !prev[dayIndex] }));

  const handleSelectExercise = (libraryExercise) => {
    if (!libraryExercise || pickerTarget == null) return;
    impactLight();
    const { dayIndex, exIndex } = pickerTarget;
    setExercise(dayIndex, exIndex, 'exerciseId', libraryExercise.id);
    setExercise(dayIndex, exIndex, 'name', libraryExercise.name);
    setActiveExerciseKey(days[dayIndex]?.exercises?.[exIndex]?.id ?? null);
    setPickerOpen(false);
    setPickerTarget(null);
  };

  const handleAssignToClient = () => {
    if (!assignToClientId || !programId) return;
    const prog = getProgramById(programId);
    assignProgramToClient(assignToClientId, programId);
    logAuditEvent({ actorUserId: user?.id ?? 'demo-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: programId, action: 'program_assigned', after: { clientId: assignToClientId, programId, programName: prog?.name } });
    toast.success(`Program assigned to ${clientForAssign?.full_name || 'client'}`);
    if (user?.user_type === 'personal' || user?.user_type === 'solo') {
      navigate('/myprogram', { replace: true });
    } else {
      navigate(`/clients/${assignToClientId}`);
    }
  };

  const inputClass = 'w-full rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-white/20 min-w-0 border-0';
  const inputStyle = { color: colors.text, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 16 };
  const sep = 'rgba(255,255,255,0.06)';
  const v = (n) => Math.round(n * 0.75); // compact vertical rhythm (~25% reduction)
  const pad = v(16);
  const gap = v(10);

  if (!entryMode) {
    return (
      <div
        className="app-screen app-section min-w-0 max-w-full flex flex-col overflow-x-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
      >
        <div className="py-5">
          <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: colors.muted }}>Create Program</p>
          <h1 className="text-[22px] font-semibold mb-4" style={{ color: colors.text }}>Choose how you want to start</h1>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => { setEntryMode('build'); setEntryPicker(null); }}
              className="w-full rounded-xl px-4 py-4 text-left"
              style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.03)', minHeight: 64 }}
            >
              <p className="text-[15px] font-semibold" style={{ color: colors.text }}>Build from scratch</p>
              <p className="text-[12px]" style={{ color: colors.muted }}>Start clean and create your block quickly.</p>
            </button>
            <button
              type="button"
              onClick={() => setEntryPicker(entryPicker === 'template' ? null : 'template')}
              className="w-full rounded-xl px-4 py-4 text-left"
              style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.03)', minHeight: 64 }}
            >
              <p className="text-[15px] font-semibold" style={{ color: colors.text }}>Use template</p>
              <p className="text-[12px]" style={{ color: colors.muted }}>Start from a saved template.</p>
            </button>
            <button
              type="button"
              onClick={() => setEntryPicker(entryPicker === 'duplicate' ? null : 'duplicate')}
              className="w-full rounded-xl px-4 py-4 text-left"
              style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.03)', minHeight: 64 }}
            >
              <p className="text-[15px] font-semibold" style={{ color: colors.text }}>Duplicate program</p>
              <p className="text-[12px]" style={{ color: colors.muted }}>Copy an existing program and edit.</p>
            </button>
          </div>

          {entryPicker === 'template' && (
            <div className="mt-4 rounded-xl p-3" style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: colors.muted }}>Templates</p>
              <div className="space-y-2">
                {availableTemplates.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => loadProgramIntoBuilder(t.program)}
                    className="w-full text-left rounded-lg px-3 py-2"
                    style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.03)', color: colors.text, minHeight: 44 }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entryPicker === 'duplicate' && (
            <div className="mt-4 rounded-xl p-3" style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: colors.muted }}>Existing Programs</p>
              <div className="space-y-2">
                {availablePrograms.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadProgramIntoBuilder(p)}
                    className="w-full text-left rounded-lg px-3 py-2"
                    style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.03)', color: colors.text, minHeight: 44 }}
                  >
                    {p.name || 'Untitled program'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-screen app-section min-w-0 max-w-full flex flex-col overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: '100%',
      }}
    >
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          paddingBottom: pad,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
      {assignToClientId && clientForAssign && programId && (
        <div className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: `1px solid ${sep}` }}>
          <div>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: colors.muted }}>Assigning to</p>
            <p className="text-[15px] font-medium" style={{ color: colors.text }}>{clientForAssign.full_name || 'Client'}</p>
          </div>
          <Button variant="primary" size="sm" onClick={handleAssignToClient}>
            <Users size={18} style={{ marginRight: 6 }} /> Assign
          </Button>
        </div>
      )}

      {/* Block Setup */}
      <section className="py-4" style={{ borderBottom: `1px solid ${sep}` }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Block Setup</h2>
        <div className="space-y-4" style={{ gap: gap }}>
          <div>
            <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Block name</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 4-Week Upper/Lower Block"
              className={inputClass}
              style={{ ...inputStyle, fontSize: 16 }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Number of weeks</label>
              <select
                value={formData.duration_weeks}
                onChange={(e) => setFormData((f) => ({ ...f, duration_weeks: e.target.value }))}
                className={inputClass}
                style={{ ...inputStyle, width: '100%', fontSize: 16 }}
              >
                {[1, 2, 3, 4, 5, 6].map((w) => (
                  <option key={w} value={String(w)}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Split type</label>
              <select
                value={blockSplitType}
                onChange={(e) => handleSplitChange(e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, width: '100%', fontSize: 16 }}
              >
                <option value="push_pull_legs">Push Pull Legs</option>
                <option value="upper_lower">Upper Lower</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ border: `1px solid ${sep}`, background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: colors.muted }}>Auto-generated days</p>
            <div className="flex flex-wrap gap-2">
              {days.map((d, idx) => (
                <span key={d.id || idx} className="text-[12px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: colors.text }}>
                  {d.dayName || `Day ${idx + 1}`}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Goal</label>
            <select value={formData.goal} onChange={(e) => setFormData((f) => ({ ...f, goal: e.target.value }))} className={inputClass} style={{ ...inputStyle, width: '100%', fontSize: 16 }}>
              {GOALS.map((g) => <option key={g} value={g}>{(g || '').replace('_', ' ')}</option>)}
            </select>
          </div>
          {showCompPrepFields && (
            <div className="space-y-2 pl-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!formData.isCompPrep} onChange={(e) => setFormData((f) => ({ ...f, isCompPrep: e.target.checked }))} className="rounded" style={{ accentColor: colors.accent }} />
                <span className="text-[13px]" style={{ color: colors.text }}>Comp prep</span>
              </label>
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Division</label>
                <input value={formData.division} onChange={(e) => setFormData((f) => ({ ...f, division: e.target.value }))} placeholder="e.g. Men's Physique" className={inputClass} style={{ ...inputStyle, fontSize: 16 }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Day cards */}
      <section className="py-4" style={{ borderBottom: `1px solid ${sep}` }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>Day Cards</h2>
          <button type="button" onClick={addDay} className="text-[12px] font-medium px-2 py-1 rounded" style={{ color: colors.muted, background: 'rgba(255,255,255,0.06)' }}>
            <Plus size={18} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add day
          </button>
        </div>

      {days.map((day, dayIndex) => {
        const exercises = day.exercises || [];
        const groupOrder = {};
        exercises.forEach((ex, i) => {
          const g = ex.groupId || null;
          if (g) {
            if (groupOrder[g] == null) groupOrder[g] = [];
            groupOrder[g].push(i);
          }
        });
        const getGroupLabel = (exIndex) => {
          for (const g of Object.keys(groupOrder)) {
            const idx = groupOrder[g].indexOf(exIndex);
            if (idx >= 0) return `${g}${idx + 1}`;
          }
          return null;
        };

        const isCollapsed = dayCollapsed[dayIndex];
        return (
          <div key={day.id} className="mb-3" style={{ border: `1px solid ${sep}`, borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
            <div
              className="flex items-center gap-2 py-2 px-3 w-full text-left"
              style={{ minHeight: 48, borderBottom: isCollapsed ? 'none' : `1px solid ${sep}` }}
            >
              <span className="flex-shrink-0 cursor-grab" style={{ color: colors.muted }} {...(isCollapsed ? {} : {})}><GripVertical size={18} /></span>
              <button type="button" onClick={() => toggleDayCollapsed(dayIndex)} className="flex-shrink-0 p-0.5" style={{ color: colors.muted }} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: colors.text }}>
                  Day {dayIndex + 1} - {day.dayName || 'Session'}
                </p>
                <input
                  value={day.dayName}
                  onChange={(e) => setDay(dayIndex, 'dayName', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Rename day"
                  className="w-full min-w-0 text-[12px] bg-transparent border-none focus:outline-none focus:ring-0 mt-0.5 p-0"
                  style={{ color: colors.muted }}
                />
              </div>
              <button
                type="button"
                onClick={() => addExerciseAndPick(dayIndex)}
                className="text-[11px] font-semibold px-2 py-1 rounded flex items-center gap-1"
                style={{ minHeight: 36, color: colors.accent, background: 'rgba(37,99,235,0.12)' }}
              >
                <Plus size={14} /> Add exercise
              </button>
              <div className="relative flex-shrink-0">
                <button type="button" onClick={(e) => { e.stopPropagation(); setDayMenuOpen(dayMenuOpen === dayIndex ? null : dayIndex); }} className="p-1.5 rounded" style={{ color: colors.muted }} aria-label="Day menu">
                  <MoreVertical size={18} />
                </button>
                {dayMenuOpen === dayIndex && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDayMenuOpen(null)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[160px] border" style={{ background: colors.bg, borderColor: sep }}>
                      <button type="button" onClick={() => { setDayTemplateContext({ dayIndex }); setDayMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.text }}>Add day from template</button>
                      <button type="button" onClick={() => { saveDayAsTemplate(trainerId, day); toast.success('Day saved as template'); setDayMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.text }}>Save as template</button>
                      <button type="button" onClick={() => { duplicateDay(dayIndex); setDayMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.text }}>Duplicate day</button>
                      {days.length > 1 && (
                        <button type="button" onClick={() => { removeDay(dayIndex); setDayMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.destructive }}>Delete day</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {!isCollapsed && (
            <div className="px-2 pb-2">
            <p className="text-[11px] px-2 py-1" style={{ color: colors.muted }}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</p>
            <DragDropContext onDragEnd={(result) => { if (result.destination && result.destination.droppableId === `day-${dayIndex}`) reorderExercises(dayIndex, result.source.index, result.destination.index); }}>
              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0">
                    {exercises.map((ex, exIndex) => {
                      const groupLabel = getGroupLabel(exIndex);
                      const libEx = ex.exerciseId ? getLibraryExerciseById(ex.exerciseId, trainerId) : null;
                      const muscleLabel = libEx?.primaryMuscleGroup ?? '';
                      const equipLabel = (libEx?.equipment || []).slice(0, 2).join(', ');
                      const isRowExpanded = exExpanded[ex.id];
                      return (
                        <Draggable key={ex.id} draggableId={ex.id} index={exIndex}>
                          {(providedDrag) => (
                            <div
                              ref={providedDrag.innerRef}
                              {...providedDrag.draggableProps}
                              className="py-2 px-2 rounded"
                              style={{ borderBottom: `1px solid ${sep}`, ...providedDrag.draggableProps.style }}
                            >
                              <button
                                type="button"
                                onClick={() => setExExpanded((p) => ({ ...p, [ex.id]: !p[ex.id] }))}
                                className="w-full flex items-center gap-2 min-w-0 text-left"
                                style={{ background: 'transparent', border: 'none', color: 'inherit', padding: 0 }}
                              >
                                <span {...providedDrag.dragHandleProps} className="flex-shrink-0 cursor-grab" style={{ color: colors.muted }}><GripVertical size={18} /></span>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-[15px] font-semibold truncate" style={{ color: colors.text }}>{ex.name || 'Select exercise'}</p>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {muscleLabel && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: colors.muted }}>{muscleLabel}</span>}
                                    {equipLabel && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: colors.muted }}>{equipLabel}</span>}
                                    {groupLabel && programAdvancedMode && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.2)', color: colors.accent }}>{groupLabel}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-[12px]" style={{ color: colors.muted }}>
                                    {ex.sets}×{ex.reps} · {ex.restSeconds || 90}s rest
                                  </span>
                                  <span className="p-1 rounded" style={{ color: colors.muted }} aria-hidden>
                                    {isRowExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                  </span>
                                </div>
                              </button>
                              <div className="flex items-center justify-end mt-1.5 gap-1">
                                <button type="button" onClick={() => { setPickerTarget({ dayIndex, exIndex }); setPickerOpen(true); }} className="text-[11px] font-medium px-2 py-1 rounded" style={{ color: colors.accent }}>
                                  {ex.name ? 'Replace' : 'Select'}
                                </button>
                                  {programAdvancedMode && (
                                    <div className="relative">
                                      <button type="button" onClick={() => setExMenuOpen(exMenuOpen?.dayIndex === dayIndex && exMenuOpen?.exIndex === exIndex ? null : { dayIndex, exIndex })} className="p-1 rounded" style={{ color: colors.muted }}><MoreVertical size={18} /></button>
                                      {exMenuOpen?.dayIndex === dayIndex && exMenuOpen?.exIndex === exIndex && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setExMenuOpen(null)} />
                                          <div className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[140px] border" style={{ background: colors.bg, borderColor: sep }}>
                                            <button type="button" onClick={() => { groupAsSuperset(dayIndex, exIndex); setExMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.text }}>Group superset</button>
                                            <button type="button" onClick={() => { setPickerTarget({ dayIndex, exIndex }); setPickerOpen(true); setExMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.text }}>Replace</button>
                                            <button type="button" onClick={() => { duplicateExercise(dayIndex, exIndex); setExMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.text }}>Duplicate</button>
                                            <button type="button" onClick={() => { removeExercise(dayIndex, exIndex); setExMenuOpen(null); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: colors.destructive }}>Remove</button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {!programAdvancedMode && (
                                    <button type="button" onClick={() => removeExercise(dayIndex, exIndex)} className="p-1 rounded" style={{ color: colors.muted }} aria-label="Remove"><Trash2 size={18} /></button>
                                  )}
                              </div>
                              {/* Expanded: Sets/Reps/RPE inputs, Rest, Tempo, Notes, Progression */}
                              {isRowExpanded && (
                                <div className="mt-2 ml-8 pt-2 space-y-2" style={{ borderTop: `1px solid ${sep}` }}>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-[10px] w-5" style={{ color: colors.muted }}>Sets</span>
                                      <button type="button" onClick={() => setExercise(dayIndex, exIndex, 'sets', String(Math.max(0, (Number(ex.sets) || 0) - 1)))} className="w-6 h-6 rounded-l flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: colors.text }}>−</button>
                                      <input type="text" inputMode="numeric" value={ex.sets} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v)) setExercise(dayIndex, exIndex, 'sets', v); }} onBlur={(e) => { if (e.target.value === '') setExercise(dayIndex, exIndex, 'sets', '0'); }} className="w-8 h-6 text-center border-y" style={{ ...inputStyle, fontSize: 16, borderColor: sep }} />
                                      <button type="button" onClick={() => setExercise(dayIndex, exIndex, 'sets', String((Number(ex.sets) || 0) + 1))} className="w-6 h-6 rounded-r flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: colors.text }}>+</button>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-[10px] w-5" style={{ color: colors.muted }}>Reps</span>
                                      <input type="text" inputMode="numeric" value={ex.reps} onChange={(e) => setExercise(dayIndex, exIndex, 'reps', e.target.value)} placeholder="10" className="w-10 h-6 rounded px-1 text-center" style={{ ...inputStyle, fontSize: 16 }} />
                                    </div>
                                    {programAdvancedMode && (
                                      <div className="flex items-center gap-0.5">
                                        <span className="text-[10px]" style={{ color: colors.muted }}>RPE</span>
                                        <input type="text" inputMode="numeric" value={ex.rpe} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v) || v === '') setExercise(dayIndex, exIndex, 'rpe', v); }} placeholder="—" className="w-7 h-6 rounded px-1 text-center" style={{ ...inputStyle, fontSize: 16 }} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] w-8" style={{ color: colors.muted }}>Rest</span>
                                    <input type="text" inputMode="numeric" value={ex.restSeconds} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v)) setExercise(dayIndex, exIndex, 'restSeconds', v); }} onBlur={(e) => { if (e.target.value === '') setExercise(dayIndex, exIndex, 'restSeconds', '0'); }} placeholder="90" className="w-12 h-6 rounded px-1 text-center" style={{ ...inputStyle, fontSize: 16 }} title="sec" />
                                    <span className="text-[10px] w-10" style={{ color: colors.muted }}>Tempo</span>
                                    <input type="text" value={ex.tempo} onChange={(e) => setExercise(dayIndex, exIndex, 'tempo', e.target.value)} placeholder="3-1-2-0" className="w-20 h-6 rounded px-1" style={{ ...inputStyle, fontSize: 16 }} />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] mb-1" style={{ color: colors.muted }}>Notes</label>
                                    <textarea value={ex.notes} onChange={(e) => setExercise(dayIndex, exIndex, 'notes', e.target.value)} placeholder="Exercise notes…" rows={2} className="w-full rounded px-2 py-1 min-w-0" style={{ ...inputStyle, fontSize: 16, resize: 'vertical' }} />
                                  </div>
                                  {programAdvancedMode && (ex.progressionRule !== 'none' || ex.progressionNotes || ex.targetLoad != null) && (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select value={ex.progressionRule} onChange={(e) => setExercise(dayIndex, exIndex, 'progressionRule', e.target.value)} className="h-6 rounded px-2 text-[13px]" style={{ ...inputStyle, fontSize: 16 }}>
                                        {PROGRESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                      </select>
                                      <input type="text" value={ex.progressionNotes ?? ''} onChange={(e) => setExercise(dayIndex, exIndex, 'progressionNotes', e.target.value)} placeholder="Notes" className="w-24 h-6 rounded px-2 text-[13px]" style={{ ...inputStyle, fontSize: 16 }} />
                                      <input type="text" inputMode="numeric" value={ex.targetLoad ?? ''} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setExercise(dayIndex, exIndex, 'targetLoad', v === '' ? undefined : v); }} placeholder="Target" className="w-14 h-6 rounded px-2 text-center text-[13px]" style={{ ...inputStyle, fontSize: 16 }} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    <button type="button" onClick={() => addExerciseAndPick(dayIndex)} className="w-full py-2.5 mt-1 text-[13px] font-medium rounded flex items-center justify-center gap-1.5" style={{ color: colors.muted, border: `1px dashed ${sep}` }}>
                      <Plus size={18} /> Add exercise
                    </button>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            </div>
            )}
          </div>
        );
      })}
      </section>

      </div>

      <div
        className="sticky bottom-0 left-0 right-0 flex-shrink-0"
        style={{
          paddingTop: gap,
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          background: colors.bg,
          borderTop: `1px solid ${sep}`,
          display: 'flex',
          flexDirection: 'column',
          gap: gap,
        }}
      >
        <Button variant="primary" onClick={handleSave} disabled={!canSave} style={{ width: '100%', fontSize: 16 }} className="min-h-[50px]">
          <Save size={18} style={{ marginRight: 8 }} />
          {saveState === 'saving' ? 'Saving...' : 'Save Program'}
        </Button>
        <button
          type="button"
          onClick={() => setShowProgramTemplateModal(true)}
          className="text-[14px] font-medium py-2 rounded flex items-center justify-center gap-1.5 min-h-[44px]"
          style={{ color: colors.text, background: 'transparent', border: `1px solid ${sep}` }}
        >
          <Bookmark size={18} /> Save as Template
        </button>
        <button
          type="button"
          onClick={() => { impactLight(); setShowPreview(true); }}
          className="text-[13px] font-medium py-2 rounded flex items-center justify-center gap-1.5 min-h-[44px]"
          style={{ color: colors.muted, background: 'transparent' }}
        >
          <Eye size={18} /> Preview week
        </button>
      </div>

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
        onSelect={handleSelectExercise}
        coachId={trainerId}
        isTrainer={true}
        replaceForExerciseId={pickerTarget != null ? (days[pickerTarget.dayIndex]?.exercises?.[pickerTarget.exIndex]?.exerciseId || null) : null}
        showRecentSection={programAdvancedMode}
      />

      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top, 0)', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: colors.border }}>
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>Weekly plan preview</h2>
            <button type="button" onClick={() => setShowPreview(false)} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl p-3" style={{ border: `1px solid ${colors.border}`, background: colors.card }}>
              <p className="text-sm font-semibold" style={{ color: colors.text }}>{formData.name || 'Untitled block'}</p>
              <p className="text-xs mt-1" style={{ color: colors.muted }}>
                {days.length} day split · {formData.duration_weeks || '—'} weeks
              </p>
            </div>
            {days.map((day, i) => (
              <div key={day.id} className="rounded-xl border p-3" style={{ borderColor: colors.border, background: colors.card }}>
                <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Day {i + 1} - {day.dayName || `Session ${i + 1}`}</p>
                <div className="space-y-1.5">
                  {(day.exercises || []).map((ex, idx) => (
                    <div key={ex.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-sm truncate" style={{ color: colors.text }}>{idx + 1}. {ex.name || 'Exercise'}</p>
                      <p className="text-xs whitespace-nowrap" style={{ color: colors.muted }}>{ex.sets}×{ex.reps} · {ex.restSeconds || 90}s</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dayTemplateContext != null && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top, 0)', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
          <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: colors.border }}>
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>Add day from template</h2>
            <button type="button" onClick={() => setDayTemplateContext(null)} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-2">
              {(getDayTemplates(trainerId) || []).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => addDayFromTemplate(dayTemplateContext.dayIndex, t)} className="w-full text-left py-3 px-3 rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDayTemplateContext(null)}
              className="w-full mt-3 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, color: colors.text }}
            >
              Continue with current day cards
            </button>
          </div>
        </div>
      )}

      {showProgramTemplateModal && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top, 0)', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
          <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: colors.border }}>
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>Save as template</h2>
            <button type="button" onClick={() => setShowProgramTemplateModal(false)} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="p-4">
            <p className="text-sm mb-4" style={{ color: colors.muted }}>Save the current program as a reusable template. You can then create new programs from it.</p>
            <Button variant="primary" onClick={() => { saveProgramAsTemplate(trainerId, { ...formData, days }); setShowProgramTemplateModal(false); toast.success('Program saved as template'); }} style={{ width: '100%' }}>
              Save as template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
