import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { PageLoader } from '@/components/ui/LoadingState';
import TopBar from '@/components/ui/TopBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { PERSONAL_PROGRAM_BUILDER } from '@/lib/personalBuilderNav';
import { Dumbbell, Target, ChevronRight, Calendar, Edit3, Sparkles } from 'lucide-react';
import { getAssignment, getAssignmentMeta, getProgramById, updateProgramInPlace } from '@/lib/programsStore';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { getPersonalNutritionTarget, listPersonalMealLogs } from '@/lib/personalNutritionStore';
import { getRetentionStreaks } from '@/lib/retentionHabitService';
import { getLockedUpperLowerTwoHypertrophyTwoStrength } from '@/lib/workoutQuickStart';
import { createPersonalProgramFromTemplate } from '@/lib/personalProgramSeed';
import { formatReadinessAsOutOfTen, readinessStoredToBand10 } from '@/lib/progressMetricsValidation';
import { resolvePersonalPlanTier } from '@/config/plans';
import {
  personalHubEmptySubtitle,
  personalHubNoPlanBody,
  personalHubCloudSubtitle,
  personalHubLocalSubtitle,
  personalTrainingTipBasic,
  personalTrainingTipEnhanced,
} from '@/lib/personalPlanBuilderUx';
import { usePresentationMode } from '@/lib/presentationMode';
import { desktopRhythm } from '@/ui/pageLayout';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import { personalColumnInnerBodyStyle } from '@/lib/personalShellLayout';
import { atlasMigrationDataAttributes, deriveMyProgramRouteState } from '@/lib/atlasMigrationPhases';

function safeDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt?.getTime?.()) ? null : dt;
}

