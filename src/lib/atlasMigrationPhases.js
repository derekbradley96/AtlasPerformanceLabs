/**
 * Atlas screen migration — explicit phase (1–4) + primary surface keys for QA and automation.
 * @see docs/SCREEN_MIGRATION_CHECKLIST.md
 */

/** @typedef {'1'|'2'|'3'|'4'} AtlasMigrationPhaseId */

export const AtlasMigrationPhase = {
  /** Core loop: home, today, nutrition, progress, review, client OS */
  CORE_LOOP: '1',
  /** Conversion: marketplace, cards, profile, tier, hub */
  CONVERSION: '2',
  /** Onboarding: auth, role, personal/coach/client flows */
  ONBOARDING: '3',
  /** Secondary: more, settings, notifications, admin, units */
  SECONDARY: '4',
};

/**
 * Spread onto a root element: `data-atlas-migration-phase` + `data-atlas-primary-state`.
 * @param {AtlasMigrationPhaseId} phase
 * @param {string} primaryState
 * @returns {Record<string, string>}
 */
export function atlasMigrationDataAttributes(phase, primaryState) {
  return {
    'data-atlas-migration-phase': String(phase),
    'data-atlas-primary-state': String(primaryState),
  };
}

// --- Phase 1: core loop ---

export function deriveReviewCenterHubState({ loading, clientsCount, hasStripeItems }) {
  const loadingEmpty = loading && clientsCount === 0;
  if (loadingEmpty) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'loading' };
  if (!loading && clientsCount === 0 && !hasStripeItems) {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'empty_roster' };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'hub' };
}

export function deriveReviewCenterClientQueueState({ segment, isEmpty }) {
  const primary = isEmpty ? `empty_${segment}` : `queue_${segment}`;
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary };
}

export function deriveClientDetailSurfaceState({ hasClient }) {
  const primary = hasClient ? 'os_loaded' : 'not_found';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary };
}

/**
 * Personal Home (`GeneralDashboard`). Loaded state prefixes the Atlas screen-state primary key as `home_<key>`.
 * @param {{ surface: 'signed_out'|'loading'|'error'|'dashboard', atlasPrimaryKey?: string|null }} p
 */
export function derivePersonalHomeRouteState({ surface, atlasPrimaryKey } = {}) {
  const s = String(surface || 'loading');
  if (s === 'dashboard') {
    const k =
      atlasPrimaryKey != null && String(atlasPrimaryKey).trim() !== ''
        ? String(atlasPrimaryKey)
        : 'unknown';
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `home_${k}` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `home_${s}` };
}

/**
 * Personal Today (`PersonalTodayContent`). Loaded state: `today_personal_<atlasScreenStateKey>`.
 * @param {{ surface: 'loading'|'dashboard', atlasPrimaryKey?: string|null }} p
 */
export function derivePersonalTodayRouteState({ surface, atlasPrimaryKey } = {}) {
  const s = String(surface || 'loading');
  if (s === 'dashboard') {
    const k =
      atlasPrimaryKey != null && String(atlasPrimaryKey).trim() !== ''
        ? String(atlasPrimaryKey)
        : 'unknown';
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `today_personal_${k}` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `today_personal_${s}` };
}

/**
 * Client Today (`ClientTodayContent`).
 * @param {{ surface: 'loading'|'idle'|'session_ready'|'session_active', idleScenario?: string|null }} p
 */
export function deriveClientTodayRouteState({ surface, idleScenario } = {}) {
  const s = String(surface || 'loading');
  if (s === 'idle' && idleScenario != null && String(idleScenario).trim() !== '') {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `today_client_idle_${String(idleScenario)}` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `today_client_${s}` };
}

/**
 * Client home (`ClientDashboard`).
 * @param {{ surface: 'loading'|'error'|'no_profile'|'dashboard', dashboardKey?: string }} p
 */
export function deriveClientHomeRouteState({ surface, dashboardKey } = {}) {
  const s = String(surface || 'loading');
  if (s === 'dashboard' && dashboardKey != null && String(dashboardKey).trim() !== '') {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_home_${String(dashboardKey)}` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_home_${s}` };
}

/**
 * Coach home (`CoachHomePage`).
 * @param {{ surface: 'loading'|'empty_roster'|'hub' }} p
 */
export function deriveCoachHomeRouteState({ surface } = {}) {
  const s = String(surface || 'loading');
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `coach_home_${s}` };
}

