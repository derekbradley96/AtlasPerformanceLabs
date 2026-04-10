import { describe, it, expect } from 'vitest';
import {
  AtlasMigrationPhase,
  atlasMigrationDataAttributes,
  deriveReviewCenterHubState,
  deriveMorePageSurfaceState,
  deriveAuthScreenSurfaceState,
  deriveCheckInReviewWorkspaceState,
  deriveGlobalReviewRouteState,
  deriveReviewCenterGlobalSurfaceState,
  deriveReviewCenterQueueUnifiedState,
  deriveReviewCenterCheckinsClientsState,
  deriveCheckInReviewRouteState,
  deriveClientNutritionRouteState,
  derivePersonalProgressRouteState,
  deriveProgressRouteSignedOutState,
  deriveClientProgressRouteState,
  deriveCoachClientProgressRouteState,
  derivePersonalHomeRouteState,
  derivePersonalTodayRouteState,
  deriveClientTodayRouteState,
  deriveClientHomeRouteState,
  deriveCoachHomeRouteState,
  derivePersonalCoachTierSelectionState,
  deriveLegacyCoachMarketplaceRouteState,
  derivePersonalCoachHubRouteState,
  deriveReadinessCheckinRouteState,
  deriveMessagesListRouteState,
  deriveMessagesThreadRouteState,
  deriveRoleSelectionSurfaceState,
  deriveWorkoutPlayerRouteState,
  deriveMyProgramRouteState,
  deriveInviteCodeRouteState,
  deriveClientCheckInLegacyRouteState,
  deriveCheckInEnginePageRouteState,
  deriveProgramBuilderRouteState,
  deriveProgramDayEditorRouteState,
  deriveWorkoutBuilderLegacyRouteState,
  deriveCompPrepOverviewRouteState,
  deriveNotificationSettingsRouteState,
  deriveLoginShellRouteState,
  deriveLeadCheckoutRouteState,
  deriveJoinLeadPageRouteState,
  deriveHomeRouterRouteState,
  deriveTrainerCheckInsHubRouteState,
  deriveCoachInboxRouteState,
  deriveAccountHubRouteState,
  deriveLeadCheckoutPostRouteState,
  deriveNotificationPrefsPageRouteState,
  deriveClientSessionsRouteState,
  derivePersonalOnboardingTierSurfaceState,
} from './atlasMigrationPhases';