export default function PersonalMyProgram() {
  const { user, profile } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
  const rhythm = desktopRhythm(isDesktopWeb);
  const isEnhancedPersonal = ['enhanced', 'free'].includes(resolvePersonalPlanTier(profile, user));
  const todayIso = new Date().toISOString().slice(0, 10);
  const personalTarget = getPersonalNutritionTarget(user?.id);
  const personalMealsToday = listPersonalMealLogs(user?.id, todayIso);
  const totalProteinToday = personalMealsToday.reduce((sum, m) => sum + (Number(m?.protein_g) || 0), 0);
  const proteinTargetToday = Number(personalTarget?.protein_g) || null;
  const proteinPct = proteinTargetToday ? Math.round((totalProteinToday / proteinTargetToday) * 100) : null;
  const supabase = hasSupabase ? getSupabase() : null;
  const { data: personalSignals } = useQuery({
    queryKey: ['personal-plan-signals', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return null;
      const { data: readinessRows } = await supabase
        .from('readiness_checkins')
        .select('readiness_score, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(7);
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, status, completed_at, created_at')
        .eq('profile_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3);
      return {
        readiness: readinessRows || [],
        completedSessions: sessions || [],
      };
    },
    enabled: !!supabase && !!user?.id,
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);

  const { data: supabasePlan, isLoading: supabasePlanLoading } = useQuery({
    queryKey: ['personal-my-program-supabase', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return null;
      const { data: asn, error: aErr } = await supabase
        .from('personal_program_assignments')
        .select('program_block_id, start_date')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (aErr || !asn?.program_block_id) return null;
      const { data: block, error: bErr } = await supabase
        .from('program_blocks')
        .select('id, title, total_weeks')
        .eq('id', asn.program_block_id)
        .maybeSingle();
      if (bErr || !block) return null;
      const { data: weeks } = await supabase
        .from('program_weeks')
        .select('id, week_number')
        .eq('block_id', block.id)
        .order('week_number', { ascending: true })
        .limit(1);
      const w1 = weeks?.[0];
      if (!w1?.id) return { block, start_date: asn.start_date, days: [] };
      const { data: days } = await supabase
        .from('program_days')
        .select('id, day_number, title')
        .eq('week_id', w1.id)
        .order('day_number', { ascending: true });
      const dayList = Array.isArray(days) ? days : [];
      const daysWithCounts = await Promise.all(
        dayList.map(async (d) => {
          const { count, error: cErr } = await supabase
            .from('program_exercises')
            .select('id', { count: 'exact', head: true })
            .eq('day_id', d.id);
          return { ...d, exerciseCount: cErr ? 0 : count || 0 };
        })
      );
      return { block, start_date: asn.start_date, days: daysWithCounts };
    },
    enabled: !!supabase && !!user?.id,
  });

  useEffect(() => {
    if (!isEnhancedPersonal) return;
    if (searchParams.get('create') === '1') {
      setCreateModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [isEnhancedPersonal, searchParams, setSearchParams]);

  const { data: retentionStreaks } = useQuery({
    queryKey: ['personal-retention-streaks', user?.id],
    queryFn: async () => getRetentionStreaks({ profileId: user?.id }),
    enabled: !!user?.id,
  });

  const assignedProgramId = (() => {
    try {
      return getAssignment(user?.id) ?? null;
    } catch {
      return null;
    }
  })();

  const program = assignedProgramId ? (() => {
    try {
      return getProgramById(assignedProgramId) ?? null;
    } catch {
      return null;
    }
  })() : null;

  const assignmentMeta = (() => {
    try {
      return getAssignmentMeta(user?.id) ?? null;
    } catch {
      return null;
    }
  })();
  const [showLockedSplitBadge, setShowLockedSplitBadge] = React.useState(false);

  useEffect(() => {
    if (!user?.id || !program?.id) return;
    const lockKey = `atlas_personal_locked_split_v1_${user.id}`;
    const toastKey = `atlas_personal_locked_split_toast_v1_${user.id}`;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(lockKey) === '1') {
        setShowLockedSplitBadge(true);
        return;
      }
    } catch {
      // ignore storage failures
    }

    const currentDays = Array.isArray(program.days) ? program.days : [];
    const dayNames = currentDays.map((d) => String(d?.dayName || '').trim().toLowerCase());
    const isUpperLower4 =
      currentDays.length === 4 &&
      dayNames.includes('upper a') &&
      dayNames.includes('lower a') &&
      dayNames.includes('upper b') &&
      dayNames.includes('lower b');
    if (!isUpperLower4) return;

    const locked = getLockedUpperLowerTwoHypertrophyTwoStrength();
    const nextDays = locked.map((day, dayIdx) => ({
      id: currentDays[dayIdx]?.id || `locked-day-${dayIdx + 1}`,
      dayName: day.dayName,
      exercises: day.exercises.map((ex, exIdx) => ({
        id: currentDays[dayIdx]?.exercises?.[exIdx]?.id || `locked-ex-${dayIdx + 1}-${exIdx + 1}`,
        exerciseId: '',
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rir: 2,
        rpe: '',
        restSeconds: ex.restSeconds,
        tempo: '',
        notes: ex.notes || '',
        groupId: '',
      })),
    }));

    updateProgramInPlace(program.id, { days: nextDays });
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(lockKey, '1');
        const alreadyToasted = localStorage.getItem(toastKey) === '1';
        if (!alreadyToasted) {
          toast.success('Locked split applied');
          localStorage.setItem(toastKey, '1');
        }
      } else {
        toast.success('Locked split applied');
      }
    } catch {
      // ignore storage failures
    }
    setShowLockedSplitBadge(true);
  }, [user?.id, program?.id]);

  if (!user) {
    const mpM = deriveMyProgramRouteState({ roleView: 'personal', surface: 'loading' });
    return (
      <div {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}>
        <PageLoader />
      </div>
    );
  }

  const supabaseReady = !hasSupabase || !supabasePlanLoading;
  const hasCloudProgram = !!supabasePlan?.block?.id;

  const runTemplateCreate = async (days) => {
    if (!supabase || !user?.id) {
      toast.error('Connect to the app to create a program.');
      return;
    }
    setTemplateBusy(true);
    try {
      const blockId = await createPersonalProgramFromTemplate(supabase, user.id, days);
      setCreateModalOpen(false);
      navigate(`${PERSONAL_PROGRAM_BUILDER}&blockId=${encodeURIComponent(blockId)}`);
    } catch (e) {
      toast.error(e?.message || 'Could not create program');
    } finally {
      setTemplateBusy(false);
    }
  };

  if (hasSupabase && supabasePlanLoading && !program) {
    const mpM = deriveMyProgramRouteState({ roleView: 'personal', surface: 'loading' });
    return (
      <PersonalCanvas>
        <div
          {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}
          style={{ minHeight: '100vh', color: colors.text }}
        >
          <TopBar title="My plan" onBack={() => navigate(-1)} />
          <PersonalColumn variant="default">
            <div
              style={{
                ...personalColumnInnerBodyStyle(),
                paddingTop: spacing[16],
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <PageLoader message="Loading your program…" />
            </div>
          </PersonalColumn>
        </div>
      </PersonalCanvas>
    );
  }

  if (!program && !hasCloudProgram && supabaseReady) {
    const openQuickStartModal = () => {
      setCreateModalOpen(true);
    };

    const mpM = deriveMyProgramRouteState({ roleView: 'personal', surface: 'empty' });
    return (
      <PersonalCanvas>
        <div
          {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}
          style={{ minHeight: '100vh', color: colors.text }}
        >
        <TopBar title="My plan" onBack={() => navigate(-1)} />

        {isEnhancedPersonal && createModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Quick start program"
            onClick={() => !templateBusy && setCreateModalOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && !templateBusy && setCreateModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              <Card
                style={{
                  ...standardCard,
                  padding: spacing[20],
                  maxWidth: 400,
                  width: '100%',
                }}
              >
                <h2 className="text-lg font-bold mb-2" style={{ color: colors.text }}>
                  Quick start
                </h2>
                <p className="text-sm mb-4" style={{ color: colors.muted, lineHeight: 1.45 }}>
                  Pick how many days you train. We&apos;ll sketch a week you can edit anytime in your planner.
                </p>
                <p className="text-xs mb-4" style={{ color: colors.muted }}>
                  2d upper/lower · 3d push/pull/legs · 4d upper/lower split.
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[2, 3, 4].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      className="min-h-11"
                      style={{ background: colors.primary, color: '#fff' }}
                      disabled={templateBusy}
                      onClick={() => runTemplateCreate(d)}
                    >
                      {d} days
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11"
                  style={{ borderColor: shell.cardBorder, color: colors.text }}
                  disabled={templateBusy}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
              </Card>
            </div>
          </div>
        )}

        <PersonalColumn variant="default">
          <div style={personalColumnInnerBodyStyle()}>
          <p style={{ margin: `0 0 ${spacing[14]}px`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
            {personalHubEmptySubtitle()}
          </p>

          <Card style={{ ...standardCard, padding: spacing[20] }}>
            <div className="flex items-start gap-3" style={{ marginBottom: spacing[16] }}>
              <div
                className="shrink-0 flex items-center justify-center rounded-xl"
                style={{
                  width: 48,
                  height: 48,
                  background: colors.primarySubtle,
                  border: `1px solid ${shell.cardBorder}`,
                }}
              >
                <Dumbbell className="w-6 h-6" style={{ color: colors.primary }} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>No plan yet</h2>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                  {personalHubNoPlanBody({ enhanced: isEnhancedPersonal })}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
              <Button
                type="button"
                onClick={() => navigate(PERSONAL_PROGRAM_BUILDER)}
                className="w-full justify-center min-h-[48px]"
                style={{ background: colors.primary, color: '#fff', fontWeight: 700 }}
              >
                Create your first plan
                <ChevronRight className="w-4 h-4 ml-2 shrink-0" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openQuickStartModal}
                disabled={!hasSupabase}
                className="w-full justify-center min-h-[48px]"
                style={{ borderColor: shell.cardBorder, color: colors.text, fontWeight: 600 }}
              >
                <Sparkles className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                Fast template (2–4 days)
              </Button>
            </div>

            <p style={{ margin: `${spacing[14]}px 0 0`, fontSize: 12, color: colors.muted, textAlign: 'center' }}>
              Start with Create your first plan, or pick a template — both open the same editor.
            </p>
          </Card>
          </div>
        </PersonalColumn>
        </div>
      </PersonalCanvas>
    );
  }

  if (hasCloudProgram && supabasePlan) {
    const sb = supabasePlan.block;
    const sbDays = Array.isArray(supabasePlan.days) ? supabasePlan.days : [];
    const startDate = safeDate(supabasePlan.start_date) || new Date();
    const now = new Date();
    const daysSinceStart = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1;
    const activeDayIndex = sbDays.length ? daysSinceStart % sbDays.length : 0;

    const mpM = deriveMyProgramRouteState({ roleView: 'personal', surface: 'cloud' });
    return (
      <PersonalCanvas>
        <div
          {...atlasMigrationDataAttributes(mpM.phase, mpM.primary)}
          style={{ minHeight: '100vh', color: colors.text }}
        >
        <TopBar title="My plan" onBack={() => navigate(-1)} />
        <PersonalColumn variant="default">
          <div style={personalColumnInnerBodyStyle()}>
          <p style={{ margin: `0 0 ${spacing[16]}px`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
            {personalHubCloudSubtitle()}
          </p>
          <Card style={{ ...standardCard, padding: spacing[20], marginBottom: rhythm.section }}>
            <div className="flex items-start gap-3 mb-4">
              <div
                className="shrink-0 rounded-xl flex items-center justify-center"
                style={{ width: 48, height: 48, background: colors.primarySubtle, border: `1px solid ${shell.cardBorder}` }}
              >
                <Target className="w-6 h-6" style={{ color: colors.primary }} aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>{sb.title || 'My plan'}</h2>
                <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
                  Week {currentWeekNumber} of {sb.total_weeks || '—'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
              <Button
                type="button"
                onClick={() => navigate(`${PERSONAL_PROGRAM_BUILDER}&blockId=${encodeURIComponent(sb.id)}`)}
                className="w-full justify-center min-h-[48px]"
                style={{ background: colors.primary, color: '#fff', fontWeight: 700 }}
              >
                <Edit3 className="w-4 h-4 mr-2" aria-hidden />
                Edit plan
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('Today'))} className="w-full justify-center min-h-[48px]" style={{ borderColor: shell.cardBorder }}>
                Go to Today
                <ChevronRight className="w-4 h-4 ml-2" aria-hidden />
              </Button>
            </div>
          </Card>

          <Card style={{ ...standardCard, padding: spacing[20] }}>
            <h3 style={{ margin: `0 0 ${spacing[14]}px`, fontSize: 13, fontWeight: 700, color: colors.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>This week</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isDesktopWeb ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: spacing[12] }}>
              {sbDays.length ? (
                sbDays.map((d, idx) => {
                  const isActive = idx === activeDayIndex;
                  return (
                    <div
                      key={d?.id ?? idx}
                      style={{
                        padding: spacing[16],
                        borderRadius: 16,
                        border: `1px solid ${isActive ? colors.primary : shell.cardBorder}`,
                        background: isActive ? colors.primarySubtle : colors.surface1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8], marginBottom: spacing[6] }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], minWidth: 0 }}>
                          <Calendar className="w-4 h-4 shrink-0" style={{ color: colors.primary }} aria-hidden />
                          <p style={{ margin: 0, fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d?.title || `Day ${d?.day_number ?? idx + 1}`}
                          </p>
                        </div>
                        {isActive ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: colors.primarySubtle, color: colors.primary }}>Today</span>
                        ) : null}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{d?.exerciseCount ?? 0} exercises</p>
                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>No training days yet — open Edit plan to add your first day.</p>
              )}
            </div>
          </Card>
          </div>
        </PersonalColumn>
        </div>
      </PersonalCanvas>
    );
  }

  const startDate = safeDate(assignmentMeta?.effectiveDate) || safeDate(program?.created_date) || new Date();
  const now = new Date();
  const daysSinceStart = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1;

  const days = Array.isArray(program.days) ? program.days : [];
  const activeDayIndex = days.length ? daysSinceStart % days.length : 0;
  const latestReadinessRaw = personalSignals?.readiness?.[0]?.readiness_score;
  const latestReadinessBand =
    latestReadinessRaw !== undefined && latestReadinessRaw !== null && latestReadinessRaw !== ''
      ? readinessStoredToBand10(latestReadinessRaw)
      : null;
  const sessionsLogged = Number(personalSignals?.completedSessions?.length) || 0;
  const trainingTipLine = isEnhancedPersonal
    ? personalTrainingTipEnhanced({ readinessBand10: latestReadinessBand, sessionsLogged })
    : personalTrainingTipBasic({ readinessBand10: latestReadinessBand, proteinPct });
  const summaryParts = [
    sessionsLogged ? `${sessionsLogged} recent sessions` : null,
    latestReadinessBand != null ? `readiness ${formatReadinessAsOutOfTen(latestReadinessRaw)}` : null,
    Number.isFinite(proteinPct) ? `protein ${proteinPct}% of target today` : null,
  ].filter(Boolean);

  const mpLocal = deriveMyProgramRouteState({ roleView: 'personal', surface: 'local' });

  return (
    <PersonalCanvas>
      <div
        {...atlasMigrationDataAttributes(mpLocal.phase, mpLocal.primary)}
        style={{ minHeight: '100vh', color: colors.text }}
      >
      <TopBar title="My plan" onBack={() => navigate(-1)} />
      <PersonalColumn variant="default">
        <div style={personalColumnInnerBodyStyle()}>
        <p style={{ margin: `0 0 ${spacing[16]}px`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
          {personalHubLocalSubtitle()}
        </p>

        <Card style={{ ...standardCard, padding: spacing[20], marginBottom: rhythm.section }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12], marginBottom: spacing[16] }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: colors.primarySubtle,
                border: `1px solid ${shell.cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Target className="w-6 h-6" style={{ color: colors.primary }} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {program.name || 'My plan'}
              </h2>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
                Week {currentWeekNumber} of {program.duration_weeks || '—'}
                {program.goal ? ` · ${String(program.goal).replace('_', ' ')}` : null}
              </p>
              {showLockedSplitBadge ? (
                <span
                  style={{
                    display: 'inline-flex',
                    marginTop: spacing[8],
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: colors.primarySubtle,
                    color: colors.primary,
                  }}
                >
                  Balanced upper/lower template applied
                </span>
              ) : null}
              {program.description ? <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>{program.description}</p> : null}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
            <Button
              type="button"
              onClick={() => navigate(`/programbuilder?id=${encodeURIComponent(program.id)}`)}
              className="w-full justify-center min-h-[48px]"
              style={{ background: colors.primary, color: '#fff', fontWeight: 700 }}
            >
              <Edit3 className="w-4 h-4 mr-2" aria-hidden />
              Edit plan
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('Today'))} className="w-full justify-center min-h-[48px]" style={{ borderColor: shell.cardBorder }}>
              Go to Today
              <ChevronRight className="w-4 h-4 ml-2" aria-hidden />
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('Nutrition'))} className="w-full justify-center min-h-[48px]" style={{ borderColor: shell.cardBorder }}>
              Nutrition
            </Button>
          </div>
        </Card>

        <Card style={{ ...standardCard, padding: spacing[20], marginBottom: rhythm.section }}>
          <h3 style={{ margin: `0 0 ${spacing[14]}px`, fontSize: 13, fontWeight: 700, color: colors.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>This week</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isDesktopWeb ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: spacing[12] }}>
            {days.length ? (
              days.map((d, idx) => {
                const isActive = idx === activeDayIndex;
                const exList = Array.isArray(d?.exercises) ? d.exercises : [];
                return (
                  <div
                    key={d?.id ?? idx}
                    style={{
                      padding: spacing[16],
                      borderRadius: 16,
                      border: `1px solid ${isActive ? colors.primary : shell.cardBorder}`,
                      background: isActive ? colors.primarySubtle : colors.surface1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8], marginBottom: spacing[6] }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], minWidth: 0 }}>
                        <Calendar className="w-4 h-4 shrink-0" style={{ color: colors.primary }} aria-hidden />
                        <p style={{ margin: 0, fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d?.dayName || `Day ${idx + 1}`}
                        </p>
                      </div>
                      {isActive ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: colors.primarySubtle, color: colors.primary }}>Today</span>
                      ) : null}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{exList.length} exercises</p>
                    {exList.length > 0 ? (
                      <div style={{ marginTop: spacing[10] }}>
                        <p style={{ margin: `0 0 ${spacing[6]}px`, fontSize: 11, fontWeight: 600, color: colors.muted }}>Up next</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {exList.slice(0, 4).map((ex, exIdx) => (
                            <p key={ex?.id ?? exIdx} style={{ margin: 0, fontSize: 13, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ex?.name || ex?.exercise_name || 'Exercise'}
                            </p>
                          ))}
                          {exList.length > 4 ? <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>+ more in planner</p> : null}
                        </div>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      onClick={() => navigate('/workout-player')}
                      className="w-full mt-4 min-h-[44px]"
                      style={{ background: colors.success, color: '#fff', fontWeight: 700 }}
                    >
                      Start session
                      <ChevronRight className="w-4 h-4 ml-2" aria-hidden />
                    </Button>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>No training days yet — tap Edit plan to sketch your week.</p>
            )}
          </div>
        </Card>

        <Card style={{ ...standardCard, padding: spacing[20], marginBottom: rhythm.section, border: isEnhancedPersonal ? `1px solid ${colors.border}` : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[8], marginBottom: spacing[10] }}>
            {isEnhancedPersonal ? <Sparkles className="w-4 h-4" style={{ color: colors.primary }} aria-hidden /> : null}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>
              {isEnhancedPersonal ? 'This week’s focus' : 'Today’s training tip'}
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: colors.text, lineHeight: 1.5 }}>{trainingTipLine}</p>
          {isEnhancedPersonal && summaryParts.length > 0 ? (
            <p style={{ margin: `${spacing[12]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              {summaryParts.join(' · ')}
            </p>
          ) : null}
          <div style={{ marginTop: spacing[14], display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
            <Button type="button" variant="outline" onClick={() => navigate('/readiness-checkin')} className="w-full min-h-[44px]" style={{ borderColor: shell.cardBorder }}>
              Log readiness
            </Button>
            {!isEnhancedPersonal ? (
              <Button type="button" variant="outline" onClick={() => navigate('/nutrition')} className="w-full min-h-[44px]" style={{ borderColor: shell.cardBorder }}>
                Open nutrition
              </Button>
            ) : null}
          </div>
        </Card>

        {retentionStreaks ? (
          <Card style={{ ...standardCard, padding: spacing[20] }}>
            <h3 style={{ margin: `0 0 ${spacing[6]}px`, fontSize: 13, fontWeight: 700, color: colors.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Streaks</h3>
            <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 12, color: colors.muted }}>You get one skipped day per week without breaking a streak.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[8] }}>
              <div style={{ borderRadius: 12, border: `1px solid ${shell.cardBorder}`, padding: spacing[10] }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Workout</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>{retentionStreaks.workoutStreak || 0}d</p>
              </div>
              <div style={{ borderRadius: 12, border: `1px solid ${shell.cardBorder}`, padding: spacing[10] }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Nutrition</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>{retentionStreaks.nutritionStreak || 0}d</p>
              </div>
              <div style={{ borderRadius: 12, border: `1px solid ${shell.cardBorder}`, padding: spacing[10] }}>
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>Check-in</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 15, fontWeight: 700, color: colors.text }}>{retentionStreaks.checkinStreak || 0}d</p>
              </div>
            </div>
          </Card>
        ) : null}
        </div>
      </PersonalColumn>
      </div>
    </PersonalCanvas>
  );
}

