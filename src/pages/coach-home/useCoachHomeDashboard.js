import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { captureUiError } from '@/services/errorLogger';
import { coachFocusLabel } from '@/lib/data/coachTypeHelpers';
import { journeyRosterBucket } from '@/lib/clientJourney';
import { generateCoachWorkloadQueue, summarizeCoachWorkload } from '@/lib/coachWorkloadEngine';
import {
  buildCoachPriorityStripCounts,
  filterCoachWorkloadByStrip,
} from '@/lib/coachDailyWorkflowModel';
import {
  evaluateUpgradeTriggers,
  selectUpgradePrompt,
} from '@/utils/upgradeTriggers';
import { resolveCoachPlanTier } from '@/config/plans';
import {
  loadPriorityCoachHomeData,
  loadSecondaryCoachHomeData,
  combineCoachHomeDashboardData,
  getEmptySecondaryCoachHomePayload,
} from '@/pages/coach-home/loadCoachHomeDashboardData';

/**
 * Phased coach-home queries + derived queue / strip / intro state.
 * Keeps React Query stale/gc behaviour identical to the previous inline CoachHomePage logic.
 */
export function useCoachHomeDashboard({
  coachId,
  isCoachRole,
  showPoseAndPeak,
  isIntegratedCoach,
  coachStripKey,
  dashboardRefreshKey,
  coachFocus,
  profile,
  user,
  billingState,
  dismissedUpgradePromptId,
}) {
  const planTier = resolveCoachPlanTier(profile, user);

  const priorityQuery = useQuery({
    queryKey: ['coach-home-priority', coachId, showPoseAndPeak, isIntegratedCoach, dashboardRefreshKey],
    queryFn: async () => {
      try {
        return await loadPriorityCoachHomeData(coachId, { showPoseAndPeak, isIntegratedCoach });
      } catch (err) {
        captureUiError('CoachHomePriority', err);
        throw err;
      }
    },
    enabled: isCoachRole && !!coachId,
    staleTime: 45_000,
    gcTime: 5 * 60_000,
  });

  const secondaryQuery = useQuery({
    queryKey: ['coach-home-secondary', coachId, dashboardRefreshKey],
    queryFn: async () => {
      try {
        return await loadSecondaryCoachHomeData(coachId);
      } catch (err) {
        captureUiError('CoachHomeSecondary', err);
        throw err;
      }
    },
    enabled: isCoachRole && !!coachId && priorityQuery.isSuccess,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData ?? getEmptySecondaryCoachHomePayload(),
  });

  const d = useMemo(
    () => combineCoachHomeDashboardData(priorityQuery.data, secondaryQuery.data),
    [priorityQuery.data, secondaryQuery.data],
  );

  const attention = d?.attention ?? [];
  const newCheckins = d?.newCheckins ?? [];
  const poseNew = d?.poseNew ?? [];
  const poseDue = d?.poseDue ?? [];
  const moneyDashboard = d?.moneyDashboard ?? null;
  const revenueSummary = d?.revenueSummary ?? null;
  const overdueSubscriptions = d?.overdueSubscriptions ?? [];
  const overdueClients = d?.overdueClients ?? [];
  const retentionRisk = d?.retentionRisk ?? { high: 0, medium: 0 };
  const healthAlerts = d?.healthAlerts ?? [];
  const coachingAlerts = d?.coachingAlerts ?? [];
  const peakWeekDueCount = d?.peakWeekDueCount ?? 0;
  const reviewsDueCount = d?.reviewsDueCount ?? 0;
  const reviewCountsByType = d?.reviewCountsByType ?? { checkin: 0, pose_check: 0 };
  const reviewQueueItems = d?.reviewQueueItems ?? [];
  const unreadThreads = d?.unreadThreads ?? [];
  const progressTrendByClient = d?.progressTrendByClient ?? {};
  const rosterHealth = d?.rosterHealth ?? { avgCompliance: null, clientsWithFlags: 0, checkinsDue: 0 };
  const clientJourneyById = d?.clientJourneyById ?? {};

  const dashboardLoading = isCoachRole && !!coachId && priorityQuery.isPending;
  const dashboardError = priorityQuery.isError;

  const coachHomeIntro = useMemo(() => {
    const eyebrow = coachFocusLabel(coachFocus);
    if (coachFocus === 'competition') {
      return {
        eyebrow,
        line: 'Command center for stage clients — check-ins, posing, and peak week. Invite athletes from Home (link, code, or QR), then assign programs so they see Today.',
      };
    }
    if (coachFocus === 'integrated') {
      return {
        eyebrow,
        line: 'Lifestyle and prep in one workspace. Filter Clients by journey; Review Center holds everything waiting on you.',
      };
    }
    return {
      eyebrow,
      line: 'Invite clients, build programs, and assign work — they train from Today. Review Center queues check-ins and tasks for you.',
    };
  }, [coachFocus]);

  const todayFocusHeader = useMemo(() => {
    const title = "Today's focus";
    if (coachFocus === 'competition') {
      return {
        title,
        subtitle: 'Stage-season rhythm: use the strip for posing, peak week, and check-ins before you open Review Center.',
      };
    }
    if (coachFocus === 'integrated') {
      return {
        title,
        subtitle: 'Blend lifestyle and prep in one queue — filter the strip, then drill into Review Center or Messages.',
      };
    }
    return {
      title,
      subtitle: 'Prioritize what matters today — no urgent pressure. Build, assign, and stay ahead of check-ins.',
    };
  }, [coachFocus]);

  const attentionSplitBuckets = useMemo(() => {
    const attentionList = Array.isArray(attention) ? attention : [];
    if (!isIntegratedCoach || attentionList.length === 0) return null;
    if (!clientJourneyById || Object.keys(clientJourneyById).length === 0) return null;
    const prep = attentionList.filter((i) => journeyRosterBucket(clientJourneyById[i.client_id] || {}) === 'prep');
    const lifestyle = attentionList.filter((i) => journeyRosterBucket(clientJourneyById[i.client_id] || {}) === 'lifestyle');
    if (prep.length === 0 && lifestyle.length === 0) return null;
    return { prep, lifestyle };
  }, [isIntegratedCoach, attention, clientJourneyById]);

  const clientsAtRiskToday = useMemo(() => {
    const list = Array.isArray(attention) ? attention : [];
    const riskRank = { high: 3, medium: 2, low: 1 };
    return list
      .filter((item) => ['high', 'medium'].includes(String(item?.risk_level || '').toLowerCase()))
      .sort((a, b) => {
        const riskDiff =
          (riskRank[String(b?.risk_level || '').toLowerCase()] || 0) -
          (riskRank[String(a?.risk_level || '').toLowerCase()] || 0);
        if (riskDiff !== 0) return riskDiff;
        return (b?.attention_priority ?? 0) - (a?.attention_priority ?? 0);
      })
      .slice(0, 4);
  }, [attention]);

  const workloadQueue = useMemo(
    () =>
      generateCoachWorkloadQueue({
        reviewItems: reviewQueueItems,
        attentionItems: attention,
        overdueSubscriptions,
        unreadThreads,
        poseDue,
        poseNew,
        peakWeekDueCount,
        progressTrendByClient,
      }),
    [reviewQueueItems, attention, overdueSubscriptions, unreadThreads, poseDue, poseNew, peakWeekDueCount, progressTrendByClient],
  );

  const workloadSummary = useMemo(() => summarizeCoachWorkload(workloadQueue), [workloadQueue]);
  const topPriorities = useMemo(() => workloadQueue.slice(0, 5), [workloadQueue]);

  const coachStripCounts = useMemo(
    () =>
      buildCoachPriorityStripCounts({
        workloadQueue,
        newCheckinsCount: Array.isArray(newCheckins) ? newCheckins.length : 0,
        peakWeekDueCount,
        unreadThreadCount: Array.isArray(unreadThreads) ? unreadThreads.length : 0,
        atRiskClientCount: clientsAtRiskToday.length,
        showPoseAndPeak,
      }),
    [workloadQueue, newCheckins, peakWeekDueCount, unreadThreads, clientsAtRiskToday.length, showPoseAndPeak],
  );

  const filteredCoachQueue = useMemo(
    () => filterCoachWorkloadByStrip(workloadQueue, coachStripKey, { showPoseAndPeak }),
    [workloadQueue, coachStripKey, showPoseAndPeak],
  );

  const priorityFeedItems = useMemo(() => filteredCoachQueue.slice(0, 12), [filteredCoachQueue]);

  const coachUpgradePrompt = useMemo(() => {
    const dash = moneyDashboard || {};
    const activeClientCount = Number(revenueSummary?.active_clients ?? dash.active_clients_count ?? 0) || 0;
    const result = evaluateUpgradeTriggers({
      clientCount: activeClientCount,
      monthlyRevenue: Number(revenueSummary?.revenue_last_30d ?? dash.monthly_revenue_expected ?? 0),
      currentPlan: planTier,
      billingState,
    });
    const selected = selectUpgradePrompt(result.prompts, { allowMajor: true });
    if (selected?.id && selected.id === dismissedUpgradePromptId) return null;
    return selected;
  }, [moneyDashboard, revenueSummary, planTier, billingState, dismissedUpgradePromptId]);

  return {
    priorityQuery,
    secondaryQuery,
    dashboardLoading,
    dashboardError,
    planTier,
    d,
    attention,
    newCheckins,
    poseNew,
    poseDue,
    moneyDashboard,
    revenueSummary,
    overdueSubscriptions,
    overdueClients,
    retentionRisk,
    healthAlerts,
    coachingAlerts,
    peakWeekDueCount,
    reviewsDueCount,
    reviewCountsByType,
    reviewQueueItems,
    unreadThreads,
    progressTrendByClient,
    rosterHealth,
    clientJourneyById,
    coachHomeIntro,
    todayFocusHeader,
    attentionSplitBuckets,
    clientsAtRiskToday,
    workloadQueue,
    workloadSummary,
    topPriorities,
    coachStripCounts,
    filteredCoachQueue,
    priorityFeedItems,
    coachUpgradePrompt,
  };
}