/**
 * Readiness daily check-in (`ReadinessCheckinPage`).
 * @param {{ surface?: 'role_denied'|'post_submit'|'form', role?: 'personal'|'client', step?: string }} p
 */
export function deriveReadinessCheckinRouteState({ surface, role, step } = {}) {
  if (surface === 'role_denied') {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'readiness_role_denied' };
  }
  const r = role === 'client' ? 'client' : 'personal';
  const s = String(surface || 'form');
  if (s === 'form' && step != null && String(step).trim() !== '') {
    const safe = String(step).toLowerCase().replace(/[^a-z0-9_]/g, '') || 'unknown';
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `readiness_${r}_form_${safe}` };
  }
  if (s === 'post_submit') {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `readiness_${r}_post_submit` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `readiness_${r}_${s}` };
}

/**
 * Messages thread list (`Messages.jsx`).
 * @param {{ roleView: 'client'|'coach', surface: 'loading'|'error'|'empty'|'list', unreadFilter?: boolean }} p
 */
export function deriveMessagesListRouteState({ roleView, surface, unreadFilter = false } = {}) {
  const r = roleView === 'client' ? 'client' : 'coach';
  const s = String(surface || 'loading');
  if (s === 'list' && unreadFilter) {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `messages_${r}_list_unread` };
  }
  if (s === 'empty' && unreadFilter) {
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `messages_${r}_empty_unread` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `messages_${r}_${s}` };
}

/**
 * Messages thread detail (`ChatThread.jsx`, `/messages/:clientId`).
 * @param {{ roleView: 'client'|'coach', surface: string }} p — e.g. loading, deleted, not_found, no_client, empty, active
 */
export function deriveMessagesThreadRouteState({ roleView, surface } = {}) {
  const r = roleView === 'client' ? 'client' : 'coach';
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `messages_thread_${r}_${s}` };
}

/**
 * Guided workout player (`WorkoutPlayerPage`).
 * @param {{ roleView: 'client'|'personal', surface: string }} p — surface examples: loading, profile_error (client), entry, complete, no_session, wrapping_up, set_loading, playing
 */
export function deriveWorkoutPlayerRouteState({ roleView, surface } = {}) {
  const r = roleView === 'client' ? 'client' : 'personal';
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `workout_player_${r}_${s}` };
}

/**
 * My Program hub — client (`ClientMyProgram`) or personal (`PersonalMyProgram`).
 * @param {{ roleView: 'client'|'personal', surface: string }} p
 */
export function deriveMyProgramRouteState({ roleView, surface } = {}) {
  const r = roleView === 'client' ? 'client' : 'personal';
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `my_program_${r}_${s}` };
}

/**
 * Client invite code screen (`EnterInviteCode.jsx`).
 */
export function deriveInviteCodeRouteState({ submitting = false } = {}) {
  const primary = submitting ? 'invite_code_submitting' : 'invite_code_form';
  return { phase: AtlasMigrationPhase.ONBOARDING, primary };
}

/**
 * Legacy template-based client check-in (`ClientCheckIn.jsx`).
 * @param {{ surface?: string }} p — loading, no_trainer, template_loading, no_template, pending_loading, no_pending, form
 */
export function deriveClientCheckInLegacyRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_checkin_legacy_${s}` };
}

/**
 * Check-In Engine weekly form (`CheckInPage.jsx`).
 * @param {{ surface?: string, focusType?: string }} p
 */
export function deriveCheckInEnginePageRouteState({ surface, focusType } = {}) {
  const base = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'loading';
  if (base === 'form' && focusType) {
    const ft = String(focusType).toLowerCase().replace(/[^a-z0-9_]/g, '') || 'unknown';
    return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_checkin_engine_form_${ft}` };
  }
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_checkin_engine_${base}` };
}

/**
 * Supabase program builder (`ProgramBuilderPage.jsx`).
 * @param {{ roleView: 'coach'|'personal', surface?: string }} p
 */
export function deriveProgramBuilderRouteState({ roleView, surface } = {}) {
  const r = roleView === 'personal' ? 'personal' : 'coach';
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `program_builder_${r}_${s}` };
}

/**
 * Legacy Base44 program day editor (`ProgramDayEditor.jsx`).
 */
export function deriveProgramDayEditorRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `program_day_editor_${s}` };
}

/**
 * Legacy workout composer (removed unrouted page; kept for migration state naming).
 */
export function deriveWorkoutBuilderLegacyRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `workout_builder_legacy_${s}` };
}

/**
 * Coach comp prep roster overview (`compPrep/CompPrepOverview.jsx`).
 */
export function deriveCompPrepOverviewRouteState({ surface } = {}) {
  const raw = String(surface || 'list').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'list';
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `comp_prep_overview_${s}` };
}

/**
 * Local notification toggles (`NotificationSettings.jsx`).
 * @param {{ roleView?: 'coach'|'client'|'personal'|'admin'|string }} p — legacy `trainer` maps to coach
 */
export function deriveNotificationSettingsRouteState({ roleView } = {}) {
  const raw = String(roleView || '').toLowerCase().trim();
  let r = 'personal';
  if (raw === 'client') r = 'client';
  else if (raw === 'coach' || raw === 'trainer') r = 'coach';
  else if (raw === 'admin') r = 'admin';
  else if (raw === 'personal' || raw === 'solo' || raw === 'athlete') r = 'personal';
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `notification_settings_${r}` };
}

/**
 * App shell login stub (`Login.jsx`).
 */
export function deriveLoginShellRouteState({ surface } = {}) {
  const raw = String(surface || 'default').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'default';
  return { phase: AtlasMigrationPhase.ONBOARDING, primary: `login_shell_${s}` };
}

/**
 * Public Stripe lead checkout (`LeadCheckout.jsx`).
 */
export function deriveLeadCheckoutRouteState({ surface } = {}) {
  const raw = String(surface || 'form').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'form';
  return { phase: AtlasMigrationPhase.CONVERSION, primary: `lead_checkout_${s}` };
}

/**
 * Coach join / lead capture by slug (`JoinPage.jsx`).
 */
export function deriveJoinLeadPageRouteState({ surface } = {}) {
  const raw = String(surface || 'form').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'form';
  return { phase: AtlasMigrationPhase.CONVERSION, primary: `join_lead_${s}` };
}

/**
 * `/` home router (`Home.jsx`) — picks dashboard by role.
 */
export function deriveHomeRouterRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `home_router_${s}` };
}

/**
 * Coach trainer check-ins queue (`CheckIns.jsx`).
 */
export function deriveTrainerCheckInsHubRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `trainer_checkins_${s}` };
}

/**
 * Coach inbox (`InboxPage.jsx`).
 */
export function deriveCoachInboxRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `coach_inbox_${s}` };
}

/**
 * Account hub (`Account.jsx`).
 */
export function deriveAccountHubRouteState({ roleView, surface } = {}) {
  const r = String(roleView || 'personal').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'personal';
  const raw = String(surface || 'active').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'active';
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `account_hub_${r}_${s}` };
}

/**
 * Lead checkout result pages (`LeadCheckoutSuccess.jsx`, `LeadCheckoutCancel.jsx`).
 */
export function deriveLeadCheckoutPostRouteState({ surface } = {}) {
  const raw = String(surface || 'success').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'success';
  return { phase: AtlasMigrationPhase.CONVERSION, primary: `lead_checkout_post_${s}` };
}

/**
 * Supabase-backed notification preferences (`NotificationSettingsPage.jsx`).
 */
export function deriveNotificationPrefsPageRouteState({ surface } = {}) {
  const raw = String(surface || 'active').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'active';
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `notification_prefs_page_${s}` };
}

/**
 * Client scheduled sessions (`ClientSessionsPage.jsx`).
 */
export function deriveClientSessionsRouteState({ surface } = {}) {
  const raw = String(surface || 'loading').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const s = raw || 'loading';
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_sessions_${s}` };
}

/**
 * @param {{ loading?: boolean, hasTargets?: boolean }} p
 */
export function derivePersonalNutritionRouteState({ loading, hasTargets }) {
  if (loading) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'loading' };
  if (!hasTargets) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'needs_targets' };
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'active' };
}

/**
 * Client nutrition route (same `/nutrition` page, coach-owned targets).
 * @param {{ surface: 'loading'|'not_linked'|'needs_targets'|'active' }} p
 */
export function deriveClientNutritionRouteState({ surface }) {
  const s = String(surface || 'loading');
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `client_nutrition_${s}` };
}

/**
 * Personal branch of `/progress`.
 * @param {{ showEmptyProgressState?: boolean, loading?: boolean, emphasis?: 'risk'|'momentum'|'' }} p — when loaded, optional dashboard emphasis for QA
 */
