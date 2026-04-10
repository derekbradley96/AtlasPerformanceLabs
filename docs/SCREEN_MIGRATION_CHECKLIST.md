# Atlas Screen Migration Checklist

This checklist is the structural migration standard for Atlas screens.  
Goal: every major screen uses shared tokens/components, explicit screen state, and role/tier/goal/shell wrappers.

## Migration phase contract (QA / automation)

Canonical module: [`src/lib/atlasMigrationPhases.js`](../src/lib/atlasMigrationPhases.js). It defines **`AtlasMigrationPhase`** values `1`–`4` (core loop, conversion, onboarding, secondary) and helpers such as **`atlasMigrationDataAttributes(phase, primary)`**, which set **`data-atlas-migration-phase`** and **`data-atlas-primary-state`** on a screen’s root node for automated checks.

Primary surfaces called out in this document are wired to those attributes via the corresponding **`derive*SurfaceState`** / **`derive*RouteState`** helpers (Review Center, Client Detail, Personal Nutrition/Progress, readiness check-in, messages list + thread, marketplace discovery, public coach profile, auth, personal/coach/client onboarding, invite code, check-in engine + legacy template flow, program builder, lead checkout / join slug, More, Notifications, Profile Account, Admin shell, check-in decision workspace, etc.). When adding a new major route, extend the same module and spread the attributes on the root wrapper.

## Phase Plan

### Phase 1 - Core Loop
- Personal Home (`src/components/dashboards/GeneralDashboard.jsx`)
- Client Home (`src/components/dashboards/ClientDashboard.jsx`)
- Coach Home (`src/pages/TrainerDashboard.jsx`)
- Personal Today (`src/pages/TodayPage.jsx`)
- Personal Nutrition (`src/pages/Nutrition.jsx`)
- Personal Progress (`src/pages/ProgressPage.jsx`)
- Coach Review Center (`src/pages/ReviewCenter.jsx`, `src/pages/GlobalReview.jsx`)
- Check-in Review (`src/pages/CheckInReviewPage.jsx`, `src/components/checkin-review/CheckInReviewDecisionWorkspace.jsx`)
- Client Detail (`src/pages/ClientDetail.jsx`, `src/components/clients/ClientOperatingSystemLayout.jsx`)
- Readiness check-in (`src/pages/ReadinessCheckinPage.jsx`)
- Messages list (`src/pages/Messages.jsx`) and thread (`src/pages/ChatThread.jsx`)
- Workout player (`src/pages/WorkoutPlayerPage.jsx`)
- My Program (`src/pages/MyProgram.jsx`, `src/pages/PersonalMyProgram.jsx`)

### Phase 2 - Conversion
- Marketplace
- Coach cards
- Coach profile
- Tier selection
- Work with a coach hub

### Phase 3 - Onboarding
- Personal onboarding (`PersonalOnboardingTierPage.jsx`: `derivePersonalOnboardingTierSurfaceState` + `atlasMigrationDataAttributes` on loaded root)
- Coach onboarding
- Client onboarding
- Auth flow
- Role selection (`src/pages/RoleSelection.jsx` — `deriveRoleSelectionSurfaceState`)

### Phase 4 - Secondary
- More page
- Settings
- Units system
- Admin views
- Notifications

## Screen Gate (must pass all 10)

1. State-driven rendering
2. Shared components only
3. Token system applied
4. Vertical rhythm consistent
5. Role/tier/goal integrity
6. Single primary action
7. Priority hierarchy enforced
8. Correct shell behavior
9. Workflow continuity (no unnecessary navigation)
10. No legacy leftovers

## Phase 1 Application Log

### Personal Home
- Status: **In progress**
- Current issues
  - Primary state was not explicitly derived from Atlas screen-state engine.
  - Large amount of conditional rendering mixed with local booleans.
- Fixes implemented
  - Added Atlas state derivation (`buildAtlasUiContext`, `derivePersonalTrainingSurfaceStates`, integrity filtering, and primary-state pick).
  - `GeneralDashboard.jsx` spreads **`atlasMigrationDataAttributes`** from **`derivePersonalHomeRouteState`**: `home_signed_out` / `home_loading` / `home_error` / `home_<atlasScreenStateKey>` on the loaded root (phase **1**).
- Remaining inconsistencies
  - Some local condition branches still duplicate state intent; can be further collapsed into state maps.

### Personal Today
- Status: **Partially migrated**
- Current issues
  - Some role/tier pathing still uses inline branching for card composition.
