import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Plus, Search, Copy, Edit, Dumbbell, TrendingDown, Target, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  saveProgram,
  deleteProgram as deleteLocalProgram,
  getAssignmentCount,
  getProgramById,
  getPrograms as getLocalPrograms,
} from '@/lib/programsStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { ProgramsListSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import EmptyState from '@/components/ui/EmptyState';
import { captureUiError } from '@/services/errorLogger';
import { colors, spacing } from '@/ui/tokens';
import { usePresentationMode } from '@/lib/presentationMode';
import { desktopRhythm, chipPadding, cardContentRhythm } from '@/ui/pageLayout';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

const GOAL_OPTIONS = [
  { key: 'all', label: 'All Goals' },
  { key: 'strength', label: 'Strength' },
  { key: 'hypertrophy', label: 'Hypertrophy' },
  { key: 'fat_loss', label: 'Fat Loss' },
  { key: 'general_fitness', label: 'General Fitness' },
];
const goalIcons = { strength: Dumbbell, hypertrophy: TrendingDown, fat_loss: Target, general_fitness: Users };
const goalColors = {
  strength: '#EF4444',
  hypertrophy: '#3B82F6',
  fat_loss: '#22C55E',
  general_fitness: '#8B5CF6',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Programs() {
  const navigate = useNavigate();
  const { isDesktopWeb } = usePresentationMode();
  const rhythm = desktopRhythm(isDesktopWeb);
  const cardRhythm = cardContentRhythm(isDesktopWeb);
  const cardPad = isDesktopWeb ? spacing[20] : spacing[16];
  const goalChipPad = chipPadding({ desktop: isDesktopWeb, density: 'compact' });
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const data = useData();
  const trainerId = user?.id ?? 'local-trainer';
  const assignToClientId = searchParams.get('assignTo');
  const [search, setSearch] = useState('');
  const [goalFilter, setGoalFilter] = useState('all');
  const [initialLoad, setInitialLoad] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [clientForAssign, setClientForAssign] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [programsLoadError, setProgramsLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [programToDelete, setProgramToDelete] = useState(null);

  useEffect(() => {
    document.title = 'Programs — Atlas';
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setInitialLoad(false), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    setProgramsLoadError(false);
    data.listPrograms()
      .then((list) => {
        if (cancelled) return;
        const remote = Array.isArray(list) ? list : [];
        const supabaseBacked = hasSupabase && !!user?.id;
        if (supabaseBacked) {
          // Source-of-truth when authenticated: DB-backed list only.
          setPrograms(remote);
          return;
        }
        // Local-only mode: merge local seeded + runtime programs.
        const local = getLocalPrograms();
        const merged = [...remote];
        const seen = new Set(remote.map((p) => p?.id).filter(Boolean));
        for (const p of local) {
          if (p?.id && !seen.has(p.id)) merged.push(p);
        }
        setPrograms(merged);
      })
      .catch((err) => {
        if (!cancelled) {
          // Fall back to local programs for continuity in coach flow.
          setPrograms(getLocalPrograms());
          setProgramsLoadError(false);
          captureUiError('Programs', err);
        }
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => { cancelled = true; };
  }, [data, refreshKey, user?.id]);

  useEffect(() => {
    if (!assignToClientId) {
      setClientForAssign(null);
      return;
    }
    let cancelled = false;
    data.getClient(assignToClientId).then((c) => {
      if (!cancelled) setClientForAssign(c ?? null);
    }).catch(() => { if (!cancelled) setClientForAssign(null); });
    return () => { cancelled = true; };
  }, [assignToClientId, data]);

  const filteredPrograms = useMemo(() => {
    return (programs || []).filter((p) => {
      const matchesSearch = !search.trim() || (p.name || '').toLowerCase().includes(search.trim().toLowerCase());
      const matchesGoal = goalFilter === 'all' || p.goal === goalFilter;
      return matchesSearch && matchesGoal;
    });
  }, [programs, search, goalFilter]);

  const handleCreate = async () => {
    await lightHaptic();
    navigate('/program-builder');
  };

  const handleEdit = async (id, program) => {
    await lightHaptic();
    const clientId = program?.client_id ?? null;
    const blockId = id ?? program?.id ?? null;
    if (blockId && clientId) {
      navigate(`/program-builder?clientId=${encodeURIComponent(clientId)}&blockId=${encodeURIComponent(blockId)}`);
      return;
    }
    if (blockId) {
      navigate(`/program-builder?blockId=${encodeURIComponent(blockId)}`);
      return;
    }
    navigate('/program-builder');
  };

  const handleDuplicate = async (program) => {
    await lightHaptic();
    const copy = { ...program, id: undefined, name: `${program.name} (Copy)`, days: (program.days || []).map((d) => ({
      ...d,
      id: undefined,
      exercises: (d.exercises || []).map((e) => ({ ...e, id: undefined })),
    })) };
    saveProgram(copy);
    toast.success('Program duplicated!');
    navigate('/program-builder', { replace: true });
  };

  const handleAssignToClient = async (programId) => {
    if (!assignToClientId) return;
    await lightHaptic();
    const prog = programs.find((p) => p.id === programId) ?? getProgramById(programId);
    await data.assignProgramToClient(assignToClientId, programId);
    logAuditEvent({ actorUserId: user?.id ?? 'local-trainer', ownerTrainerUserId: trainerId, entityType: 'program_assignment', entityId: programId, action: 'program_assigned', after: { clientId: assignToClientId, programId, programName: prog?.name } });
    const { trackProgramAssigned } = await import('@/services/analyticsService');
    trackProgramAssigned({ client_id: assignToClientId, program_id: programId });
    toast.success(`Program assigned to ${clientForAssign?.full_name || 'client'}`);
    navigate(`/clients/${assignToClientId}`);
  };

  const handleDeleteConfirmed = useCallback(async (program) => {
    const programId = program?.id;
    if (!programId) return;
    await lightHaptic();
    try {
      const canDeleteRemoteBlock = UUID_RE.test(String(programId));
      if (hasSupabase && canDeleteRemoteBlock) {
        const supabase = getSupabase();
        if (!supabase) {
          throw new Error('Sync is still loading. Please try deleting again in a moment.');
        }
        const { error } = await supabase
          .from('program_blocks')
          .delete()
          .eq('id', programId);
        if (error) throw error;
      }
      deleteLocalProgram(programId);
      setPrograms((prev) => (Array.isArray(prev) ? prev.filter((p) => p?.id !== programId) : prev));
      setRefreshKey((k) => k + 1);
      toast.success('Program deleted');
    } catch (err) {
      toast.error(err?.message || 'Could not delete program');
    }
  }, []);

  return (
    <div
      className="app-screen app-section min-w-0 max-w-full overflow-x-hidden"
      style={{
        maxWidth: isDesktopWeb ? 1240 : undefined,
        margin: '0 auto',
        width: '100%',
        paddingTop: rhythm.top,
        paddingLeft: isDesktopWeb ? spacing[20] : 0,
        paddingRight: isDesktopWeb ? spacing[20] : 0,
      }}
    >
      {assignToClientId && clientForAssign && (
        <Card style={{ marginBottom: spacing[16], padding: isDesktopWeb ? spacing[16] : spacing[12] }}>
          <p className="text-[13px] font-medium" style={{ color: colors.muted, marginBottom: cardRhythm.titleBottom }}>Assigning to</p>
          <p className="text-[15px] font-semibold" style={{ color: colors.text, marginBottom: cardRhythm.titleBottom }}>{clientForAssign.full_name || 'Client'}</p>
          <p className="text-[12px] mt-1" style={{ color: colors.muted, marginTop: 0 }}>Tap a program below to assign it to this client.</p>
        </Card>
      )}

      <div style={{ marginBottom: rhythm.gutter }}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            <Search size={18} style={{ color: colors.muted }} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programs..."
            className="w-full pl-9 pr-3 py-2.5 text-sm placeholder:opacity-70 focus:outline-none focus:ring-1 rounded-[20px]"
            style={{
              color: colors.text,
              background: colors.card,
              border: `1px solid ${colors.border}`,
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: rhythm.section, minWidth: 0 }}>
        <select
          value={goalFilter}
          onChange={(e) => setGoalFilter(e.target.value)}
          className="w-full max-w-full rounded-[20px] text-sm py-2.5 px-3 focus:outline-none focus:ring-1 min-w-0"
          style={{
            color: colors.text,
            background: colors.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          {GOAL_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {(initialLoad || dataLoading) && <ProgramsListSkeleton count={4} />}

      {!initialLoad && !dataLoading && programsLoadError ? (
        <LoadErrorFallback
          title="Couldn't load programs"
          description="Check your connection and try again."
          onRetry={() => setRefreshKey((k) => k + 1)}
        />
      ) : !initialLoad && !dataLoading && filteredPrograms.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title={search || goalFilter !== 'all' ? 'No programs found' : 'No programs yet'}
          description={
            search || goalFilter !== 'all'
              ? 'Try adjusting your filters to find a program.'
              : 'Build your first program and assign it to a client.'
          }
          actionLabel={!search && goalFilter === 'all' ? 'Create a program' : undefined}
          onAction={!search && goalFilter === 'all' ? () => { void handleCreate(); } : undefined}
        />
      ) : !initialLoad && !dataLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: rhythm.gutter }}>
          {(filteredPrograms || []).map((program) => {
            const GoalIcon = goalIcons[program.goal] || Dumbbell;
            const goalColor = goalColors[program.goal] || colors.muted;
            const assignedCount = getAssignmentCount(program.id);
            return (
              <Card key={program.id} style={{ padding: cardPad }}>
                <div className="flex items-start justify-between gap-3" style={{ marginBottom: spacing[12] }}>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[15px] truncate" style={{ color: colors.text, marginBottom: cardRhythm.titleBottom }}>{program.name}</h3>
                    <div className="flex flex-wrap items-center gap-2" style={{ rowGap: isDesktopWeb ? spacing[8] : spacing[6] }}>
                      {program.goal && (
                        <span
                          className="rounded-full text-[10px] font-medium inline-flex items-center gap-1"
                          style={{ background: `${goalColor}22`, color: goalColor, ...goalChipPad }}
                        >
                          <GoalIcon size={12} />
                          {(program.goal || '').replace('_', ' ')}
                        </span>
                      )}
                      {program.duration_weeks && (
                        <span className="text-xs" style={{ color: colors.muted }}>{program.duration_weeks} weeks</span>
                      )}
                      <span className="text-xs" style={{ color: colors.muted }}>v{program.version ?? 1}</span>
                      <span className="text-xs" style={{ color: colors.muted }}>{program.updated_date ? new Date(program.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                      <span className="text-xs" style={{ color: colors.muted }}>{assignedCount} assigned</span>
                    </div>
                    {program.description && <p className="text-sm line-clamp-2" style={{ color: colors.muted, marginTop: cardRhythm.titleBottom }}>{program.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap" style={{ marginTop: cardRhythm.actionsTop }}>
                  <Button variant="secondary" onClick={() => handleEdit(program.id, program)} style={{ flex: 1, minWidth: 0 }}>
                    <Edit size={14} style={{ marginRight: 4 }} /> Edit
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(program)}
                    className="rounded-xl flex items-center justify-center"
                    style={{ minHeight: 44, minWidth: 44, background: 'rgba(255,255,255,0.08)', border: `1px solid ${colors.border}` }}
                    aria-label="Duplicate"
                  >
                    <Copy size={18} style={{ color: colors.muted }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgramToDelete(program)}
                    className="rounded-xl flex items-center justify-center"
                    style={{ minHeight: 44, minWidth: 44, background: colors.surface1, border: `1px solid ${colors.border}` }}
                    aria-label="Delete program"
                  >
                    <Trash2 size={18} style={{ color: colors.danger }} />
                  </button>
                  {assignToClientId && (
                    <Button variant="primary" onClick={() => handleAssignToClient(program.id)}>
                      Assign to Client
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {!initialLoad && !dataLoading && filteredPrograms.length > 0 && (
        <div style={{ marginTop: spacing[16] }}>
          <Button variant="primary" onClick={handleCreate} style={{ width: '100%' }}>
            <Plus size={18} style={{ marginRight: 8 }} /> Create Program
          </Button>
        </div>
      )}

      <div style={{ height: spacing[16] }} />
      <ConfirmDialog
        open={programToDelete !== null}
        title={`Delete "${programToDelete?.name || 'this program'}"?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { handleDeleteConfirmed(programToDelete); setProgramToDelete(null); }}
        onCancel={() => setProgramToDelete(null)}
      />
    </div>
  );
}