export function derivePersonalProgressRouteState({ showEmptyProgressState, loading, emphasis } = {}) {
  if (loading) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'loading' };
  if (showEmptyProgressState) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'empty_build' };
  const em = String(emphasis || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (em === 'risk') return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'dashboard_risk' };
  if (em === 'momentum') return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'dashboard_momentum' };
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'dashboard' };
}

/** `/progress` when signed out or no Supabase session. */
export function deriveProgressRouteSignedOutState() {
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'progress_signed_out' };
}

/**
 * Client self-view on `/progress` (linked client, metrics from coach check-ins).
 * @param {{ surface: 'loading'|'not_linked'|'empty_checkins'|'dashboard' }} p
 */
export function deriveClientProgressRouteState({ surface }) {
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `progress_client_${String(surface)}` };
}

/**
 * Coach viewing `/progress/:id` for a client.
 * @param {{ surface: 'loading'|'empty'|'dashboard' }} p
 */
export function deriveCoachClientProgressRouteState({ surface }) {
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `progress_coach_client_${String(surface)}` };
}

/**
 * Coach check-in decision workspace (Review Center drill-in).
 * @param {{ shell?: string, emphasis?: string }} p
 */
export function deriveCheckInReviewWorkspaceState({ shell, emphasis }) {
  const em = emphasis === 'competition_prep' ? 'comp_prep' : 'transform';
  const primary = shell === 'desktop_web' ? `desktop_${em}` : `app_${em}`;
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary };
}

/**
 * Check-in review **route** shells before `CheckInReviewDecisionWorkspace` mounts.
 * @param {{ view: 'loading'|'not_found' }} p
 */
export function deriveCheckInReviewRouteState({ view }) {
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `checkin_review_${String(view)}` };
}

/**
 * `/review-global` — “review next” single-item flow; brief states before navigate.
 * @param {{ view: 'done'|'idle'|'redirecting' }} p
 */
export function deriveGlobalReviewRouteState({ view }) {
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `global_review_${view}` };
}

/**
 * Legacy global hub (ReviewCenterGlobal) — still used by migration helpers if embedded; route is now the unified queue.
 * @param {{ loading: boolean, isEmpty: boolean, segment: string, filterKey: string }} p
 */
export function deriveReviewCenterGlobalSurfaceState({ loading, isEmpty, segment, filterKey }) {
  const seg = String(segment || 'active');
  const fil = String(filterKey || 'all');
  if (loading) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'review_global_loading' };
  if (isEmpty) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `review_global_empty_${seg}_${fil}` };
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `review_global_list_${seg}_${fil}` };
}

/**
 * `/review-center` (canonical) — global triage queue (v_coach_review_queue + merged sources). Legacy `/review-center/queue` redirects here.
 */
export function deriveReviewCenterQueueUnifiedState({ loading, isEmpty, filterKey, sortKey }) {
  const fil = filterKey == null || filterKey === '' ? 'all' : String(filterKey);
  const sort = String(sortKey || 'priority');
  if (loading) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'review_queue_unified_loading' };
  if (isEmpty) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `review_queue_unified_empty_${fil}_${sort}` };
  return { phase: AtlasMigrationPhase.CORE_LOOP, primary: `review_queue_unified_list_${fil}_${sort}` };
}

/**
 * `/review-center/checkins` — per-client check-in status list (legacy ReviewCenterPage).
 */
export function deriveReviewCenterCheckinsClientsState({ loading, isEmpty, insightsOnly }) {
  if (loading) return { phase: AtlasMigrationPhase.CORE_LOOP, primary: 'review_checkins_clients_loading' };
  if (isEmpty) {
    return {
      phase: AtlasMigrationPhase.CORE_LOOP,
      primary: insightsOnly ? 'review_checkins_clients_empty_insights' : 'review_checkins_clients_empty',
    };
  }
  return {
    phase: AtlasMigrationPhase.CORE_LOOP,
    primary: insightsOnly ? 'review_checkins_clients_list_insights' : 'review_checkins_clients_list',
  };
}

// --- Phase 2: conversion ---

export function deriveMarketplaceDiscoverySurfaceState({ discoveryKey }) {
  return { phase: AtlasMigrationPhase.CONVERSION, primary: String(discoveryKey || 'results') };
}

