import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, Users, Bookmark, X, MoreVertical, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getProgramById, saveProgram, assignProgramToClient } from '@/lib/programsStore';
import { getExerciseById as getLibraryExerciseById } from '@/data/exerciseLibrary';
import { saveProgramAsTemplate, getDayTemplates, saveDayAsTemplate } from '@/lib/programTemplatesStore';
import { addProgramChangeLog } from '@/lib/programChangeLogStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import { getClientById } from '@/data/selectors';
import { useAuth } from '@/lib/AuthContext';
import { GOALS, DIFFICULTIES } from '@/lib/programsStore';
import ExercisePickerModal from '@/components/programs/ExercisePickerModal';
import Button from '@/ui/Button';
import { Switch } from '@/components/ui/switch';
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
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
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
    difficulty: 'intermediate',
    description: '',
    trainer_notes: '',
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

  const program = programId ? getProgramById(programId) : null;
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
        difficulty: p.difficulty || 'intermediate',
        description: p.description || '',
        trainer_notes: p.trainer_notes || '',
        usePhases: hasPhases,
        phaseName: firstPhase?.name || 'Phase 1',
        phaseDurationWeeks: firstPhase?.durationWeeks != null ? String(firstPhase.durationWeeks) : '4',
        isCompPrep: !!p.isCompPrep,
        division: p.division || '',
      });
      setDays(daysSource.length ? daysSource.map(mapDay) : [defaultDay()]);
    } else {
      setFormData({
        name: '',
        goal: 'general_fitness',
        duration_weeks: '4',
        difficulty: 'intermediate',
        description: '',
        trainer_notes: '',
        usePhases: false,
        phaseName: 'Phase 1',
        phaseDurationWeeks: '4',
        isCompPrep: false,
        division: '',
      });
      setDays([defaultDay()]);
    }
  }, [programId]);

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
      difficulty: formData.difficulty,
      description: formData.description,
      trainer_notes: formData.trainer_notes,
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
    if (assignToClientId) {
      const effectiveDate = new Date().toISOString().slice(0, 10);
      assignProgramToClient(assignToClientId, saved.id, effectiveDate);
      addProgramChangeLog({ clientId: assignToClientId, programId: saved.id, programName: saved.name, effectiveDate, action: 'assigned' });
      logAuditEvent({ actorUserId: user?.id ?? 'demo-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: saved.id, action: 'program_assigned', after: { clientId: assignToClientId, programId: saved.id, programName: saved.name, effectiveDate } });
      toast.success('Program saved and assigned to client!');
      navigate(`/clients/${assignToClientId}?tab=program`, { replace: true });
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
    navigate(`/clients/${assignToClientId}`);
  };

  const inputClass = 'w-full rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-white/20 min-w-0 border-0';
  const inputStyle = { color: colors.text, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 16 };
  const sep = 'rgba(255,255,255,0.06)';
  const v = (n) => Math.round(n * 0.75); // compact vertical rhythm (~25% reduction)
  const pad = v(16);
  const gap = v(10);

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

      {/* Program Details — single flat panel */}
      <section className="py-4" style={{ borderBottom: `1px solid ${sep}` }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Program Details</h2>
        <div className="space-y-4" style={{ gap: gap }}>
          <div>
            <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Name</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 8-Week Hypertrophy Block"
              className={inputClass}
              style={{ ...inputStyle, fontSize: 16 }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Goal</label>
              <select value={formData.goal} onChange={(e) => setFormData((f) => ({ ...f, goal: e.target.value }))} className={inputClass} style={{ ...inputStyle, width: '100%', fontSize: 16 }}>
                {GOALS.map((g) => <option key={g} value={g}>{(g || '').replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Weeks</label>
              <input type="text" inputMode="numeric" value={formData.duration_weeks} onChange={(e) => { const val = e.target.value; if (/^\d*$/.test(val)) setFormData((f) => ({ ...f, duration_weeks: val })); }} placeholder="4" className={inputClass} style={{ ...inputStyle, fontSize: 16 }} />
            </div>
          </div>
          {programAdvancedMode && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.usePhases} onChange={(e) => setFormData((f) => ({ ...f, usePhases: e.target.checked }))} className="rounded" style={{ accentColor: colors.accent }} />
                <span className="text-[13px]" style={{ color: colors.text }}>Use phases</span>
              </label>
              {formData.usePhases && (
                <div className="grid grid-cols-2 gap-3 pl-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Phase name</label>
                    <input value={formData.phaseName} onChange={(e) => setFormData((f) => ({ ...f, phaseName: e.target.value }))} placeholder="Phase 1" className={inputClass} style={{ ...inputStyle, fontSize: 16 }} />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Phase weeks</label>
                    <input type="text" inputMode="numeric" value={formData.phaseDurationWeeks} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v)) setFormData((f) => ({ ...f, phaseDurationWeeks: v })); }} placeholder="4" className={inputClass} style={{ ...inputStyle, fontSize: 16 }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Difficulty</label>
            <select value={formData.difficulty} onChange={(e) => setFormData((f) => ({ ...f, difficulty: e.target.value }))} className={inputClass} style={{ ...inputStyle, fontSize: 16 }}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 py-2" style={{ borderTop: `1px solid ${sep}` }}>
            <div>
              <p className="text-[13px] font-medium" style={{ color: colors.text }}>Advanced mode</p>
              <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>RPE, tempo, rest, notes, progression</p>
            </div>
            <Switch checked={programAdvancedMode} onCheckedChange={(checked) => { impactLight(); setProgramAdvancedModeOn(checked); }} aria-label="Advanced mode" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder="What is this program about?" rows={2} className={inputClass} style={{ ...inputStyle, fontSize: 16, resize: 'vertical' }} />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.muted }}>Trainer notes</label>
            <textarea value={formData.trainer_notes} onChange={(e) => setFormData((f) => ({ ...f, trainer_notes: e.target.value }))} placeholder="Private notes…" rows={1} className={inputClass} style={{ ...inputStyle, fontSize: 16, resize: 'vertical' }} />
          </div>
          {programAdvancedMode && (
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

      {/* Days — collapsible panels */}
      <section className="py-4" style={{ borderBottom: `1px solid ${sep}` }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>Days</h2>
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
          <div key={day.id} className="mb-2" style={{ border: `1px solid ${sep}`, borderRadius: 8 }}>
            <div
              className="flex items-center gap-2 py-2 px-3 w-full text-left"
              style={{ minHeight: 44, borderBottom: isCollapsed ? 'none' : `1px solid ${sep}` }}
            >
              <span className="flex-shrink-0 cursor-grab" style={{ color: colors.muted }} {...(isCollapsed ? {} : {})}><GripVertical size={18} /></span>
              <button type="button" onClick={() => toggleDayCollapsed(dayIndex)} className="flex-shrink-0 p-0.5" style={{ color: colors.muted }} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              </button>
              <input
                value={day.dayName}
                onChange={(e) => setDay(dayIndex, 'dayName', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Day name"
                className="flex-1 min-w-0 text-[15px] font-medium bg-transparent border-none focus:outline-none focus:ring-0"
                style={{ color: colors.text, fontSize: 16 }}
              />
              <span className="text-[11px] flex-shrink-0" style={{ color: colors.muted }}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
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
                              <div className="flex items-center gap-2 min-w-0">
                                <span {...providedDrag.dragHandleProps} className="flex-shrink-0 cursor-grab" style={{ color: colors.muted }}><GripVertical size={18} /></span>
                                <button type="button" onClick={() => { setPickerTarget({ dayIndex, exIndex }); setPickerOpen(true); }} className="flex-1 text-left min-w-0">
                                  <p className="text-[15px] font-semibold truncate" style={{ color: colors.text }}>{ex.name || 'Select exercise'}</p>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {muscleLabel && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: colors.muted }}>{muscleLabel}</span>}
                                    {equipLabel && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: colors.muted }}>{equipLabel}</span>}
                                    {groupLabel && programAdvancedMode && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.2)', color: colors.accent }}>{groupLabel}</span>}
                                  </div>
                                </button>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-[12px]" style={{ color: colors.muted }}>{ex.sets}×{ex.reps}{programAdvancedMode && ex.rpe ? ` RPE${ex.rpe}` : ''}</span>
                                  <button type="button" onClick={() => { setPickerTarget({ dayIndex, exIndex }); setPickerOpen(true); }} className="text-[11px] font-medium px-2 py-1 rounded" style={{ color: colors.accent }}>Replace</button>
                                  <button type="button" onClick={() => setExExpanded((p) => ({ ...p, [ex.id]: !p[ex.id] }))} className="p-1 rounded" style={{ color: colors.muted }} aria-label={isRowExpanded ? 'Collapse' : 'Expand'}>
                                    {isRowExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
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
                    <button type="button" onClick={() => addExercise(dayIndex)} className="w-full py-2.5 mt-1 text-[13px] font-medium rounded flex items-center justify-center gap-1.5" style={{ color: colors.muted, border: `1px dashed ${sep}` }}>
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
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleSave} disabled={!canSave} style={{ flex: 1, fontSize: 16 }} className="min-h-[48px]">
            <Save size={18} style={{ marginRight: 8 }} />
            {saveState === 'saving' ? 'Saving...' : 'Save program'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              impactLight();
              if (days.length > 0) addExercise(0);
              else setDays((d) => [...d, { ...defaultDay(), exercises: [defaultExercise()] }]);
            }}
            style={{ flex: 0, fontSize: 15, minWidth: 44 }}
            className="min-h-[48px]"
            title="Add exercise to first day"
          >
            <Plus size={18} />
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowProgramTemplateModal(true)}
          className="text-[13px] font-medium py-2 rounded flex items-center justify-center gap-1.5 min-h-[44px]"
          style={{ color: colors.muted, background: 'transparent' }}
        >
          <Bookmark size={18} /> Template
        </button>
        <button
          type="button"
          onClick={() => { impactLight(); setShowPreview(true); }}
          className="text-[13px] font-medium py-2 rounded flex items-center justify-center gap-1.5 min-h-[44px]"
          style={{ color: colors.muted, background: 'transparent' }}
        >
          <Eye size={18} /> Preview
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
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>Program preview</h2>
            <button type="button" onClick={() => setShowPreview(false)} className="p-2 rounded-lg" style={{ color: colors.muted }} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-sm font-medium" style={{ color: colors.text }}>{formData.name || 'Untitled program'}</p>
            <p className="text-xs" style={{ color: colors.muted }}>{formData.goal?.replace('_', ' ')} · {formData.duration_weeks || '—'} weeks · {formData.difficulty}</p>
            {formData.description ? <p className="text-sm" style={{ color: colors.muted }}>{formData.description}</p> : null}
            {days.map((day, i) => (
              <div key={day.id} className="rounded-xl border p-3" style={{ borderColor: colors.border, background: colors.card }}>
                <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>{day.dayName || `Day ${i + 1}`}</p>
                <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
                  {(day.exercises || []).map((ex) => <li key={ex.id}>{ex.name || '—'} · {ex.sets}×{ex.reps}</li>)}
                </ul>
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
            {(getDayTemplates(trainerId) || []).length === 0 ? (
              <p className="text-sm py-4" style={{ color: colors.muted }}>No day templates yet. Save a day as template from the day menu.</p>
            ) : (
              <ul className="space-y-2">
                {getDayTemplates(trainerId).map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => addDayFromTemplate(dayTemplateContext.dayIndex, t)} className="w-full text-left py-3 px-3 rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}>
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
