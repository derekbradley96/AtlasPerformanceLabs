import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Plus, Search, Copy, Edit, Dumbbell, TrendingDown, Target, Users } from 'lucide-react';
import { toast } from 'sonner';
import { saveProgram, getAssignmentCount, getProgramById } from '@/lib/programsStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import { useData } from '@/data/useData';
import { useAuth } from '@/lib/AuthContext';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { ProgramsListSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { captureUiError } from '@/services/errorLogger';
import { colors, spacing } from '@/ui/tokens';

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

export default function Programs() {
  const navigate = useNavigate();
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
        if (!cancelled) setPrograms(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setPrograms([]);
          setProgramsLoadError(true);
          captureUiError('Programs', err);
        }
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => { cancelled = true; };
  }, [data, refreshKey]);

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
    navigate('/programbuilder');
  };

  const handleEdit = async (id) => {
    await lightHaptic();
    navigate(`/programbuilder?id=${id}`);
  };

  const handleDuplicate = async (program) => {
    await lightHaptic();
    const copy = { ...program, id: undefined, name: `${program.name} (Copy)`, days: (program.days || []).map((d) => ({
      ...d,
      id: undefined,
      exercises: (d.exercises || []).map((e) => ({ ...e, id: undefined })),
    })) };
    const saved = saveProgram(copy);
    toast.success('Program duplicated!');
    navigate(`/programbuilder?id=${saved.id}`, { replace: true });
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

  return (
    <div className="app-screen app-section min-w-0 max-w-full overflow-x-hidden">
      {assignToClientId && clientForAssign && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[12] }}>
          <p className="text-[13px] font-medium" style={{ color: colors.muted }}>Assigning to</p>
          <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{clientForAssign.full_name || 'Client'}</p>
          <p className="text-[12px] mt-1" style={{ color: colors.muted }}>Tap a program below to assign it to this client.</p>
        </Card>
      )}

      <div style={{ marginBottom: spacing[12] }}>
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

      <div style={{ marginBottom: spacing[16], minWidth: 0 }}>
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
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <Dumbbell size={28} style={{ color: colors.muted }} />
          </div>
          <p className="text-[17px] font-semibold mb-2" style={{ color: colors.text }}>
            {search || goalFilter !== 'all' ? 'No programs found' : 'No programs yet'}
          </p>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            {search || goalFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first training program to assign to clients.'}
          </p>
          {!search && goalFilter === 'all' && (
            <Button variant="primary" onClick={handleCreate}>
              <Plus size={18} style={{ marginRight: 8 }} /> Create Program
            </Button>
          )}
        </Card>
      ) : !initialLoad && !dataLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
          {(filteredPrograms || []).map((program) => {
            const GoalIcon = goalIcons[program.goal] || Dumbbell;
            const goalColor = goalColors[program.goal] || colors.muted;
            const assignedCount = getAssignmentCount(program.id);
            return (
              <Card key={program.id} style={{ padding: spacing[16] }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[15px] mb-2 truncate" style={{ color: colors.text }}>{program.name}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {program.goal && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center gap-1"
                          style={{ background: `${goalColor}22`, color: goalColor }}
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
                    {program.description && (
                      <p className="text-sm mt-2 line-clamp-2" style={{ color: colors.muted }}>{program.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" onClick={() => handleEdit(program.id)} style={{ flex: 1, minWidth: 0 }}>
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
    </div>
  );
}