- Fixes implemented
  - Already uses Atlas state system and shared `daily-command-center`/`atlas-ui` components.
  - Preserves single-primary-action behavior for session start path.
  - Personal branch: **`derivePersonalTodayRouteState`** → `today_personal_loading` / `today_personal_<atlasScreenStateKey>` on `PersonalTodayContent` roots. Client branch: **`deriveClientTodayRouteState`** → `today_client_loading` / `today_client_idle_*` / `today_client_session_ready` / `today_client_session_active` on `ClientTodayContent`.
- Remaining inconsistencies
  - Additional branch flattening can move more UI decisions into explicit state maps.

### Personal Nutrition
- Status: **Partially migrated**
- Current issues
  - `Nutrition` route still contains local composition logic that can be normalized to explicit page-state keys.
- Fixes implemented
  - Shared targets workflow is centralized in `PersonalNutritionTargetsPanel` and shared nutrition profile services.
  - Uses tokenized components and consistent CTA structure.
- Remaining inconsistencies
  - Personal + Client branches on `Nutrition` share `nutritionRouteMigration` (`derivePersonalNutritionRouteState` / `deriveClientNutritionRouteState`); further branch flattening optional.

### Personal Progress
- Status: **Partially migrated**
- Current issues
  - Personal and non-personal branches are explicit but still heavy in inline conditional rendering.
- Fixes implemented
  - Uses shared shell wrappers (`PersonalCanvas`, `PersonalColumn`) and token system.
  - Uses interpreted progress insights and next-action surfaces.
  - `ProgressPage.jsx` spreads migration attrs from `derivePersonalProgressRouteState` (Personal: loading / `empty_build` / `dashboard`), `deriveProgressRouteSignedOutState`, `deriveClientProgressRouteState` (`progress_client_*`), and `deriveCoachClientProgressRouteState` (`progress_coach_client_*`) on the appropriate route roots.
- Remaining inconsistencies
  - Optional: richer Personal keys for momentum/risk modes beyond empty vs dashboard.

### Coach Review Center
- Status: **In progress**
- Current issues
  - Review center family spans multiple pages with mixed legacy structure.
- Fixes implemented
  - Core review workspaces already moved toward shared state/context models.
  - Main hub (`/review-center` → `ReviewCenterGlobal`) and global review route (`/review-global` → `GlobalReview`) expose migration attributes via `deriveReviewCenterGlobalSurfaceState` and `deriveGlobalReviewRouteState` in [`src/lib/atlasMigrationPhases.js`](../src/lib/atlasMigrationPhases.js).
  - Unified queue (`/review-center/queue` → `ReviewCenterQueuePage`): `deriveReviewCenterQueueUnifiedState`.
  - Check-ins list (`/review-center/checkins` → `ReviewCenterPage`): `deriveReviewCenterCheckinsClientsState`.
  - **Per-client** `ReviewCenter.jsx` (`/clients/:id/review-center`): `PageShell` + `PageHeader` from `@/components/atlas-ui`; **posing** filter chip hidden when `!hasCompetitionPrep` (transformation-only coaches); URL `filter=posing` cleared in that case.
  - **Unified queue** `ReviewCenterQueuePage.jsx` (`/review-center`): same `PageShell` + `PageHeader`; prep filter/tab discipline via **`hasCompetitionPrep`** from `useAuth` (not raw `coach_focus` string); **Peak week** shortcut only when `hasCompetitionPrep`; merged queue refetch (`fetchMergedReviewQueue`) after resolve/apply so transformation coaches do not briefly see prep rows; `?filter=posing` cleared when `!hasCompetitionPrep`.
- Remaining inconsistencies
  - Optional: collapse `TopBar` + header into one hierarchy on web for less duplicate chrome.

### Check-in Review
- Status: **Migrated structure with follow-ups**
- Current issues
  - Workspace referenced prep mini-series values that must always be explicitly passed.
- Fixes implemented
  - Added explicit `prepWaterSeries` and `prepSodiumSeries` props defaults in `CheckInReviewDecisionWorkspace`.
  - Keeps desktop/app shell divergence in one shared workspace component.
  - Route shells on `CheckInReviewPage` (loading / not found) use `deriveCheckInReviewRouteState`; loaded workspace roots use `deriveCheckInReviewWorkspaceState` in `CheckInReviewDecisionWorkspace`.
- Remaining inconsistencies
  - Extract some remaining inline style blocks into shared Atlas UI wrappers where practical.

### Client Home
- Status: **Partially migrated**
- Fixes implemented
  - `ClientDashboard.jsx` spreads **`deriveClientHomeRouteState`**: `client_home_loading` / `error` / `no_profile` / `client_home_<dashboardKey>` (`work_complete`, `no_plan`, `no_session_today`, `session_ready`) on route roots (phase **1**).

