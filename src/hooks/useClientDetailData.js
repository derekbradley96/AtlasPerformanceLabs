import { useQuery } from '@tanstack/react-query';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import {
  fetchClientPrepPrecision,
  fetchClientPrepPrecisionDailyRange,
  todayLocalDateString,
  daysAgoDateString,
} from '@/data/prepPrecisionService';
import { fetchClientDailySnapshot } from '@/lib/clientDailySnapshot';
import { isCoach, isAdmin } from '@/lib/roles';

const CLIENT_DETAIL_CHECKINS_COLUMNS = [
  'id',
  'client_id',
  'trainer_id',
  'submitted_at',
  'status',
  'reviewed_at',
  'reviewed_by',
  'weight_kg',
  'created_at',
  'checkin_date',
  'week_start',
  'due_date',
  'notes',
  'nutrition_adherence',
  'sleep_hours',
];

function getMissingColumnNameFromError(error) {
  const message = String(error?.message || '');
  const m1 = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
  if (m1?.[1]) return m1[1];
  const m2 = message.match(/column\s+["']?([a-zA-Z0-9_.]+)["']?/i);
  if (m2?.[1]) {
    const parts = m2[1].split('.');
    return parts[parts.length - 1] || null;
  }
  return null;
}

/**
 * ClientDetail.jsx — data map read before extraction
 *
 * useQuery map moved into this hook:
 *
 * Group 1 — Check-ins
 *   queryKey: ['client-detail-checkins', clientId]
 *   table: checkins
 *   variable: checkInsSupabase
 *   JSX: checkInsListRaw → overview, health, OS panels, check-ins tab, milestones
 *
 * Group 2 — Programme assignments
 *   queryKey: ['client-detail-programs', clientId]
 *   table: program_block_assignments (+ program_blocks)
 *   variable: clientProgramsSupabase
 *   JSX: demoPrograms → program tab, assignedProgram, programme panels
 *
 * Group 3 — Progress metrics
 *   queryKey: ['v_client_progress_metrics', clientId]
 *   view: v_client_progress_metrics
 *   variable: progressMetrics
 *   JSX: atlasCoachingInsights, weightTrend, OS priority rail, overview metrics
 *
 * Group 4 — Retention risk
 *   queryKey: ['v_client_retention_risk', clientId]
 *   view: v_client_retention_risk
 *   variable: retentionRiskRow
 *   JSX: atlasCoachingInsights, risk banners, OS intelligence rail
 *
 * Group 5 — Lifecycle
 *   queryKey: ['v_client_lifecycle', clientId]
 *   view: v_client_lifecycle
 *   variable: lifecycleRow
 *   JSX: deriveCoachClientLifecycle, OS context, journey badges
 *
 * Group 6 — Coaching insights
 *   queryKey: ['coaching_insights', clientId]
 *   table: coaching_insights
 *   variable: coachingInsights
 *   JSX: OS intelligence rail, insight resolve UI (mutation invalidates this key)
 *
 * Group 7 — Adaptive recommendations
 *   queryKey: ['adaptive_recommendations', clientId]
 *   table: training_adjustment_recommendations
 *   variable: adaptiveRecommendations
 *   JSX: adaptive recommendation cards (coach/admin only)
 *
 * Group 8 — Momentum
 *   queryKey: ['v_client_momentum', clientId]
 *   view: v_client_momentum
 *   variable: momentumRows
 *   JSX: momentum score / status in OS overview
 *
 * Group 9 — Prep precision (snapshot)
 *   queryKey: ['client-os-prep-precision', clientId]
 *   service: prepPrecisionService.fetchClientPrepPrecision
 *   variable: osPrepRow
 *   JSX: prep tab, OS prep cards, competition context
 *
 * Group 10 — Prep precision dailies
 *   queryKey: ['client-os-prep-dailies', clientId, from, to]
 *   service: prepPrecisionService.fetchClientPrepPrecisionDailyRange
 *   variable: osPrepDailies
 *   JSX: prep trend / daily strip in OS
 *
 * Group 11 — Daily snapshot
 *   queryKey: ['client-daily-snapshot', clientId]
 *   service: fetchClientDailySnapshot
 *   variable: clientDailySnapshot
 *   JSX: OS top strip, formatClientDailySnapshotLines, pull-to-refresh invalidation
 *
 * Group 12 — Coach methodology packages
 *   queryKey: ['coach-methodology-packages', authUserId]
 *   table: methodology_packages
 *   variable: coachMethodologyPackages
 *   JSX: ClientDetailMethodologySheet
 *
 * useMutation map (stays in ClientDetail.jsx by design):
 *
 * Mutation A — markInsightResolvedMutation
 *   queryKey invalidated: ['coaching_insights', clientId]
 *   table: coaching_insights (update is_resolved=true)
 *   variable: markInsightResolvedMutation
 *   JSX: coaching insight action buttons in Client detail surfaces
 *
 * Mutation B — adaptiveStatusMutation
 *   queryKey invalidated: ['adaptive_recommendations', clientId]
 *   table: training_adjustment_recommendations (update status)
 *   variable: adaptiveStatusMutation
 *   JSX: adaptive recommendation status controls
 *
 * Mutation C — adaptiveEditMutation
 *   queryKey invalidated: ['adaptive_recommendations', clientId]
 *   table: training_adjustment_recommendations (update title/description)
 *   variable: adaptiveEditMutation
 *   JSX: adaptive recommendation edit form/actions
 *
 * Not in this hook (intentionally remains in ClientDetail.jsx):
 *   - client profile: data.getClient via loadClientDetail (offline/demo + live)
 *   - nutrition: getOrCreatePlan / listWeeks via loadNutrition
 *   - timeline: getPerformanceTimeline / getLegacyTimeline via loadTimeline
 *   - useClientMasterDashboard: separate hook
 *   - all useMutation blocks
 */

export function useClientDetailData({ clientId, authUserId, role }) {
  const supabaseClient = getSupabase();

  const { data: checkInsSupabase = [] } = useQuery({
    queryKey: ['client-detail-checkins', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return [];
      let activeColumns = [...CLIENT_DETAIL_CHECKINS_COLUMNS];
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data, error } = await supabaseClient
          .from('checkins')
          .select(activeColumns.join(', '))
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false })
          .limit(20);
        if (!error) {
          const rows = Array.isArray(data) ? data : [];
          return rows.map((row) => ({
            ...row,
            created_date: row?.created_date ?? row?.created_at ?? row?.submitted_at ?? row?.checkin_date ?? null,
            coach_reviewed_at: row?.coach_reviewed_at ?? row?.reviewed_at ?? null,
          }));
        }
        const missing = getMissingColumnNameFromError(error);
        if (!missing || !activeColumns.includes(missing)) return [];
        activeColumns = activeColumns.filter((col) => col !== missing);
        if (activeColumns.length === 0) return [];
      }
      return [];
    },
    enabled: Boolean(hasSupabase && clientId),
    staleTime: 2 * 60 * 1000,
  });

  const { data: clientProgramsSupabase = [] } = useQuery({
    queryKey: ['client-detail-programs', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return [];
      const { data, error } = await supabaseClient
        .from('program_block_assignments')
        .select('*, program_blocks(id, title, total_weeks)')
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && clientId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: progressMetrics, isLoading: progressMetricsLoading } = useQuery({
    queryKey: ['v_client_progress_metrics', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return null;
      const { data, error } = await supabaseClient
        .from('v_client_progress_metrics')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const { data: retentionRiskRow, isLoading: retentionRiskLoading } = useQuery({
    queryKey: ['v_client_retention_risk', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return null;
      const { data, error } = await supabaseClient
        .from('v_client_retention_risk')
        .select('client_id, coach_id, risk_score, risk_band, reasons')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const { data: lifecycleRow, isLoading: lifecycleLoading } = useQuery({
    queryKey: ['v_client_lifecycle', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return null;
      const { data, error } = await supabaseClient
        .from('v_client_lifecycle')
        .select('client_id, coach_id, lifecycle_stage, effective_stage')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const { data: coachingInsights = [] } = useQuery({
    queryKey: ['coaching_insights', clientId],
    queryFn: async () => {
      if (!hasSupabase || !clientId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('coaching_insights')
        .select('*')
        .eq('client_id', clientId)
        .order('is_resolved', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const canReviewAdaptiveRecommendations = isCoach(role) || isAdmin(role);
  const { data: adaptiveRecommendations = [] } = useQuery({
    queryKey: ['adaptive_recommendations', clientId],
    queryFn: async () => {
      if (!hasSupabase || !clientId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('training_adjustment_recommendations')
        .select('*')
        .eq('client_id', clientId)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && clientId && canReviewAdaptiveRecommendations),
  });

  const { data: momentumRows = [], isLoading: momentumLoading } = useQuery({
    queryKey: ['v_client_momentum', clientId],
    queryFn: async () => {
      if (!supabaseClient || !clientId) return [];
      const { data, error } = await supabaseClient
        .from('v_client_momentum')
        .select('week_start, training_score, nutrition_score, steps_score, sleep_score, checkin_score, total_score')
        .eq('client_id', clientId)
        .order('week_start', { ascending: false })
        .limit(12);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const prepOsFrom = daysAgoDateString(13);
  const prepOsTo = todayLocalDateString();
  const { data: osPrepRow } = useQuery({
    queryKey: ['client-os-prep-precision', clientId],
    queryFn: async () => {
      try {
        return await fetchClientPrepPrecision(clientId);
      } catch {
        return null;
      }
    },
    enabled: Boolean(hasSupabase && clientId),
  });
  const { data: osPrepDailies = [] } = useQuery({
    queryKey: ['client-os-prep-dailies', clientId, prepOsFrom, prepOsTo],
    queryFn: async () => {
      try {
        return await fetchClientPrepPrecisionDailyRange(clientId, prepOsFrom, prepOsTo);
      } catch {
        return [];
      }
    },
    enabled: Boolean(hasSupabase && clientId),
  });

  const { data: clientDailySnapshot, isLoading: clientDailySnapshotLoading } = useQuery({
    queryKey: ['client-daily-snapshot', clientId],
    queryFn: async () => {
      if (!hasSupabase || !clientId) return null;
      const sb = getSupabase();
      if (!sb) return null;
      const day = todayLocalDateString();
      return fetchClientDailySnapshot(sb, clientId, day);
    },
    enabled: Boolean(hasSupabase && clientId),
    staleTime: 45 * 1000,
  });

  const { data: coachMethodologyPackages = [] } = useQuery({
    queryKey: ['coach-methodology-packages', authUserId],
    queryFn: async () => {
      if (!hasSupabase || !authUserId) return [];
      const sb = getSupabase();
      if (!sb) return [];
      const { data } = await sb
        .from('methodology_packages')
        .select('*')
        .eq('coach_id', authUserId)
        .order('created_at', { ascending: false });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!authUserId && !!hasSupabase,
  });

  return {
    supabaseClient,
    checkInsSupabase,
    clientProgramsSupabase,
    progressMetrics,
    progressMetricsLoading,
    retentionRiskRow,
    retentionRiskLoading,
    lifecycleRow,
    lifecycleLoading,
    coachingInsights,
    adaptiveRecommendations,
    momentumRows,
    momentumLoading,
    osPrepRow,
    osPrepDailies,
    clientDailySnapshot,
    clientDailySnapshotLoading,
    coachMethodologyPackages,
  };
}
