/**
 * Client / Personal Today: hero, nutrition, habits, weight — data from `useTodayPageData`
 * (batched `fetchTodayPageV2Bundle`). Session logging lives in the Workout Player.
 * Extra `useQuery` here only when data is not in the V2 bundle (e.g. gated coach previews).
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isClient } from '@/lib/roles';
import { scheduleWorkoutReminderIfNeeded } from '@/lib/workoutReminder';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getLocalDateKey } from '@/lib/readinessCheckinApi';
import { colors, shell, spacing, radii } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';
import { usePresentationMode } from '@/lib/presentationMode';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/LoadingState';
import TodayWorkoutHeroCard from '@/components/workout/TodayWorkoutHeroCard';
import { shouldShowCoachDiscovery } from '@/lib/coachDiscoveryPrompt';
import { fetchCompetitionCoachPreviews } from '@/lib/coachMarketplacePreview';
import { getContextualGuidance } from '@/lib/contextualGuidance';
import { interpretWeightProgress, clientGoalFromGoalsField } from '@/lib/progressInterpretation';
import { calculateWeeklyScore } from '@/lib/weeklyEffortScore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { calculatePrepProgress } from '@/lib/prepProgressTracking';
import { shouldShowCoachUpsell } from '@/lib/coachUpsellTiming';
import { getPersonalGoalBucketFromProfile, personalHomeTrainingCardCopy } from '@/lib/personalGoalCopy';
import { useTodayPageData } from '@/hooks/useTodayPageData';
import { listPersonalMealLogs } from '@/lib/personalNutritionStore';

function getISOWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return d.getFullYear() + '-W' + String(1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3
    + (week1.getDay() + 6) % 7) / 7)).padStart(2, '0');
}

/** Normalise program_exercises row for UI (name vs exercise_name). */
function normaliseExercise(ex) {
  return { ...ex, name: ex.name ?? ex.exercise_name ?? '' };
}

function formatNameInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'C';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function baseCardStyle(accent = colors.border) {
  return {
    ...standardCard,
    padding: spacing[14],
    border: `1px solid ${accent}`,
  };
}

function SectionTitle({ children }) {
  return (
    <p
      style={{
        margin: 0,
        marginBottom: spacing[8],
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: colors.muted,
      }}
    >
      {children}
    </p>
  );
}

function TodayWorkoutHeroSection({
  title,
  subtitle,
  exercises = [],
  hasWorkoutToday,
  hasProgramAssigned,
  onStartWorkout,
  onMessageCoach,
  onNoProgramAction,
  startLabel = 'Start workout',
  accent = colors.primary,
  restLabel = null,
  isDesktopWeb = false,
  audience = 'client',
  noProgramTitle,
  noProgramBody,
  noProgramCtaLabel,
}) {
  return (
    <Card style={baseCardStyle(accent)}>
      <SectionTitle>{title}</SectionTitle>
      <TodayWorkoutHeroCard
        workoutName={subtitle}
        exercises={exercises}
        hasWorkoutToday={hasWorkoutToday}
        hasProgramAssigned={hasProgramAssigned}
        onStartWorkout={onStartWorkout}
        onMessageCoach={onMessageCoach}
        onNoProgramAction={onNoProgramAction}
        startLabel={startLabel}
        audience={audience}
        noProgramTitle={noProgramTitle}
        noProgramBody={noProgramBody}
        noProgramCtaLabel={noProgramCtaLabel}
      />
      {restLabel ? (
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>{restLabel}</p>
      ) : null}
      {isDesktopWeb && exercises.length > 0 ? (
        <div style={{ marginTop: spacing[8], display: 'grid', gap: spacing[4] }}>
          {exercises.slice(0, 4).map((ex, idx) => (
            <p key={`${ex.id || ex.name || idx}`} style={{ margin: 0, fontSize: 12, color: colors.muted }}>
              {idx + 1}. {ex.name || ex.exercise_name || 'Exercise'}
            </p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ClientTransformToday({ data, isDesktopWeb }) {
  const { navigate } = data;
  const firstCheckInCard = data.showFirstCheckInPrompt ? (
    <Card style={{ ...baseCardStyle(), borderColor: colors.warning }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0 }}>Submit your first check-in</p>
      <p style={{ fontSize: 13, color: colors.muted, margin: `${spacing[8]}px 0 0` }}>
        Your coach is waiting for your first weekly update — weight, energy, and how you’re feeling. It takes 3 minutes.
      </p>
      <Button type="button" onClick={() => navigate('/clientcheckin')} style={{ marginTop: spacing[10] }}>
        Submit check-in →
      </Button>
    </Card>
  ) : null;
  const rightColumn = (
    <>
      {data.habits.length > 0 ? (
        <Card style={baseCardStyle()}>
          <SectionTitle>Habit streak row</SectionTitle>
          <div style={{ display: 'flex', gap: spacing[8], overflowX: 'auto' }}>
            {data.habits.map((h) => (
              <button
                key={h.key}
                type="button"
                onClick={() => data.toggleHabit(h.key)}
                style={{
                  minHeight: 38,
                  borderRadius: 999,
                  border: `1px solid ${colors.border}`,
                  background: h.done ? colors.primarySubtle : colors.surface2,
                  color: colors.text,
                  padding: `0 ${spacing[10]}px`,
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {h.done ? '✓' : '○'} {h.label}
              </button>
            ))}
          </div>
        </Card>
      ) : null}
      {data.guidance ? (
        <Card style={baseCardStyle()}>
          <SectionTitle>What should I do right now?</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.guidance.message}</p>
          <Button type="button" onClick={() => navigate(data.guidance.actionRoute)} style={{ marginTop: spacing[10] }}>
            {data.guidance.action} →
          </Button>
        </Card>
      ) : null}
      <Card style={baseCardStyle()}>
        <SectionTitle>Coach connection</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10] }}>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: colors.surface2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
            {formatNameInitials(data.coachName)}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>{data.coachName}</p>
            <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{data.lastFeedbackLabel}</p>
          </div>
          {data.unreadCount > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: colors.primary, borderRadius: 999, padding: '2px 8px' }}>
              {data.unreadCount}
            </span>
          ) : null}
        </div>
        <Button type="button" onClick={() => navigate('/messages')} style={{ marginTop: spacing[10] }}>
          Message {data.coachFirstName} →
        </Button>
      </Card>
      <Card style={baseCardStyle()}>
        <SectionTitle>Weight log tile</SectionTitle>
        <button
          type="button"
          onClick={data.openWeightSheet}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.weightLine}</p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
            {data.weightTrendLine || data.progressText || 'Log weight to unlock trend interpretation.'}
          </p>
          <p style={{ fontSize: 11, color: colors.primary, marginTop: spacing[4] }}>
            {data.todayWeight ? 'Update weight →' : 'Log today\'s weight →'}
          </p>
        </button>
      </Card>
    </>
  );

  return (
    <div style={{ display: 'grid', gap: spacing[12] }}>
      {firstCheckInCard}
      <TodayWorkoutHeroSection
        title="Today's workout hero"
        subtitle={data.workoutName}
        exercises={data.exercises}
        hasWorkoutToday={data.hasWorkoutToday}
        hasProgramAssigned={data.hasProgramAssigned}
        onStartWorkout={data.onStartWorkout}
        onMessageCoach={() => navigate('/messages')}
        startLabel="Start workout →"
        accent={data.heroAccent}
        restLabel={data.restLabel}
        isDesktopWeb={isDesktopWeb}
      />
      {data.progressText ? (
        <Card style={baseCardStyle()}>
          <SectionTitle>Progress interpretation</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.progressText}</p>
        </Card>
      ) : null}
      <Card style={baseCardStyle()}>
        <SectionTitle>Nutrition ring</SectionTitle>
        {data.hasNutritionTargets ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.nutritionLine}</p>
            {data.nutritionInterpretationLine ? (
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>{data.nutritionInterpretationLine}</p>
            ) : null}
            <Button type="button" onClick={() => navigate('/nutrition?openScanner=1')} style={{ marginTop: spacing[10] }}>
              Log a meal →
            </Button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Your coach hasn't set nutrition targets yet</p>
            <Button type="button" variant="outline" onClick={() => navigate('/messages')} style={{ marginTop: spacing[10] }}>
              Message coach →
            </Button>
          </>
        )}
      </Card>
      {isDesktopWeb ? (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: spacing[12] }}>
          <div />
          <div style={{ display: 'grid', gap: spacing[12] }}>{rightColumn}</div>
        </div>
      ) : (
        rightColumn
      )}
    </div>
  );
}