### Coach Home
- Status: **Partially migrated**
- Fixes implemented
  - `TrainerDashboard.jsx` spreads **`deriveCoachHomeRouteState`**: `coach_home_loading` / `coach_home_empty_roster` / `coach_home_hub` (phase **1**).

### My Program
- Status: **Partially migrated**
- Fixes implemented
  - **`deriveMyProgramRouteState`** on client: `my_program_client_<error|loading|no_trainer|no_assignment|active>`; on personal: `my_program_personal_<loading|empty|cloud|local>` (phase **1**).

### Workout player
- Status: **Partially migrated**
- Fixes implemented
  - `WorkoutPlayerPage.jsx` roots use **`deriveWorkoutPlayerRouteState`**: `workout_player_<client|personal>_<loading|profile_error|entry|complete|no_session|wrapping_up|set_loading|playing>` (phase **1**).

### Readiness check-in
- Status: **Partially migrated**
- Fixes implemented
  - `ReadinessCheckinPage.jsx` spreads **`deriveReadinessCheckinRouteState`** on each route root: `readiness_role_denied`, `readiness_<personal|client>_post_submit`, `readiness_<role>_form_<weight|feel|notes>` (phase **1**).

### Messages (list)
- Status: **Partially migrated**
- Fixes implemented
  - `Messages.jsx` list shell spreads **`deriveMessagesListRouteState`**: `messages_<client|coach>_<loading|error|empty|list>`, **`messages_<role>_list_unread`** when viewing unread-only with threads, and **`messages_<role>_empty_unread`** when unread filter is on but no threads match (phase **1**).

### Messages (thread)
- Status: **Partially migrated**
- Fixes implemented
  - `ChatThread.jsx` (`/messages/:clientId`) spreads **`deriveMessagesThreadRouteState`**: `messages_thread_<client|coach>_<loading|deleted|not_found|no_client|empty|active>` (phase **1**), aligned with list role mapping (`normalizeRole` → client vs coach).

### Role selection (post-auth)
- Status: **Partially migrated**
- Fixes implemented
  - `RoleSelection.jsx` root spreads **`deriveRoleSelectionSurfaceState`**: `role_selection_picker` | `role_selection_saving` (phase **3**).

### Client Detail
- Status: **In progress**
- Current issues
  - Legacy references can break continuity during OS-shell rendering.
- Fixes implemented
  - Confirmed shared `ClientOperatingSystemLayout` wrapper is active for desktop/app shell behavior.
  - Fixed client dashboard prop contract for continuity (`linkedFromPersonalAt` support).
- Remaining inconsistencies
  - Continue reducing legacy sections in `ClientDetail` page to unified state-driven sections.

### Invite code, check-in flows, program builders, conversion lead surfaces (batch)
- Status: **Partially migrated**
- Fixes implemented
  - **`deriveInviteCodeRouteState`** → `EnterInviteCode.jsx` (phase **3**): `invite_code_form` | `invite_code_submitting`.
  - **`deriveClientCheckInLegacyRouteState`** → `ClientCheckIn.jsx` (phase **1**): `client_checkin_legacy_*` including `no_trainer`, `template_loading`, `pending_loading` (distinct from `no_template` / `no_pending` / `form`).
  - **`deriveCheckInEnginePageRouteState`** → `CheckInPage.jsx` (phase **1**): `client_checkin_engine_*` and `client_checkin_engine_form_<focus>`.
  - **`deriveProgramBuilderRouteState`** → `ProgramBuilderPage.jsx`: `program_builder_<coach|personal>_<surface>`.
  - **`deriveProgramDayEditorRouteState`** → `ProgramDayEditor.jsx`; **`deriveWorkoutBuilderLegacyRouteState`** → `WorkoutBuilder.jsx` (phase **4** for legacy builder).
  - **`deriveCompPrepOverviewRouteState`** → `compPrep/CompPrepOverview.jsx` (phase **4**); **`deriveNotificationSettingsRouteState`** → `NotificationSettings.jsx` (phase **4**, primaries `notification_settings_<coach|client|personal|admin>` via `normalizeRole`).
  - **`deriveLoginShellRouteState`** → `Login.jsx` stub (phase **3**).
  - **`deriveLeadCheckoutRouteState`** → `LeadCheckout.jsx`; **`deriveJoinLeadPageRouteState`** → `JoinPage.jsx` (phase **2**).
  - **Pass 1–11 follow-up:** `Home.jsx` (`deriveHomeRouterRouteState`), `CheckIns.jsx` (`deriveTrainerCheckInsHubRouteState`), `Inbox.jsx` (`deriveCoachInboxRouteState`, coach role via `normalizeRole`), `Account.jsx` (`deriveAccountHubRouteState`), `ClientSessionsPage.jsx` (`deriveClientSessionsRouteState`), `NotificationSettingsPage.jsx` (`deriveNotificationPrefsPageRouteState`), `LeadCheckoutSuccess.jsx` / `LeadCheckoutCancel.jsx` (`deriveLeadCheckoutPostRouteState`). Personal `/progress`: `derivePersonalProgressRouteState` supports `dashboard_risk` / `dashboard_momentum` when emphasis is set in `ProgressPage.jsx`.