describe('atlasMigrationPhases', () => {
  it('atlasMigrationDataAttributes sets phase and primary', () => {
    const a = atlasMigrationDataAttributes(AtlasMigrationPhase.CORE_LOOP, 'loading');
    expect(a['data-atlas-migration-phase']).toBe('1');
    expect(a['data-atlas-primary-state']).toBe('loading');
  });

  it('deriveReviewCenterHubState returns loading when loading and empty', () => {
    const s = deriveReviewCenterHubState({ loading: true, clientsCount: 0, hasStripeItems: false });
    expect(s.primary).toBe('loading');
    expect(s.phase).toBe(AtlasMigrationPhase.CORE_LOOP);
  });

  it('deriveMorePageSurfaceState handles signed out', () => {
    const s = deriveMorePageSurfaceState({ signedIn: false, activeRoleKey: 'personal', adminPreview: false });
    expect(s.primary).toBe('signed_out');
    expect(s.phase).toBe(AtlasMigrationPhase.SECONDARY);
  });

  it('deriveAuthScreenSurfaceState builds stable keys', () => {
    const s = deriveAuthScreenSurfaceState({ isLogin: false, signupStage: 'pick_role' });
    expect(s.primary).toContain('signup');
    expect(s.phase).toBe(AtlasMigrationPhase.ONBOARDING);
  });

  it('derivePersonalOnboardingTierSurfaceState picks saving vs picker', () => {
    expect(derivePersonalOnboardingTierSurfaceState({ saving: false }).primary).toBe('personal_tier_picker');
    expect(derivePersonalOnboardingTierSurfaceState({ saving: true }).primary).toBe('personal_tier_saving');
  });

  it('deriveCheckInReviewWorkspaceState keys shell + emphasis', () => {
    const desktop = deriveCheckInReviewWorkspaceState({ shell: 'desktop_web', emphasis: 'competition_prep' });
    expect(desktop.phase).toBe(AtlasMigrationPhase.CORE_LOOP);
    expect(desktop.primary).toBe('desktop_comp_prep');
    const app = deriveCheckInReviewWorkspaceState({ shell: 'app', emphasis: undefined });
    expect(app.primary).toBe('app_transform');
  });

  it('deriveGlobalReviewRouteState', () => {
    const r = deriveGlobalReviewRouteState({ view: 'redirecting' });
    expect(r.primary).toBe('global_review_redirecting');
  });

  it('deriveReviewCenterGlobalSurfaceState', () => {
    const loading = deriveReviewCenterGlobalSurfaceState({
      loading: true,
      isEmpty: false,
      segment: 'active',
      filterKey: 'all',
    });
    expect(loading.primary).toBe('review_global_loading');
    const list = deriveReviewCenterGlobalSurfaceState({
      loading: false,
      isEmpty: false,
      segment: 'waiting',
      filterKey: 'reviews',
    });
    expect(list.primary).toBe('review_global_list_waiting_reviews');
  });

  it('deriveReviewCenterQueueUnifiedState', () => {
    const q = deriveReviewCenterQueueUnifiedState({
      loading: false,
      isEmpty: true,
      filterKey: 'checkins',
      sortKey: 'priority',
    });
    expect(q.primary).toBe('review_queue_unified_empty_checkins_priority');
  });

  it('deriveReviewCenterCheckinsClientsState', () => {
    const emptyInsights = deriveReviewCenterCheckinsClientsState({
      loading: false,
      isEmpty: true,
      insightsOnly: true,
    });
    expect(emptyInsights.primary).toBe('review_checkins_clients_empty_insights');
  });

  it('deriveCheckInReviewRouteState', () => {
    expect(deriveCheckInReviewRouteState({ view: 'loading' }).primary).toBe('checkin_review_loading');
    expect(deriveCheckInReviewRouteState({ view: 'not_found' }).primary).toBe('checkin_review_not_found');
  });

  it('deriveClientNutritionRouteState', () => {
    const a = deriveClientNutritionRouteState({ surface: 'active' });
    expect(a.phase).toBe(AtlasMigrationPhase.CORE_LOOP);
    expect(a.primary).toBe('client_nutrition_active');
  });

  it('derivePersonalProgressRouteState loading and dashboard keys', () => {
    expect(derivePersonalProgressRouteState({ loading: true }).primary).toBe('loading');
    expect(derivePersonalProgressRouteState({ showEmptyProgressState: true }).primary).toBe('empty_build');
    expect(derivePersonalProgressRouteState({ showEmptyProgressState: false }).primary).toBe('dashboard');
    expect(derivePersonalProgressRouteState({ showEmptyProgressState: false, emphasis: 'risk' }).primary).toBe('dashboard_risk');
    expect(derivePersonalProgressRouteState({ showEmptyProgressState: false, emphasis: 'momentum' }).primary).toBe('dashboard_momentum');
  });

  it('deriveProgressRouteSignedOutState', () => {
    const s = deriveProgressRouteSignedOutState();
    expect(s.phase).toBe(AtlasMigrationPhase.CORE_LOOP);
    expect(s.primary).toBe('progress_signed_out');
  });

  it('deriveClientProgressRouteState surfaces', () => {
    expect(deriveClientProgressRouteState({ surface: 'loading' }).primary).toBe('progress_client_loading');
    expect(deriveClientProgressRouteState({ surface: 'dashboard' }).primary).toBe('progress_client_dashboard');
  });

  it('deriveCoachClientProgressRouteState surfaces', () => {
    expect(deriveCoachClientProgressRouteState({ surface: 'empty' }).primary).toBe('progress_coach_client_empty');
    expect(deriveCoachClientProgressRouteState({ surface: 'dashboard' }).primary).toBe('progress_coach_client_dashboard');
  });

  it('derivePersonalHomeRouteState', () => {
    expect(derivePersonalHomeRouteState({ surface: 'loading' }).primary).toBe('home_loading');
    expect(derivePersonalHomeRouteState({ surface: 'dashboard', atlasPrimaryKey: 'session_ready' }).primary).toBe(
      'home_session_ready',
    );
  });

  it('derivePersonalTodayRouteState', () => {
    expect(derivePersonalTodayRouteState({ surface: 'loading' }).primary).toBe('today_personal_loading');
    expect(derivePersonalTodayRouteState({ surface: 'dashboard', atlasPrimaryKey: 'no_plan' }).primary).toBe(
      'today_personal_no_plan',
    );
  });

  it('deriveClientTodayRouteState', () => {
    expect(deriveClientTodayRouteState({ surface: 'session_active' }).primary).toBe('today_client_session_active');
    expect(deriveClientTodayRouteState({ surface: 'idle', idleScenario: 'nutrition_only_no_program' }).primary).toBe(
      'today_client_idle_nutrition_only_no_program',
    );
  });

  it('deriveClientHomeRouteState', () => {
    expect(deriveClientHomeRouteState({ surface: 'loading' }).primary).toBe('client_home_loading');
    expect(deriveClientHomeRouteState({ surface: 'dashboard', dashboardKey: 'session_ready' }).primary).toBe(
      'client_home_session_ready',
    );
  });

  it('deriveCoachHomeRouteState', () => {
    expect(deriveCoachHomeRouteState({ surface: 'empty_roster' }).primary).toBe('coach_home_empty_roster');
    expect(deriveCoachHomeRouteState({ surface: 'hub' }).primary).toBe('coach_home_hub');
  });

  it('derivePersonalCoachTierSelectionState uses conversion phase', () => {
    const b = derivePersonalCoachTierSelectionState({ tier: 'basic' });
    expect(b.phase).toBe(AtlasMigrationPhase.CONVERSION);
    expect(b.primary).toBe('tier_selection_basic');
    expect(derivePersonalCoachTierSelectionState({ tier: 'enhanced' }).primary).toBe('tier_selection_enhanced');
  });

  it('deriveLegacyCoachMarketplaceRouteState', () => {
    const m = deriveLegacyCoachMarketplaceRouteState({ surface: 'results' });
    expect(m.phase).toBe(AtlasMigrationPhase.CONVERSION);
    expect(m.primary).toBe('legacy_marketplace_results');
    expect(deriveLegacyCoachMarketplaceRouteState({ surface: 'signed_out' }).primary).toBe('legacy_marketplace_signed_out');
  });

  it('derivePersonalCoachHubRouteState', () => {
    const h = derivePersonalCoachHubRouteState({ hubKey: 'ready_to_contact' });
    expect(h.phase).toBe(AtlasMigrationPhase.CONVERSION);
    expect(h.primary).toBe('coach_hub_ready_to_contact');
  });

  it('deriveReadinessCheckinRouteState', () => {
    expect(deriveReadinessCheckinRouteState({ surface: 'role_denied' }).primary).toBe('readiness_role_denied');
    expect(deriveReadinessCheckinRouteState({ role: 'personal', surface: 'form', step: 'feel' }).primary).toBe(
      'readiness_personal_form_feel',
    );
    expect(deriveReadinessCheckinRouteState({ role: 'client', surface: 'post_submit' }).primary).toBe(
      'readiness_client_post_submit',
    );
  });

  it('deriveMessagesListRouteState', () => {
    expect(deriveMessagesListRouteState({ roleView: 'coach', surface: 'list', unreadFilter: true }).primary).toBe(
      'messages_coach_list_unread',
    );
    expect(deriveMessagesListRouteState({ roleView: 'client', surface: 'empty' }).primary).toBe('messages_client_empty');
    expect(deriveMessagesListRouteState({ roleView: 'coach', surface: 'empty', unreadFilter: true }).primary).toBe(
      'messages_coach_empty_unread',
    );
  });

  it('deriveRoleSelectionSurfaceState', () => {
    const p = deriveRoleSelectionSurfaceState({ saving: false });
    expect(p.phase).toBe(AtlasMigrationPhase.ONBOARDING);
    expect(p.primary).toBe('role_selection_picker');
    expect(deriveRoleSelectionSurfaceState({ saving: true }).primary).toBe('role_selection_saving');
  });

  it('deriveWorkoutPlayerRouteState', () => {
    expect(deriveWorkoutPlayerRouteState({ roleView: 'personal', surface: 'entry' }).primary).toBe(
      'workout_player_personal_entry',
    );
    expect(deriveWorkoutPlayerRouteState({ roleView: 'client', surface: 'playing' }).primary).toBe(
      'workout_player_client_playing',
    );
    expect(deriveWorkoutPlayerRouteState({ roleView: 'client', surface: 'profile_error' }).primary).toBe(
      'workout_player_client_profile_error',
    );
  });

  it('deriveMyProgramRouteState', () => {
    expect(deriveMyProgramRouteState({ roleView: 'client', surface: 'active' }).primary).toBe('my_program_client_active');
    expect(deriveMyProgramRouteState({ roleView: 'personal', surface: 'empty' }).primary).toBe('my_program_personal_empty');
  });

  it('deriveMessagesThreadRouteState', () => {
    expect(deriveMessagesThreadRouteState({ roleView: 'coach', surface: 'loading' }).primary).toBe('messages_thread_coach_loading');
    expect(deriveMessagesThreadRouteState({ roleView: 'client', surface: 'empty' }).primary).toBe('messages_thread_client_empty');
    expect(deriveMessagesThreadRouteState({ roleView: 'coach', surface: 'not_found' }).primary).toBe('messages_thread_coach_not_found');
  });

  it('deriveInviteCodeRouteState', () => {
    expect(deriveInviteCodeRouteState({ submitting: false }).phase).toBe(AtlasMigrationPhase.ONBOARDING);
    expect(deriveInviteCodeRouteState({ submitting: false }).primary).toBe('invite_code_form');
    expect(deriveInviteCodeRouteState({ submitting: true }).primary).toBe('invite_code_submitting');
  });

  it('deriveClientCheckInLegacyRouteState', () => {
    expect(deriveClientCheckInLegacyRouteState({ surface: 'no_template' }).primary).toBe('client_checkin_legacy_no_template');
    expect(deriveClientCheckInLegacyRouteState({ surface: 'template_loading' }).primary).toBe('client_checkin_legacy_template_loading');
    expect(deriveClientCheckInLegacyRouteState({ surface: 'no_trainer' }).primary).toBe('client_checkin_legacy_no_trainer');
  });

  it('deriveCheckInEnginePageRouteState', () => {
    expect(deriveCheckInEnginePageRouteState({ surface: 'loading' }).primary).toBe('client_checkin_engine_loading');
    expect(deriveCheckInEnginePageRouteState({ surface: 'form', focusType: 'transformation' }).primary).toBe(
      'client_checkin_engine_form_transformation',
    );
  });

  it('deriveProgramBuilderRouteState', () => {
    expect(deriveProgramBuilderRouteState({ roleView: 'personal', surface: 'no_supabase' }).primary).toBe(
      'program_builder_personal_no_supabase',
    );
    expect(deriveProgramBuilderRouteState({ roleView: 'coach', surface: 'no_clients' }).primary).toBe(
      'program_builder_coach_no_clients',
    );
  });

  it('deriveProgramDayEditorRouteState', () => {
    expect(deriveProgramDayEditorRouteState({ surface: 'active' }).primary).toBe('program_day_editor_active');
  });

  it('deriveWorkoutBuilderLegacyRouteState', () => {
    expect(deriveWorkoutBuilderLegacyRouteState({ surface: 'form' }).phase).toBe(AtlasMigrationPhase.SECONDARY);
    expect(deriveWorkoutBuilderLegacyRouteState({ surface: 'form' }).primary).toBe('workout_builder_legacy_form');
  });

  it('deriveCompPrepOverviewRouteState', () => {
    expect(deriveCompPrepOverviewRouteState({ surface: 'empty' }).primary).toBe('comp_prep_overview_empty');
  });

  it('deriveNotificationSettingsRouteState', () => {
    expect(deriveNotificationSettingsRouteState({ roleView: 'coach' }).primary).toBe('notification_settings_coach');
    expect(deriveNotificationSettingsRouteState({ roleView: 'client' }).primary).toBe('notification_settings_client');
    expect(deriveNotificationSettingsRouteState({ roleView: 'personal' }).primary).toBe('notification_settings_personal');
    expect(deriveNotificationSettingsRouteState({ roleView: 'trainer' }).primary).toBe('notification_settings_coach');
    expect(deriveNotificationSettingsRouteState({ roleView: 'admin' }).primary).toBe('notification_settings_admin');
  });

  it('deriveLoginShellRouteState', () => {
    expect(deriveLoginShellRouteState({ surface: 'redirect_error' }).primary).toBe('login_shell_redirect_error');
  });

  it('deriveLeadCheckoutRouteState', () => {
    expect(deriveLeadCheckoutRouteState({ surface: 'invalid' }).phase).toBe(AtlasMigrationPhase.CONVERSION);
    expect(deriveLeadCheckoutRouteState({ surface: 'invalid' }).primary).toBe('lead_checkout_invalid');
  });

  it('deriveJoinLeadPageRouteState', () => {
    expect(deriveJoinLeadPageRouteState({ surface: 'thanks' }).primary).toBe('join_lead_thanks');
  });

  it('deriveHomeRouterRouteState', () => {
    expect(deriveHomeRouterRouteState({ surface: 'coach' }).primary).toBe('home_router_coach');
  });

  it('deriveTrainerCheckInsHubRouteState', () => {
    expect(deriveTrainerCheckInsHubRouteState({ surface: 'empty' }).primary).toBe('trainer_checkins_empty');
  });

  it('deriveCoachInboxRouteState', () => {
    expect(deriveCoachInboxRouteState({ surface: 'denied' }).primary).toBe('coach_inbox_denied');
    expect(deriveCoachInboxRouteState({ surface: 'empty_active' }).primary).toBe('coach_inbox_empty_active');
  });

  it('deriveAccountHubRouteState', () => {
    expect(deriveAccountHubRouteState({ roleView: 'coach', surface: 'active' }).primary).toBe('account_hub_coach_active');
  });

  it('deriveLeadCheckoutPostRouteState', () => {
    expect(deriveLeadCheckoutPostRouteState({ surface: 'success' }).primary).toBe('lead_checkout_post_success');
    expect(deriveLeadCheckoutPostRouteState({ surface: 'cancelled' }).primary).toBe('lead_checkout_post_cancelled');
  });

  it('deriveNotificationPrefsPageRouteState', () => {
    expect(deriveNotificationPrefsPageRouteState({ surface: 'loading' }).primary).toBe('notification_prefs_page_loading');
  });

  it('deriveClientSessionsRouteState', () => {
    expect(deriveClientSessionsRouteState({ surface: 'empty' }).primary).toBe('client_sessions_empty');
  });
});