function ClientCompToday({ data }) {
  const { navigate, prepContext } = data;
  const showPeakWeek = Number(prepContext?.daysOut) <= 7;
  const dOut = prepContext?.daysOut;
  const prepProgress = data.prepProgress;
  return (
    <div style={{ display: 'grid', gap: spacing[12] }}>
      {dOut != null ? (
        <div
          style={{
            padding: `${spacing[20]}px ${spacing[16]}px`,
            background:
              dOut <= 7 ? `${colors.danger}15`
                : dOut <= 21 ? `${colors.warning}12`
                  : `${colors.primary}08`,
            borderRadius: 16,
            border: `1px solid ${
              dOut <= 7 ? colors.danger
                : dOut <= 21 ? colors.warning
                  : colors.border}30`,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: dOut <= 7 ? colors.danger : colors.warning,
              margin: 0,
              marginBottom: spacing[4],
            }}
          >
            {prepContext?.phaseLabel}
          </p>
          <p
            style={{
              fontSize: 'clamp(32px, 10vw, 48px)',
              fontWeight: 800,
              lineHeight: 1,
              color: dOut <= 7 ? colors.danger : colors.warning,
              margin: 0,
            }}
          >
            {dOut}
          </p>
          <p style={{ fontSize: 14, color: colors.muted, marginTop: spacing[4], margin: 0 }}>
            days to {prepContext?.showName || 'show day'}
            {prepContext?.division ? ` · ${prepContext.division}` : ''}
          </p>
        </div>
      ) : null}
      <TodayWorkoutHeroSection
        title="Today's workout hero"
        subtitle={data.compWorkoutLabel}
        exercises={data.exercises}
        hasWorkoutToday={data.hasWorkoutToday}
        hasProgramAssigned={data.hasProgramAssigned}
        onStartWorkout={data.onStartWorkout}
        onMessageCoach={() => navigate('/messages')}
        startLabel="Start workout →"
        accent={colors.warning}
      />
      {prepProgress ? (
        <div
          style={{
            padding: `${spacing[12]}px ${spacing[16]}px`,
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[6] }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Prep progress</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: prepProgress.status === 'ahead' ? colors.primary
                  : prepProgress.status === 'behind' ? colors.warning
                    : colors.success,
              }}
            >
              {prepProgress.statusLabel}
            </span>
          </div>
          <div style={{ height: 6, background: colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, prepProgress.pctComplete)}%`,
                height: '100%',
                borderRadius: 3,
                background: prepProgress.status === 'behind' ? colors.warning : colors.primary,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: colors.muted, margin: `${spacing[4]}px 0 0` }}>
            Week {prepProgress.weeksElapsed} of {prepProgress.totalWeeks}
          </p>
        </div>
      ) : prepContext ? (
        <Card style={baseCardStyle()}>
          <SectionTitle>Am I on track?</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.onTrackLine}</p>
        </Card>
      ) : null}
      <Card style={baseCardStyle()}>
        <SectionTitle>Nutrition</SectionTitle>
        {data.hasNutritionTargets ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.nutritionLine}</p>
            {data.nutritionInterpretationLine ? (
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>{data.nutritionInterpretationLine}</p>
            ) : null}
            <Button type="button" onClick={() => navigate('/nutrition?openScanner=1')} style={{ marginTop: spacing[10] }}>
              Log a meal →
            </Button>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Your coach hasn’t set nutrition targets yet</p>
        )}
      </Card>
      {showPeakWeek ? (
        <Card style={baseCardStyle(colors.warning)}>
          <SectionTitle>Peak week protocol today</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>
            Carbs: {data.peakWeekTargets.carbs}g · Water: {data.peakWeekTargets.waterL}L · Sodium: {data.peakWeekTargets.sodium}
          </p>
        </Card>
      ) : null}
      <Card style={baseCardStyle()}>
        <SectionTitle>Pose check submit card</SectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: colors.text }}>
          {data.poseCheckDue ? `Submit this week's ${data.poseName}` : 'No pose check due — open posing log.'}
        </p>
        <Button type="button" onClick={() => navigate(data.poseCheckDue ? '/pose-check' : '/pose-self-assessment')} style={{ marginTop: spacing[10] }}>
          {data.poseCheckDue ? 'Upload and submit →' : 'Open posing log →'}
        </Button>
      </Card>
      <Card style={baseCardStyle()}>
        <SectionTitle>Posing practice timer</SectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: colors.text }}>
          Today's posing: {data.posingTodayMinutes} / {data.posingTargetMinutes} min target
        </p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
          Weekly total: {data.posingWeekMinutes} min
        </p>
      </Card>
    </div>
  );
}