## Automation / E2E

- Stable selectors: query the document root (or screen wrapper) with **`[data-atlas-migration-phase]`** and **`[data-atlas-primary-state]`** after navigation (e.g. wait for `[data-atlas-primary-state="home_router_coach"]` on `/`).
- Auth: **`src/screens/AuthScreen.jsx`** uses **`deriveAuthScreenSurfaceState`**; app stub **`Login.jsx`** uses **`deriveLoginShellRouteState`** — both are valid; do not conflate them in tests.

## Structural backlog (Review Center, Client Detail, nutrition depth)

- **Review Center:** migration attrs exist on main routes; remaining work is **one shared top-level state + shell** across hub / queue / global / check-ins (reduce page-owned branching).
- **Client Detail:** OS root is tagged; continue **replacing legacy sections** with `ClientOperatingSystemLayout`-driven state maps.
- **Personal Nutrition:** list route is partially wired; optional richer primaries (e.g. coach-bridge / adherence bands) can extend `derivePersonalNutritionRouteState` when product defines keys.

## Next Screens to Migrate

1. Phase 1 completions:
   - Coach Review Center route family unification
   - Personal Nutrition / Progress: richer explicit keys (list routes already partially wired)
2. Phase 2 conversion:
   - Marketplace shells + coach cards/profile states
3. Phase 3 onboarding:
   - Shared state wrappers for all onboarding/auth/role flows
4. Phase 4 secondary:
   - Settings/units/notifications/admin state normalization

## Phase 2 Application Log

### Marketplace (Coach Discovery)
- Status: **In progress**
- Current issues
  - Page rendering was branch-heavy around empty/loading/results conditions.
  - Conversion state was implicit, not represented as an explicit screen state.
- Fixes implemented
  - Added shared discovery state derivation in `src/lib/marketplaceScreenState.js`.
  - Applied explicit screen-state rendering in `src/pages/CoachDiscoveryPage.jsx`.
  - Added `data-atlas-primary-state` marker on the discovery root for QA and state assertions.
  - Personal entry is coordinated with **`/personal/coach-tier-selection`** → **`/discover`** (see Tier Selection log).
- Remaining inconsistencies
  - Optional: centralize profile-open / enquiry analytics in one conversion helper (see Coach Profile log).

### Coach Cards
- Status: **Started**
- Current issues
  - Card supports shell variants and tokens, but conversion funnel context is still page-owned.
- Fixes implemented
  - Added explicit coach-card action-state model in `src/lib/marketplaceCoachCardModel.js`:
    - `view_profile_primary`
    - `message_primary`
    - `apply_primary`
  - Wired action-state into `src/components/marketplace/CoachCard.jsx` and discovery mapping.
  - Card now enforces one primary conversion action while keeping secondary actions contextual.
- Remaining inconsistencies
  - Action-state should be extended to all coach-card surfaces (including any non-discovery legacy cards).

### Coach Profile (Public Coach Profile)
- Status: **Started**
- Current issues
  - CTA stack and sticky footer can compete as dual-primary actions depending on shell.
- Fixes implemented
  - Added explicit CTA state derivation and shell-based primary CTA selection in `src/pages/PublicCoachProfilePage.jsx`.
  - Enforced single-primary conversion action by shell:
    - website shell: inline primary "Message"
    - app shell: sticky primary "Message"
  - Added `data-atlas-primary-state` state marker for profile CTA mode.
- Remaining inconsistencies
  - Profile-to-inquiry tracking should be centralized in one conversion workflow helper for all entry routes.

### Tier Selection
- Status: **In progress (coordinator + routing)**
- Current issues
  - Tier selection surfaces are distributed; no shared conversion-state module yet.