export function derivePublicCoachProfileSurfaceState({ ctaKey }) {
  return { phase: AtlasMigrationPhase.CONVERSION, primary: String(ctaKey || 'profile') };
}

/**
 * Personal tier step before `/discover` (`PersonalCoachTierSelectionPage`).
 * @param {{ tier?: string }} p — normalized `basic` | `enhanced`
 */
export function derivePersonalCoachTierSelectionState({ tier } = {}) {
  const t = String(tier || 'basic').toLowerCase() === 'enhanced' ? 'enhanced' : 'basic';
  return { phase: AtlasMigrationPhase.CONVERSION, primary: `tier_selection_${t}` };
}

/**
 * Legacy `/coach-marketplace` list (marketplace_coach_profiles).
 * @param {{ surface: 'signed_out'|'error'|'loading'|'market_empty'|'results' }} p
 */
export function deriveLegacyCoachMarketplaceRouteState({ surface } = {}) {
  const s = String(surface || 'loading');
  return { phase: AtlasMigrationPhase.CONVERSION, primary: `legacy_marketplace_${s}` };
}

/**
 * Personal "Work with a coach" hub (`PersonalCoachTransitionPage`).
 * @param {{ hubKey?: string }} p — `explore` | `consider` | `ready_to_contact` (from `derivePersonalCoachHubState`)
 */
export function derivePersonalCoachHubRouteState({ hubKey } = {}) {
  const raw = String(hubKey || 'explore').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const k = raw || 'explore';
  return { phase: AtlasMigrationPhase.CONVERSION, primary: `coach_hub_${k}` };
}

// --- Phase 3: onboarding ---

export function deriveAuthScreenSurfaceState({ isLogin, signupStage }) {
  const mode = isLogin ? 'login' : 'signup';
  const stage = signupStage != null ? String(signupStage) : 'entry';
  return { phase: AtlasMigrationPhase.ONBOARDING, primary: `${mode}_${stage}` };
}

export function derivePersonalOnboardingSurfaceState({ saving }) {
  const primary = saving ? 'saving' : 'form';
  return { phase: AtlasMigrationPhase.ONBOARDING, primary };
}

/** Personal tier picker (`PersonalOnboardingTierPage`) before question flow. */
export function derivePersonalOnboardingTierSurfaceState({ saving } = {}) {
  const primary = saving ? 'personal_tier_saving' : 'personal_tier_picker';
  return { phase: AtlasMigrationPhase.ONBOARDING, primary };
}

export function deriveClientOnboardingSurfaceState({ stepIndex, stepName }) {
  const primary = stepName != null ? `step_${stepName}` : `step_${stepIndex ?? 0}`;
  return { phase: AtlasMigrationPhase.ONBOARDING, primary };
}

export function deriveCoachOnboardingSurfaceState({ step }) {
  return { phase: AtlasMigrationPhase.ONBOARDING, primary: `coach_step_${step ?? 1}` };
}

/** Post-auth role picker (`RoleSelection.jsx`). */
export function deriveRoleSelectionSurfaceState({ saving } = {}) {
  const primary = saving ? 'saving' : 'picker';
  return { phase: AtlasMigrationPhase.ONBOARDING, primary: `role_selection_${primary}` };
}

// --- Phase 4: secondary ---

export function deriveMorePageSurfaceState({ signedIn, activeRoleKey, adminPreview }) {
  if (!signedIn) return { phase: AtlasMigrationPhase.SECONDARY, primary: 'signed_out' };
  if (adminPreview) return { phase: AtlasMigrationPhase.SECONDARY, primary: `preview_${activeRoleKey || 'unknown'}` };
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `more_${activeRoleKey || 'unknown'}` };
}

export function deriveNotificationsSurfaceState({ loading, isEmpty, filter }) {
  if (loading) return { phase: AtlasMigrationPhase.SECONDARY, primary: 'loading' };
  if (isEmpty) return { phase: AtlasMigrationPhase.SECONDARY, primary: `empty_${filter || 'all'}` };
  return { phase: AtlasMigrationPhase.SECONDARY, primary: 'list' };
}

export function deriveProfileAccountSurfaceState({ roleType }) {
  return { phase: AtlasMigrationPhase.SECONDARY, primary: `account_${roleType || 'personal'}` };
}

export function deriveAdminShellSurfaceState({ allowed }) {
  const primary = allowed ? 'shell' : 'denied';
  return { phase: AtlasMigrationPhase.SECONDARY, primary };
}