function PersonalTransformToday({ data, isDesktopWeb }) {
  const { navigate } = data;
  const noPlanCopy = personalHomeTrainingCardCopy('no_plan', data.personalGoalBucket);
  const todayDay = new Date().getDay();
  const todayHour = new Date().getHours();
  const showWeeklyScore =
    (todayDay === 0) ||
    (todayDay === 1 && todayHour < 12);
  const rightColumn = (
    <>
      <Card style={baseCardStyle()}>
        <SectionTitle>Macro ring</SectionTitle>
        {data.hasNutritionTargets ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.nutritionLine}</p>
            {data.nutritionInterpretationLine ? (
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>{data.nutritionInterpretationLine}</p>
            ) : null}
            <Button type="button" onClick={() => navigate('/nutrition?openScanner=1')} style={{ marginTop: spacing[10] }}>
              Log a meal →
            </Button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
              Set your calorie and macro targets to track progress on Today.
            </p>
            <Button type="button" onClick={() => navigate('/nutrition')} style={{ marginTop: spacing[10] }}>
              Set nutrition targets →
            </Button>
          </>
        )}
      </Card>
      <Card style={baseCardStyle()}>
        <SectionTitle>Weight log tile</SectionTitle>
        <button
          type="button"
          onClick={data.openWeightSheet}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.weightLine}</p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
            {data.weightTrendLine || data.progressText || 'Log weight to unlock trend interpretation.'}
          </p>
          <p style={{ fontSize: 11, color: colors.primary, marginTop: spacing[4] }}>
            {data.todayWeight ? 'Update weight →' : 'Log today\'s weight →'}
          </p>
        </button>
      </Card>
      {data.plateauOrMotivation ? (
        <Card style={baseCardStyle(data.plateauOrMotivation.type === 'plateau' ? colors.warning : colors.primary)}>
          <SectionTitle>{data.plateauOrMotivation.type === 'plateau' ? 'Plateau card' : 'Motivation card'}</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.plateauOrMotivation.message}</p>
        </Card>
      ) : null}
    </>
  );
  return (
    <div style={{ display: 'grid', gap: spacing[12] }}>
      {!data.readinessDone ? (
        <Card style={baseCardStyle()}>
          <SectionTitle>Readiness check</SectionTitle>
          {['sleep', 'energy', 'soreness'].map((k) => (
            <div key={k} style={{ marginBottom: spacing[8] }}>
              <p style={{ margin: `0 0 ${spacing[6]}px`, fontSize: 12, color: colors.text }}>{k[0].toUpperCase() + k.slice(1)}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: spacing[6] }}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={`${k}-${v}`} type="button" onClick={() => data.setReadiness(k, v)} style={{ minHeight: 40, borderRadius: 999, border: `1px solid ${colors.border}`, background: data.readiness[k] === v ? colors.primarySubtle : colors.surface2 }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>
      ) : null}
      <TodayWorkoutHeroSection
        title="Today's session hero"
        subtitle={data.workoutName}
        exercises={data.exercises}
        hasWorkoutToday={data.hasWorkoutToday}
        hasProgramAssigned={data.hasProgramAssigned}
        onStartWorkout={data.onStartWorkout}
        onNoProgramAction={() => navigate('/program-builder?personal=1')}
        startLabel="Start workout →"
        accent={colors.primary}
        restLabel={data.restLabel}
        isDesktopWeb={isDesktopWeb}
        audience="personal"
        noProgramTitle={noPlanCopy.title}
        noProgramBody={noPlanCopy.subtitle}
        noProgramCtaLabel="Create your plan"
      />
      {showWeeklyScore && data.weeklyScore && !data.weeklyScoreDismissed ? (
        <Card style={{ ...standardCard, padding: spacing[16] }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.muted, margin: 0, marginBottom: spacing[8] }}>
            This week's effort
          </p>
          <p style={{ fontSize: 36, fontWeight: 700, color: colors.text, margin: 0 }}>
            {data.weeklyScore.total}
            <span style={{ fontSize: 16, color: colors.muted }}>/99</span>
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, margin: `${spacing[4]}px 0` }}>
            {data.weeklyScore.grade}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4], marginTop: spacing[8] }}>
            {[
              { label: 'Training', score: data.weeklyScore.trainingScore },
              { label: 'Nutrition', score: data.weeklyScore.nutritionScore },
              { label: 'Recovery', score: data.weeklyScore.recoveryScore },
            ].map(({ label, score }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: spacing[8] }}>
                <span style={{ fontSize: 12, color: colors.muted, width: 70 }}>{label}</span>
                <div style={{ flex: 1, height: 4, background: colors.surface2, borderRadius: 2 }}>
                  <div style={{ width: `${(score / 33) * 100}%`, height: '100%', borderRadius: 2, background: score >= 25 ? colors.success : score >= 15 ? colors.primary : colors.warning }} />
                </div>
                <span style={{ fontSize: 12, color: colors.text, width: 24, textAlign: 'right' }}>{score}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: colors.primary, marginTop: spacing[12], marginBottom: 0 }}>
            Focus: {data.weeklyScore.focusArea?.tip}
          </p>
          <button
            type="button"
            onClick={() => {
              data.setWeeklyScoreDismissed?.(true);
              localStorage.setItem(
                `atlas_weekly_score_dismissed_${getISOWeek()}`, '1'
              );
            }}
            style={{ fontSize: 11, color: colors.muted, background: 'none', border: 'none', cursor: 'pointer', marginTop: spacing[8], padding: 0 }}
          >
            Dismiss until next week
          </button>
        </Card>
      ) : null}
      {isDesktopWeb ? (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: spacing[12] }}>
          <div />
          <div style={{ display: 'grid', gap: spacing[12] }}>{rightColumn}</div>
        </div>
      ) : (
        rightColumn
      )}
      {data.showCoachUpsellCard ? (
        <Card style={baseCardStyle(colors.primary)}>
          <SectionTitle>Find a coach</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>
            You have been consistent for 8+ weeks with visible progress — a coach can help you push the next phase.
          </p>
          {Array.isArray(data.coachUpsellPreview) && data.coachUpsellPreview.length > 0 ? (
            <div style={{ display: 'grid', gap: spacing[8], marginTop: spacing[10] }}>
              {data.coachUpsellPreview.map((row) => (
                <button
                  key={row.id || row.coach_id}
                  type="button"
                  onClick={() => navigate(row.slug ? `/coach/${encodeURIComponent(row.slug)}` : '/discover')}
                  style={{
                    textAlign: 'left',
                    padding: spacing[12],
                    borderRadius: radii.card,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface2,
                    cursor: 'pointer',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>
                    {row.display_name || row.profile?.full_name || 'Coach'}
                  </p>
                  {row.pricing_summary ? (
                    <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>{row.pricing_summary}</p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          <Button type="button" onClick={() => navigate('/discover')} style={{ marginTop: spacing[10] }}>
            Browse marketplace →
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function PersonalCompToday({ data }) {
  const { navigate } = data;
  const noPlanCopy = personalHomeTrainingCardCopy('no_plan', data.personalGoalBucket);
  return (
    <div style={{ display: 'grid', gap: spacing[12] }}>
      <Card style={baseCardStyle(colors.warning)}>
        <SectionTitle>Prep phase hero</SectionTitle>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.text }}>
          Week {data.prepWeek} of {data.prepTotalWeeks} — {data.prepPhase}
        </p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>
          Today's protocol: carbs {data.peakWeekTargets.carbs}g · cardio {data.cardioTarget} min · posing {data.posingTargetMinutes} min
        </p>
      </Card>
      <Card style={baseCardStyle()}>
        <SectionTitle>Conditioning tracker</SectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{data.conditioningLine}</p>
      </Card>
      <TodayWorkoutHeroSection
        title="Today's session hero"
        subtitle={data.workoutName}
        exercises={data.exercises}
        hasWorkoutToday={data.hasWorkoutToday}
        hasProgramAssigned={data.hasProgramAssigned}
        onStartWorkout={data.onStartWorkout}
        onNoProgramAction={() => navigate('/program-builder?personal=1')}
        startLabel={data.hasProgramAssigned ? 'Start workout →' : 'Explore exercise library →'}
        accent={colors.warning}
        audience="personal"
        noProgramTitle={noPlanCopy.title}
        noProgramBody={noPlanCopy.subtitle}
        noProgramCtaLabel="Create your plan"
      />
      <Card style={baseCardStyle()}>
        <SectionTitle>Self-assessment pose check</SectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: colors.text }}>
          This week's {data.division || 'division'} pose self-check · last score {data.lastPoseScore}
        </p>
        <Button type="button" onClick={() => navigate('/pose-self-assessment')} style={{ marginTop: spacing[10] }}>
          Start check →
        </Button>
      </Card>
      <Card style={baseCardStyle()}>
        <SectionTitle>Macro ring + weight log</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[10] }}>
          <button type="button" onClick={() => navigate('/nutrition?openScanner=1')} style={{ minHeight: 60, borderRadius: radii.card, border: `1px solid ${colors.border}`, background: colors.surface2 }}>
            {data.nutritionLine}
          </button>
          <button type="button" onClick={() => navigate('/progress')} style={{ minHeight: 60, borderRadius: radii.card, border: `1px solid ${colors.border}`, background: colors.surface2 }}>
            {data.weightLine}
          </button>
        </div>
      </Card>
      {data.showCoachDiscovery ? (
        <Card style={baseCardStyle()}>
          <SectionTitle>Find a coach prompt</SectionTitle>
          <p style={{ margin: 0, fontSize: 13, color: colors.text }}>You are in the 6-10 week window — explore prep coaches for peak support.</p>
          <Button type="button" onClick={() => navigate('/discover?type=competition')} style={{ marginTop: spacing[10] }}>
            Explore coaches →
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, effectiveRole, isCompPrepClient, prepContext, activeContestPrep, profile: authProfile } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
  const isPersonalRole = !isClient(effectiveRole);
  const hasCompetitionPrep = Boolean(activeContestPrep?.id) || Boolean(prepContext);
  const variant = useMemo(() => {
    if (isPersonalRole) {
      return hasCompetitionPrep ? 'personal_comp' : 'personal_transform';
    }
    return isCompPrepClient ? 'client_comp' : 'client_transform';
  }, [isPersonalRole, hasCompetitionPrep, isCompPrepClient]);
  const normalizedRole = isPersonalRole ? 'personal' : 'client';
  const todayDataHook = useTodayPageData({
    role: normalizedRole,
    variant,
    hasCompPrepAccess: Boolean(isCompPrepClient || hasCompetitionPrep),
  });

  const userId = authProfile?.id;
  const { pullY, refreshing, handlers } = usePullToRefresh({
    disabled: isDesktopWeb,
    queryKeys: ['today-page-v2-bundle'],
  });

  const todayBundle = todayDataHook.todayBundle;

  const clientProfile = isPersonalRole ? null : todayBundle?.clientProfile;
  const profile = isPersonalRole ? authProfile : clientProfile;
  const assignedWorkout = todayBundle?.assignedWorkout ?? null;
  const nutritionPlan = todayBundle?.nutritionPlan ?? null;
  const weightRows = todayBundle?.weightRows ?? [];
  const retentionStreaks = todayBundle?.retentionStreaks ?? null;
  const coachMeta = todayBundle?.coachMeta ?? null;
  const mealTotalsToday = todayBundle?.mealTotalsToday ?? null;
  const clientCheckinsCount = todayBundle?.clientCheckinsCount ?? 0;
  const personalWorkoutsCompleted = todayBundle?.personalWorkoutsCompleted ?? 0;

  const weightChangeLast8Weeks = useMemo(() => {
    if (!weightRows.length) return 0;
    const cur = Number(weightRows[0]?.weight);
    const idx = Math.min(weightRows.length - 1, 7);
    const older = Number(weightRows[idx]?.weight);
    if (!Number.isFinite(cur) || !Number.isFinite(older)) return 0;
    return cur - older;
  }, [weightRows]);

  const joinedWeeksAgo = useMemo(() => {
    const c = authProfile?.created_at || profile?.created_at;
    if (!c) return 0;
    const t = new Date(c).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.floor((Date.now() - t) / 604800000);
  }, [authProfile?.created_at, profile?.created_at]);

  const prepProgress = useMemo(() => {
    if (isPersonalRole || !activeContestPrep) return null;
    const startW = Number(activeContestPrep.prep_start_weight_kg);
    const targetW = Number(activeContestPrep.target_stage_weight_kg);
    const curW = weightRows.length ? Number(weightRows[0].weight) : NaN;
    const showDate = activeContestPrep.show_date;
    const startDate =
      activeContestPrep.prep_started_at
      || activeContestPrep.created_at
      || activeContestPrep.start_date
      || activeContestPrep.prep_start_date;
    if (!Number.isFinite(startW) || !Number.isFinite(targetW) || !Number.isFinite(curW) || !showDate || !startDate) {
      return null;
    }
    return calculatePrepProgress({
      startWeight: startW,
      targetWeight: targetW,
      currentWeight: curW,
      startDate,
      showDate,
    });
  }, [isPersonalRole, activeContestPrep, weightRows]);

  const showCoachUpsellCard = useMemo(
    () =>
      isPersonalRole
      && variant === 'personal_transform'
      && !hasCompetitionPrep
      && shouldShowCoachUpsell({
        joinedWeeksAgo,
        workoutsCompleted: personalWorkoutsCompleted,
        weightChangeKg: weightChangeLast8Weeks,
        hasSeenUpsell: !!authProfile?.coach_upsell_seen_at,
        hasCoach: Boolean(authProfile?.trainer_id || authProfile?.coach_id),
        clientGoal: authProfile?.goal || authProfile?.personal_goal,
      }),
    [
      isPersonalRole,
      variant,
      hasCompetitionPrep,
      joinedWeeksAgo,
      personalWorkoutsCompleted,
      weightChangeLast8Weeks,
      authProfile?.coach_upsell_seen_at,
      authProfile?.trainer_id,
      authProfile?.coach_id,
      authProfile?.goal,
      authProfile?.personal_goal,
    ],
  );

  const { data: coachUpsellPreview = [] } = useQuery({
    // Kept: not in V2 bundle — marketplace coach previews only when upsell card is shown.
    queryKey: ['today-coach-upsell-preview', userId],
    queryFn: () => fetchCompetitionCoachPreviews(getSupabase(), authProfile?.division || 'bikini'),
    enabled: Boolean(hasSupabase && userId && showCoachUpsellCard),
    staleTime: 300_000,
  });

  const showFirstCheckInPrompt = useMemo(() => {
    if (isPersonalRole) return false;
    const created = profile?.created_at;
    if (!created) return false;
    const daysSinceJoining = Math.floor((Date.now() - new Date(created).getTime()) / 86400000);
    return daysSinceJoining >= 7 && clientCheckinsCount === 0;
  }, [isPersonalRole, profile?.created_at, clientCheckinsCount]);

  const exercises = useMemo(() => (assignedWorkout?.exercises || []).map(normaliseExercise), [assignedWorkout?.exercises]);
  const hasWorkoutToday = Boolean(assignedWorkout?.day);
  const hasProgramAssigned = Boolean(assignedWorkout?.block || assignedWorkout?.program || assignedWorkout?.day);

  const progressText = useMemo(() => {
    if (!weightRows.length || !Number.isFinite(weightRows[0]?.weight)) return null;
    const currentWeight = Number(weightRows[0].weight);
    const startWeight = Number(weightRows[weightRows.length - 1]?.weight ?? currentWeight);
    const interp = interpretWeightProgress({
      currentWeight,
      startWeight,
      targetWeight: weightRows[0]?.targetWeight || null,
      recentWeights: weightRows.map((w) => ({ weight: w.weight, date: w.date })),
      clientGoal: clientGoalFromGoalsField(profile?.goals || profile?.goal || profile?.personal_goal),
    });
    return interp?.interpretation || null;
  }, [weightRows, profile?.goals, profile?.goal, profile?.personal_goal]);

  const readinessKey = useMemo(() => `atlas_readiness_${getLocalDateKey()}`, []);
  const [readiness, setReadiness] = useState({ sleep: null, energy: null, soreness: null });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(readinessKey);
      if (raw) setReadiness(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [readinessKey]);
  const setReadinessValue = useCallback((k, v) => {
    setReadiness((prev) => {
      const next = { ...prev, [k]: v };
      if (next.sleep && next.energy && next.soreness) {
        try { localStorage.setItem(readinessKey, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [readinessKey]);
  const readinessDone = Boolean(readiness.sleep && readiness.energy && readiness.soreness);

  const [habitState, setHabitState] = useState({});
  const habitNames = useMemo(
    () => (retentionStreaks?.weeklyProgress ? Object.keys(retentionStreaks.weeklyProgress).filter((k) => !['workout', 'nutrition'].includes(k)).slice(0, 5) : []),
    [retentionStreaks?.weeklyProgress]
  );
  const habits = useMemo(() => habitNames.map((k) => ({ key: k, label: k.replaceAll('_', ' '), done: Boolean(habitState[k]) })), [habitNames, habitState]);
  const toggleHabit = useCallback((key) => setHabitState((p) => ({ ...p, [key]: !p[key] })), []);

  const personalMealTotalsToday = useMemo(() => {
    if (!isPersonalRole || !userId) return { calories: 0, protein: 0 };
    const today = getLocalDateKey();
    const logs = listPersonalMealLogs(userId, today);
    return logs.reduce(
      (acc, meal) => ({
        calories: acc.calories + (Number(meal?.calories) || 0),
        protein: acc.protein + (Number(meal?.protein_g) || 0),
      }),
      { calories: 0, protein: 0 },
    );
  }, [isPersonalRole, userId, todayBundle]);

  // Online, personal meals live in the DB (mealTotalsToday, keyed by
  // profile_id); the localStorage personalMealTotalsToday is only the offline
  // fallback. Reading localStorage first meant meals logged on /nutrition (DB)
  // never reached the macro ring.
  const caloriesLogged = mealTotalsToday
    ? Number(mealTotalsToday.calories) || 0
    : (isPersonalRole ? personalMealTotalsToday.calories : 0);
  const proteinLogged = mealTotalsToday
    ? Number(mealTotalsToday.protein) || 0
    : (isPersonalRole ? personalMealTotalsToday.protein : 0);
  const calorieTarget = Number(nutritionPlan?.calories || nutritionPlan?.calorie_target || nutritionPlan?.target_calories || 0);
  const proteinTarget = Number(nutritionPlan?.protein || nutritionPlan?.protein_g || nutritionPlan?.target_protein_g || 0);
  const nutritionWeeklyDone = Number(retentionStreaks?.weeklyProgress?.nutrition?.done ?? 0);
  const nutritionWeeklyTarget = Math.max(1, Number(retentionStreaks?.weeklyProgress?.nutrition?.target ?? 7) || 7);
  const workoutWeeklyDone = Number(retentionStreaks?.weeklyProgress?.workout?.done ?? 0);
  const workoutWeeklyTarget = Math.max(1, Number(retentionStreaks?.weeklyProgress?.workout?.target ?? 4) || 4);
  const checkinWeeklyDone = Number(retentionStreaks?.weeklyProgress?.checkin?.done ?? 0);
  const checkinWeeklyTarget = Math.max(1, Number(retentionStreaks?.weeklyProgress?.checkin?.target ?? 7) || 7);
  const weeklyScore = useMemo(
    () => calculateWeeklyScore({
      workoutsCompleted: workoutWeeklyDone,
      workoutsPlanned: workoutWeeklyTarget,
      nutritionDaysHit: nutritionWeeklyDone,
      totalDays: nutritionWeeklyTarget,
      recoveryDaysLogged: checkinWeeklyDone,
      recoveryDaysTarget: checkinWeeklyTarget,
    }),
    [workoutWeeklyDone, workoutWeeklyTarget, nutritionWeeklyDone, nutritionWeeklyTarget, checkinWeeklyDone, checkinWeeklyTarget],
  );
  const weeklyScoreDismissed = useMemo(() => {
    const week = getISOWeek();
    return localStorage.getItem(
      `atlas_weekly_score_dismissed_${week}`
    ) === '1';
  }, []);
  const [weeklyScoreDismissedState, setWeeklyScoreDismissed] = useState(weeklyScoreDismissed);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState(
    () => localStorage.getItem('atlas_weight_unit') || 'kg'
  );
  const guidance = useMemo(() => {
    const list = getContextualGuidance({
      isTrainingDay: hasWorkoutToday,
      currentHour: new Date().getHours(),
      caloriesLogged,
      calorieTarget,
      proteinLogged,
      proteinTarget,
      habitsCompletedToday: habits.filter((h) => h.done).length,
      totalHabits: habits.length,
      lastWorkoutDaysAgo: 2,
    });
    return list[0] || null;
  }, [hasWorkoutToday, calorieTarget, proteinTarget, habits]);

  // Personal users get a native workout reminder too — it was only wired into the
  // client Today surfaces, so the Workouts notification toggle was an empty promise
  // for personal. No-op on web (native only) and deduped per day inside the helper.
  useEffect(() => {
    if (!isPersonalRole || !user?.id) return;
    scheduleWorkoutReminderIfNeeded({
      role: 'personal',
      profileId: user.id,
      workoutName: assignedWorkout?.day?.title || assignedWorkout?.block?.title || "Today's session",
      hasWorkoutToday,
      hasStartedWorkoutToday: false,
    }).catch(() => {});
  }, [isPersonalRole, user?.id, hasWorkoutToday, assignedWorkout?.day?.title, assignedWorkout?.block?.title]);

  const calorieDiff = caloriesLogged - calorieTarget;
  const nowHour = new Date().getHours();
  const proteinRemaining = Math.max(0, proteinTarget - proteinLogged);
  const caloriesRemaining = calorieTarget > 0 ? calorieTarget - caloriesLogged : 0;
  const nutritionInterpretationLine = (() => {
    if (!(calorieTarget > 0 || proteinTarget > 0)) return null;
    if (proteinRemaining > 40 && nowHour >= 16) {
      return `${Math.round(proteinRemaining)}g protein still needed — try chicken, eggs or a shake before bed to hit your target.`;
    }
    if (caloriesRemaining < 50 && caloriesRemaining >= 0) {
      return 'Almost at your target — great tracking today.';
    }
    if (calorieDiff > 200) {
      return `${Math.round(calorieDiff)}kcal over today. One day won't derail your progress — get back to target tomorrow.`;
    }
    return null;
  })();

  const weeklyWeightTrendLine = (() => {
    if (!Array.isArray(weightRows) || weightRows.length < 2) return null;
    const currentWeight = Number(weightRows[0]?.weight);
    const weightSevenDaysAgo = Number(weightRows[Math.min(weightRows.length - 1, 6)]?.weight);
    if (!Number.isFinite(currentWeight) || !Number.isFinite(weightSevenDaysAgo)) return null;
    const weeklyChange = currentWeight - weightSevenDaysAgo;
    const trend = Math.abs(weeklyChange) < 0.2
      ? 'holding steady'
      : weeklyChange < 0
        ? `losing ${Math.abs(weeklyChange).toFixed(1)}kg/week`
        : `gaining ${weeklyChange.toFixed(1)}kg/week`;
    const goalRaw = String(profile?.goal || profile?.personal_goal || '').toLowerCase();
    const isLoseFatGoal = goalRaw.includes('lose') || goalRaw.includes('fat') || goalRaw.includes('cut');
    const isBuildGoal = goalRaw.includes('build') || goalRaw.includes('muscle') || goalRaw.includes('bulk');
    const goalContext =
      isLoseFatGoal && weeklyChange < -0.8
        ? '— slightly fast, consider a refeed day'
        : isLoseFatGoal && weeklyChange > 0
          ? '— small rise, likely water weight'
          : isBuildGoal && weeklyChange < 0.1
            ? '— add 100kcal to restart growth'
            : isLoseFatGoal && weeklyChange < 0
              ? '— healthy rate for your cut'
              : '';
    return `${trend} ${goalContext}`.trim();
  })();

  if (todayDataHook.isLoading && !todayDataHook.profile) {
    return (
      <div
        {...handlers}
        style={{ position: 'relative', paddingTop: spacing[12], paddingBottom: spacing[24], paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH }}
      >
        <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} />
        <PageLoader />
      </div>
    );
  }

  async function handleLogWeight() {
    const rawValue = Number(weightInput);
    const valueKg = weightUnit === 'lb' ? rawValue * 0.453592 : rawValue;
    if (!valueKg || valueKg <= 0) return;
    try {
      const supabase = getSupabase();
      if (!supabase || !userId) return;
      // client_weight_logs is keyed by the clients-row id; the old insert used
      // a nonexistent profile_id column and never checked the error, so this
      // showed "Weight logged" while saving nothing.
      let error = null;
      if (isPersonalRole) {
        ({ error } = await supabase.from('personal_checkins').insert({ user_id: userId, weight: valueKg }));
      } else {
        const clientRowId = todayDataHook.profile?.id ?? null;
        if (!clientRowId) throw new Error('No client record');
        ({ error } = await supabase.from('client_weight_logs').insert({
          client_id: clientRowId,
          weight: valueKg,
          log_date: getLocalDateKey(),
        }));
      }
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['today-page-v2-bundle'] });
      setWeightSheetOpen(false);
      setWeightInput('');
      toast.success('Weight logged');
    } catch (_) {
      toast.error('Couldn\'t save — try again');
    }
  }

  const personalGoalBucket = getPersonalGoalBucketFromProfile({ profile: authProfile, user });

  const todayData = {
    navigate,
    exercises,
    hasWorkoutToday,
    hasProgramAssigned,
    onStartWorkout: () => navigate('/workout-player'),
    workoutName: assignedWorkout?.assignment?.client_display_name || assignedWorkout?.day?.title || assignedWorkout?.block?.title || "Today's session",
    heroAccent: colors.primary,
    restLabel: !hasWorkoutToday
      ? (hasProgramAssigned
        ? 'Rest day · next session: tomorrow'
        : (isPersonalRole ? 'Build your programme in My plan or the builder' : 'Ask your coach for a programme'))
      : null,
    personalGoalBucket,
    progressText,
    hasNutritionTargets: calorieTarget > 0 || proteinTarget > 0,
    nutritionLine: `${Math.max(0, calorieTarget - caloriesLogged)}kcal remaining · ${Math.max(0, proteinTarget - proteinLogged)}g protein still needed`,
    nutritionInterpretationLine,
    habits,
    toggleHabit,
    guidance: guidance && guidance.priority > 0 ? guidance : null,
    coachName: coachMeta?.coachName || 'Coach',
    coachFirstName: String(coachMeta?.coachName || 'Coach').split(' ')[0],
    unreadCount: coachMeta?.unread || 0,
    lastFeedbackLabel: 'Last feedback: No feedback yet',
    prepContext: prepContext || activeContestPrep || null,
    compWorkoutLabel: `${prepContext?.phaseLabel || 'Mid prep'} · ${assignedWorkout?.day?.title || 'today session'}`,
    onTrackLine: progressText ? 'On track' : 'No progress data yet.',
    peakWeekTargets: { carbs: 220, waterL: 4, sodium: 'restricted' },
    poseCheckDue: true,
    poseName: 'mandatory check-ins',
    posingTodayMinutes: 12,
    posingTargetMinutes: 20,
    posingWeekMinutes: 48,
    readiness,
    setReadiness: setReadinessValue,
    readinessDone,
    weeklyScore,
    weeklyScoreDismissed: weeklyScoreDismissedState,
    setWeeklyScoreDismissed,
    weightLine: weightRows[0]?.weight ? `${Number(weightRows[0].weight).toFixed(1)}kg — latest` : 'Log today →',
    todayWeight: weightRows[0]?.weight ? Number(weightRows[0].weight) : null,
    weightTrendLine: weeklyWeightTrendLine,
    openWeightSheet: () => setWeightSheetOpen(true),
    plateauOrMotivation: null,
    prepWeek: prepContext?.weeksOut ? Math.max(1, 20 - Number(prepContext.weeksOut)) : 1,
    prepTotalWeeks: 20,
    prepPhase: prepContext?.phaseLabel || 'Prep',
    cardioTarget: 35,
    conditioningLine: '~8 weeks of cutting remaining at current pace — on a healthy deficit',
    division: prepContext?.division || activeContestPrep?.division || null,
    lastPoseScore: '6.8/10',
    showCoachDiscovery: shouldShowCoachDiscovery({ weeksOut: prepContext?.weeksOut || null, hasCoach: Boolean(profile?.trainer_id || profile?.coach_id), hasSeenPrompt: Boolean(profile?.coach_discovery_prompt_seen_at) }),
    prepProgress,
    showFirstCheckInPrompt,
    showCoachUpsellCard,
    coachUpsellPreview: Array.isArray(coachUpsellPreview) ? coachUpsellPreview.slice(0, 2) : [],
  };

  return (
    <div
      {...handlers}
      style={{ position: 'relative', paddingTop: spacing[12], paddingBottom: spacing[24], paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH }}
    >
      <PullToRefreshIndicator pullY={pullY} refreshing={refreshing} />
      {variant === 'client_comp' ? <ClientCompToday data={todayData} /> : null}
      {variant === 'client_transform' ? <ClientTransformToday data={todayData} isDesktopWeb={isDesktopWeb} /> : null}
      {variant === 'personal_comp' ? <PersonalCompToday data={todayData} /> : null}
      {variant === 'personal_transform' ? <PersonalTransformToday data={todayData} isDesktopWeb={isDesktopWeb} /> : null}
      {weightSheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log weight"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setWeightSheetOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              background: colors.bg,
              borderRadius: '16px 16px 0 0',
              padding: spacing[20],
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: colors.text,
                marginBottom: spacing[16],
              }}
            >
              Log weight
            </p>
            <div
              style={{
                display: 'flex',
                gap: spacing[8],
                alignItems: 'center',
                marginBottom: spacing[16],
              }}
            >
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={weightInput}
                onChange={(event) => setWeightInput(event.target.value)}
                placeholder="84.2"
                style={{
                  flex: 1,
                  fontSize: 24,
                  fontWeight: 500,
                  color: colors.text,
                  background: colors.surface1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.lg,
                  padding: spacing[12],
                  outline: 'none',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.md,
                  overflow: 'hidden',
                }}
              >
                {['kg', 'lb'].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => {
                      setWeightUnit(unit);
                      localStorage.setItem('atlas_weight_unit', unit);
                    }}
                    style={{
                      padding: `${spacing[8]}px ${spacing[12]}px`,
                      background: weightUnit === unit ? colors.primary : 'transparent',
                      color: weightUnit === unit ? '#fff' : colors.muted,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogWeight}
              disabled={!weightInput || Number(weightInput) <= 0}
              style={{
                width: '100%',
                height: 48,
                background: Number(weightInput) > 0 ? colors.primary : colors.border,
                color: Number(weightInput) > 0 ? '#fff' : colors.muted,
                border: 'none',
                borderRadius: radii.lg,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