- Fixes implemented
  - Added shared tier normalization/resolution helpers in `src/lib/marketplaceScreenState.js`.
  - Added shared discover URL builder with explicit tier handoff (`buildDiscoverUrl`).
  - Added **`buildPersonalCoachTierSelectionUrl`** — canonical entry for Personal before `/discover` (optional `source` + `tier` query for pre-selection).
  - **`PersonalCoachTierSelectionPage`** reads optional `tier` query to pre-select the tier step.
  - Wired tier handoff through Personal conversion entry points:
    - `src/pages/TodayPage.jsx`
    - `src/pages/ProgressPage.jsx`
    - `src/pages/Nutrition.jsx`
    - `src/pages/personal/PersonalCoachTransitionPage.jsx`
    - `src/pages/EnterInviteCode.jsx`
  - **Personal “Find a coach” deep links** now route through `/personal/coach-tier-selection` first (not straight to `/discover`): e.g. `GeneralDashboard` coach bridge, `FindCoachCTA`, `PersonalMoreDesktopLayout`, desktop `Sidebar` (personal/solo), `Achievements`, `CoachingUpgradeCard` (when `isPersonal`), `FindTrainer` legacy redirect. **Clients** remain on **`/discover`** (no access to `/personal/coach-tier-selection`).
  - Wired discovery-to-profile handoff with tier query propagation in `src/pages/CoachDiscoveryPage.jsx`.
  - Added dedicated tier selection conversion screen:
    - `src/pages/personal/PersonalCoachTierSelectionPage.jsx`
    - routed at `/personal/coach-tier-selection`
  - Tier selection root uses **`derivePersonalCoachTierSelectionState`** + **`atlasMigrationDataAttributes`** (phase **2**, primaries `tier_selection_basic` | `tier_selection_enhanced`).
  - Updated work-with-coach hub to route through the dedicated tier selection step before discovery.
  - Analytics: `PERSONAL_COACH_TIER_SELECTED` on continue to discovery (`src/services/analyticsService.js`).
- Remaining inconsistencies
  - Any remaining **in-app** links that still go to `/discover` without the tier step should be audited for role (Personal vs Client) and product intent.

### Access denied → Find a coach (Personal)
- Status: **Aligned**
- Fixes implemented
  - `src/App.jsx` messages routes: `accessDeniedSecondaryAction` for Personal users now targets **`/personal/coach-tier-selection?source=from_general_discovery`** (not raw `/discover`).

### Legacy coach marketplace (`/coach-marketplace`)
- Status: **Aligned with Phase 2 conversion patterns**
- Fixes implemented
  - `src/pages/CoachMarketplacePage.jsx` uses shared `CoachCard`, `mapLegacyMarketplaceProfileToDiscoveryRow`, discovery screen state, and slug/referral/tier navigation consistent with `/discover` (inquiry modal when no public slug/referral).
  - Full migration contract via **`deriveLegacyCoachMarketplaceRouteState`**: `legacy_marketplace_signed_out` | `error` | `loading` | `market_empty` | `results` (phase **2**).

### Work With a Coach Hub
- Status: **Started**
- Current issues
  - Hub uses shared wrappers/tokens but still relies on narrative sections over explicit conversion states.
- Fixes implemented
  - Added explicit hub conversion-state derivation (`explore`, `consider`, `ready_to_contact`) in `src/lib/marketplaceScreenState.js`.
  - Applied hub state to `src/pages/personal/PersonalCoachTransitionPage.jsx` and bound a single primary CTA by state.
  - Hub body uses **`derivePersonalCoachHubRouteState`** + **`atlasMigrationDataAttributes`** (phase **2**, primaries `coach_hub_explore` | `coach_hub_consider` | `coach_hub_ready_to_contact`).
- Remaining inconsistencies
  - State is now explicit, but supporting sections are still narrative-heavy; continue reducing non-state conditionals.

---

## Roadmap: next phases (after Phase 1–2 work in progress)

| Phase | Scope | Intent |
|-------|--------|--------|
| **Phase 1** (finish) | Review Center family, Personal Nutrition top-level state, Personal Progress state matrix, Client Detail sections | Close the core loop with one explicit state model per surface. |
| **Phase 2** (finish) | Coach profile enquiry tracking helper, any remaining coach-card surfaces, hub narrative → state maps | Conversion funnel consistency and analytics. |
| **Phase 3** | Personal / Coach / Client onboarding, auth, role selection | Shared onboarding wrappers and gates; no duplicate flows per role. |
| **Phase 4** | More, Settings, units, admin, notifications | Secondary surfaces use same tokens, state keys, and shell rules. |

**Suggested order:** Finish Phase 1 “core loop” items that block consistency → complete Phase 2 conversion polish (tracking + cards) → Phase 3 onboarding → Phase 4 secondary.

