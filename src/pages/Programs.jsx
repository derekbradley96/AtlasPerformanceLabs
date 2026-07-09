import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Plus, Search, Copy, Edit, Dumbbell, TrendingDown, Target, Users, Trash2, ClipboardList } from 'lucide-react';
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
import { desktopRhythm, cardContentRhythm } from '@/ui/pageLayout';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FeatureHelpButton from '@/components/ui/FeatureHelpButton';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

const GOAL_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'strength', label: 'Strength' },
  { key: 'hypertrophy', label: 'Hypertrophy' },
  { key: 'fat_loss', label: 'Fat Loss' },
  { key: 'general_fitness', label: 'General' },
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
  const { setHeaderRight } = useOutletContext() || {};
  const { isDesktopWeb } = usePresentationMode();

  // AJB tester feedback #7: Learn-more affordance on creation screens.
  useEffect(() => {
    if (typeof setHeaderRight !== 'function') return undefined;
    setHeaderRight(<FeatureHelpButton feature="programs" />);
    return () => setHeaderRight(null);
  }, [setHeaderRight]);
  const rhythm = desktopRhythm(isDesktopWeb);
  const cardRhythm = cardContentRhythm(isDesktopWeb);
  const cardPad = isDesktopWeb ? spacing[20] : spacing[16];
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
  const [assignmentCounts, setAssignmentCounts] = useState({});

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
      .then(async (list) => {
        if (cancelled) return;
        const remote = Array.isArray(list) ? list : [];
        const supabaseBacked = hasSupabase && !!user?.id;
        if (supabaseBacked) {
          setPrograms(remote);
          // Fetch assignment counts from Supabase
          if (remote.length > 0) {
            const supabase = getSupabase();
            if (supabase) {
              const ids = remote.map((p) => p.id).filter(Boolean);
              const { data: countRows } = await supabase
                .from('program_block_assignments')
                .select('program_block_id')
                .in('program_block_id', ids)
                .eq('is_active', true);
              if (!cancelled && Array.isArray(countRows)) {
                const counts = {};
                for (const row of countRows) {
                  counts[row.program_block_id] = (counts[row.program_block_id] || 0) + 1;
                }
                setAssignmentCounts(counts);
              }
            }
          }
          return;
        }
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
        paddingBottom: spacing[32],
      }}
    >
      {/* Page header with Create button */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: spacing[16] }}
      >
        <h1 className="font-bold text-[20px]" style={{ color: colors.text, margin: 0 }}>
          Programs
        </h1>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 font-semibold text-sm rounded-xl"
          style={{
            minHeight: 44,
            padding: `0 ${spacing[16]}px`,
            background: colors.primary,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          New Program
        </button>
      </div>

      {assignToClientId && clientForAssign && (
        <Card style={{ marginBottom: spacing[16], padding: isDesktopWeb ? spacing[16] : spacing[12] }}>
          <p className="text-[13px] font-medium" style={{ color: colors.muted, marginBottom: cardRhythm.titleBottom }}>Assigning to</p>
          <p className="text-[15px] font-semibold" style={{ color: colors.text, marginBottom: cardRhythm.titleBottom }}>{clientForAssign.full_name || 'Client'}</p>
          <p className="text-[12px] mt-1" style={{ color: colors.muted, marginTop: 0 }}>Tap a program below to assign it to this client.</p>
        </Card>
      )}

      {/* Search */}
      <div style={{ marginBottom: spacing[12] }}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            <Search size={16} style={{ color: colors.muted }} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programs..."
            className="w-full pl-9 pr-3 py-2.5 text-sm placeholder:opacity-60 focus:outline-none focus:ring-1 rounded-xl"
            style={{
              color: colors.text,
              background: colors.surface1,
              border: `1px solid ${colors.border}`,
            }}
          />
        </div>
      </div>

      {/* Goal filter chips */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ marginBottom: rhythm.section, scrollbarWidth: 'none' }}
      >
        {GOAL_OPTIONS.map((o) => {
          const active = goalFilter === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setGoalFilter(o.key)}
              className="shrink-0 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{
                minHeight: 34,
                padding: `0 ${spacing[14]}px`,
                background: active ? colors.primary : colors.surface1,
                color: active ? '#fff' : colors.text,
                border: `1px solid ${active ? colors.primary : colors.border}`,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          );
        })}
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
          icon={ClipboardList}
          title={search || goalFilter !== 'all' ? 'No programs found' : 'No programs yet'}
          description={
            search || goalFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Tap "New Program" above to build your first one.'
          }
        />
      ) : !initialLoad && !dataLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: rhythm.gutter }}>
          {(filteredPrograms || []).map((program) => {
            const GoalIcon = goalIcons[program.goal] || Dumbbell;
            const goalColor = goalColors[program.goal] || colors.muted;
            const assignedCount = (hasSupabase && user?.id) ? (assignmentCounts[program.id] ?? 0) : getAssignmentCount(program.id);
            return (
              <Card key={program.id} style={{ padding: cardPad }}>
                <div className="flex items-start gap-3">
                  {/* Left: program info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[15px] truncate" style={{ color: colors.text, margin: `0 0 ${spacing[6]}px` }}>
                      {program.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {!program.client_id && (
                        <span
                          className="rounded-full text-[11px] font-semibold"
                          style={{ background: colors.surface2, color: colors.muted, padding: '2px 8px', border: `1px solid ${colors.border}` }}
                        >
                          Template
                        </span>
                      )}
                      {program.goal && (
                        <span
                          className="rounded-full text-[11px] font-semibold inline-flex items-center gap-1"
                          style={{ background: `${goalColor}20`, color: goalColor, padding: '2px 8px' }}
                        >
                          <GoalIcon size={11} />
                          {(program.goal || '').replace('_', ' ')}
                        </span>
                      )}
                      {program.duration_weeks && (
                        <span className="text-[11px]" style={{ color: colors.muted }}>{program.duration_weeks}w</span>
                      )}
                      {assignedCount > 0 && (
                        <span className="text-[11px]" style={{ color: colors.muted }}>{assignedCount} assigned</span>
                      )}
                      {program.updated_date && (
                        <span className="text-[11px]" style={{ color: colors.muted }}>
                          {new Date(program.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {program.description && (
                      <p className="text-[12px] line-clamp-2 mt-1.5" style={{ color: colors.muted, margin: `${spacing[8]}px 0 0` }}>
                        {program.description}
                      </p>
                    )}
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {assignToClientId ? (
                      <Button variant="primary" onClick={() => handleAssignToClient(program.id)} style={{ fontSize: 13 }}>
                        Assign
                      </Button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(program.id, program)}
                          className="inline-flex items-center gap-1.5 rounded-lg font-semibold text-[13px]"
                          style={{
                            minHeight: 36,
                            padding: `0 ${spacing[12]}px`,
                            background: colors.primarySubtle,
                            color: colors.primary,
                            border: `1px solid ${colors.primary}`,
                          }}
                        >
                          <Edit size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(program)}
                          className="rounded-lg inline-flex items-center justify-center"
                          style={{ minHeight: 36, minWidth: 36, background: colors.surface1, border: `1px solid ${colors.border}` }}
                          aria-label="Duplicate"
                        >
                          <Copy size={15} style={{ color: colors.muted }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProgramToDelete(program)}
                          className="rounded-lg inline-flex items-center justify-center"
                          style={{ minHeight: 36, minWidth: 36, background: colors.surface1, border: `1px solid ${colors.border}` }}
                          aria-label="Delete"
                        >
                          <Trash2 size={15} style={{ color: colors.danger }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

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
