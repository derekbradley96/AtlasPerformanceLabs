# Navigation & Role Consistency – Deliverable

## 1) All routes and which role(s) can access them

| Path | Role(s) | Label |
|------|--------|--------|
| `/` | public | Entry / Role Select |
| `/login` | public | Login (redirects to /) |
| `/trainer-login`, `/solo-login`, `/client-code` | public | Auth entry |
| `/admin-dev-panel`, `/navigation-audit` | public (DEV only) | Admin / Navigation Audit |
| `/home` | any | Home (role dashboard) |
| `/inbox`, `/closeout`, `/briefing` | trainer | Inbox, Closeout, Briefing |
| `/clients`, `/clients/:id`, `/clients/:id/review-center`, `/clients/:id/checkins/:checkinId`, `/clients/:id/intervention`, `/clients/:id/intake` | trainer | Clients & detail |
| `/review-center`, `/review/:reviewType/:id`, `/global-review`, `/review-global` | trainer | Review |
| `/messages`, `/messages/:clientId`, `/messages/:threadId` | any | Messages |
| `/more`, `/appearance`, `/helpsupport` | any | More, Appearance, Help |
| `/notificationsettings` | any | Redirect → /settings/notifications |
| `/settings/notifications`, `/settings/equipment`, `/settings/branding`, `/settings/account` | any (branding: trainer) | Settings |
| `/account` | any | Redirect → /settings/account |
| `/programs`, `/programbuilder`, `/programdayeditor` | trainer | Programs |
| `/editprofile`, `/profile` | any | Profile |
| `/inviteclient`, `/onboarding-link`, `/public-link`, `/services` | trainer | Invite, links, services |
| `/plan`, `/team` | trainer (owner) | Plan & Billing, Team |
| `/earnings`, `/capacity`, `/consultations`, `/leads` | trainer | Earnings, Capacity, etc. |
| `/intake-templates`, `/intake-templates/:id` | trainer | Intake templates |
| `/achievements` | any | Achievements |
| `/comp-prep` subtree | any (some nested trainer-only) | Competition Prep |
| `/client-dashboard`, `/solo-dashboard` | client, solo | Role dashboards |
| `/setup`, `/coach-type` | trainer | Setup, Coach type |
| `/profile`, `/workout`, `/progress`, `/findtrainer`, `/myprogram`, `/clientcheckin` | any | Client/solo flows |
| `/checkins`, `/checkintemplates`, `/editcheckintemplate` | any / trainer | Check-ins |
| `/nutrition`, `/intakeforms`, `/editintakeform`, `/reviewcheckin` | any | Nutrition, Intake, Review |
| `/activeworkout`, `/workoutsummary`, `/createworkout` | any | Workouts |
| `/entervitecode`, `/mytrainer`, `/becomeatrainer`, `/trainerpublicprofile` | any | Client/solo onboarding |
| `/onboardingrole` | any | Onboarding role |
| `/trainingintelligence` | trainer | Training Intelligence |
| `/progressphotos` | any | Progress Photos |
| `/clientdetail` | any | Redirect → /clients/:id (query `id`) |

---

## 2) Routes that were added

- `appearance` → `Appearance` (was referenced from More via `createPageUrl('Appearance')`).
- `helpsupport` → `HelpSupport` (was referenced from More via `createPageUrl('HelpSupport')`).
- `notificationsettings` → redirect to `/settings/notifications` (for `createPageUrl('NotificationSettings')`).
- `profile` → `Profile`.
- `workout` → `Workout`.
- `progress` → `Progress`.
- `findtrainer` → `FindTrainer`.
- `myprogram` → `MyProgram`.
- `clientcheckin` → `ClientCheckIn`.
- `checkins` → `CheckIns`.
- `checkintemplates` → `CheckInTemplates` (trainer).
- `editcheckintemplate` → `EditCheckInTemplate` (trainer).
- `programdayeditor` → `ProgramDayEditor` (trainer).
- `nutrition` → `Nutrition`.
- `intakeforms` → `IntakeForms`.
- `editintakeform` → `EditIntakeForm`.
- `reviewcheckin` → `ReviewCheckIn`.
- `activeworkout` → `ActiveWorkout`.
- `workoutsummary` → `WorkoutSummary`.
- `createworkout` → `CreateWorkout`.
- `entervitecode` → `EnterInviteCode`.
- `mytrainer` → `MyTrainer`.
- `becomeatrainer` → `BecomeATrainer`.
- `trainerpublicprofile` → `TrainerPublicProfile`.
- `onboardingrole` → `OnboardingRole`.
- `trainingintelligence` → `TrainingIntelligence` (trainer).
- `progressphotos` → `ProgressPhotos`.
- `clientdetail` → redirect component (reads `id` from query → `/clients/:id`).
- `navigation-audit` → `NavigationAudit` (DEV only).

---

## 3) Components / pages created

- **`src/lib/routeInventory.js`** – Single source of truth: `ROUTE_TABLE`, `DEV_ONLY_PATHS`, `getDashboardPathForRole(role)`, `isPathAllowedForRole(pathname, role)`.
- **`src/pages/NavigationAudit.jsx`** – Dev-only screen listing every route, role, and highlighting forbidden-for-current-role routes in red.
- **`RedirectClientDetail`** (in `App.jsx`) – Redirects `/clientdetail?id=<id>` to `/clients/:id`.

No new “Coming soon” stub pages were added; all referenced routes now point to existing pages or the redirects above.

---

## 4) Buttons intentionally disabled (and why)

None. No buttons were disabled as part of this pass. All audited navigation targets (More, PageNotFound, AccessDenied, etc.) now point to registered routes or redirects.

---

## Other changes

- **PageNotFound** – “Home” uses `getDashboardPathForRole(role)` (trainer/solo → `/home`, client → `/messages`, no role → `/home`).
- **AccessDenied** – “Back to Dashboard” uses `getDashboardPathForRole(role)` instead of hardcoded `/home`.
- **Admin Dev Panel** – Added “Navigation Audit” row that navigates to `/navigation-audit`.
- **ActiveWorkout** – `createPageUrl('WorkoutSummary', …)` fixed to `createPageUrl('WorkoutSummary') + '?id=' + workoutId` (createPageUrl only takes one argument).
- **Messages.jsx** – Removed duplicate imports (`useData`, `useAuth`, `formatRelativeDate`) that caused the build to fail.
- **Demo “Create Fake Client”** – Already implemented in `Clients.jsx` (Demo): “Add Client” opens a modal; save uses `data.createClient` (demo uses `addDemoClient` in `demoStore.ts`). Persistence is via `atlas_demo_dataset_v1` (full demo state). No separate `atlas_demo_clients_v1` key was added; demo clients remain part of the same demo state.

---

## How to open Navigation Audit

- In DEV: go to `/navigation-audit` or open Admin Dev Panel (`/admin-dev-panel`) and tap **Navigation Audit**.
