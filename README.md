# Atlas Performance Labs

Atlas Performance Labs is a **performance coaching platform** built for strength coaches, transformation coaches, bodybuilding prep coaches, and personal users. It helps coaches manage clients, deliver training and nutrition plans, track progress, monitor athlete health and retention, and run multi-coach teams—all from one unified experience.

**Built by a coach, for coaches.**

Atlas helps coaches run their entire coaching business: clients, programming, check-ins, analytics, retention, and payments.

---

## What the app is

- **Web + native:** Single codebase that runs in the browser and as native iOS/Android apps (via **Vite + Capacitor**; this project is **not** Expo).
- **Role-based:** Three main roles—**Coach**, **Client**, **Personal**—each with tailored dashboards, routes, and workflows.
- **Coach types:** Coaches have a **coach focus** that gates features:
  - **Transformation** — habits, adherence, retention, payments; comp prep/posing hidden by default.
  - **Competition** — comp prep, posing, peak week, photo guide.
  - **Integrated** — both transformation and competition features.
- **Organisation mode:** Solo coaches can **create a team** (organisation), become **owner**, and invite more coaches. Owners/admins get org-wide dashboards, analytics, review queue, and team management; regular coaches see only their assigned clients.
- **Marketplace & discovery:** Coaches can list in **Find a Coach** (coach_marketplace_profiles). Personal users and visitors can discover coaches, view public profiles and result stories, and submit enquiries. Personal-to-coach conversion is tracked (opened Find a Coach → viewed profile → enquiry → converted to client).

---

## Tech stack

| Layer        | Technology |
|-------------|------------|
| **Frontend** | React 18, Vite 6, Tailwind CSS, React Router, TanStack Query, Framer Motion, Radix UI, Lucide icons |
| **Mobile**   | **Capacitor** (iOS + Android) — one codebase, native builds. **Not Expo.** |
| **Backend**  | **Supabase** — PostgreSQL, Auth, Row Level Security, Storage, Edge Functions |
| **Payments** | **Stripe** — checkout, subscriptions, Connect (when configured) |
| **Hosting**  | **Vercel** (web); Xcode / Android Studio for app store builds |

---

## Architecture Overview

Atlas follows a **client–server** architecture.

**Frontend:** React + Vite SPA with TanStack Query for data fetching and caching.

**Backend:** Supabase provides:

- PostgreSQL database
- Auth (email/password, OTP)
- Row Level Security (RLS)
- Edge Functions for server-side logic (invite codes, public profile, enquiries, etc.)

**Mobile:** Capacitor wraps the web app and serves the built **`dist/`** bundle inside a native shell (iOS/Android). No separate native codebase.

**Data flow:** Client → Supabase Auth → JWT → Supabase API / Edge Functions → PostgreSQL. The frontend sends the JWT in request headers for authenticated Edge Function calls.

**Realtime:** Supabase Realtime can be used for live messaging and check-in updates where subscribed.

**Storage:** Supabase Storage holds images such as progress photos, check-in attachments, and result story media.

---

## Security Model

Atlas uses **Supabase Row Level Security (RLS)** so access is enforced in the database.

**Principles:**

- **Coaches** can only access their own clients and related data (programs, check-ins, messages, habits, etc.).
- **Organisation owners/admins** can access organisation-level data (members, org-wide analytics, review queue, client assignment).
- **Clients** can only access their own data (profile, check-ins, messages, habits, program).
- **Personal users** have isolated data with no coach access until they convert to a client.

All access control is enforced at the database level via RLS policies; the frontend does not grant permission by itself.

---

## Core Database Groups

**User system**

- `profiles`
- `organisations`
- `organisation_members`
- `organisation_invites`

**Clients & coaching**

- `clients`
- `client_state`
- `client_engagement_events`
- `client_habits`
- `client_habit_logs`

**Programs**

- `program_blocks`
- `program_weeks`
- `program_days`

**Messaging**

- `message_threads`
- `message_messages`

**Competition prep**

- `contest_preps`
- `peak_weeks`
- `peak_week_plan_days`
- `peak_week_checkins`

**Marketplace**

- `coach_marketplace_profiles`
- `client_result_stories`
- `coach_public_enquiries`

**Billing**

- `client_subscriptions`
- `client_payments`
- `atlas_plans`
- `coach_plan_subscriptions`

---

## Product Roadmap

**Phase 1 — Core coaching platform**

- Clients
- Programs
- Check-ins
- Messaging
- Peak week
- Habits
- Retention analytics

**Phase 2 — Coach business tools**

- Stripe payments
- Trainer earnings
- Referral tracking
- Public coach profiles
- Marketplace discovery

**Phase 3 — Organisation mode**

- Multi-coach teams
- Organisation analytics
- Client assignment
- Workload tracking

**Phase 4 — Growth engine**

- Find a Coach marketplace
- Personal-to-coach conversion tracking
- Public transformation stories

**Phase 5 — Future**

- Training intelligence (AI-assisted insights)
- Automated coaching insights
- Smart check-in analysis
- Predictive retention alerts

---

## How to run the app

### Prerequisites

- **Node.js** 18+ (and npm; project uses `"node": ">=18.0.0 <21.0.0"` in `package.json`)
- **iOS:** Mac with Xcode
- **Android:** Android Studio

### Install

```bash
git clone <your-repo-url>
cd atlas-performance-labs-app
npm install
```

### Environment variables

Create a **`.env.local`** in the project root (do **not** commit real keys).

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes (for auth/data) | Supabase project URL, e.g. `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes (for auth/data) | Supabase anonymous (public) key |

Without these, the app still runs in **local/demo mode** with limited backend features.

Optional (for full functionality):

- Stripe keys and webhook secret (typically in Supabase Edge Functions or deployment env).

---

### Web (development)

```bash
npm run dev
```

- Opens at **http://localhost:5174** (see `vite.config.js`).
- Edits hot-reload.

### Web (production build)

```bash
npm run build
npm run preview
```

- Output is in **`dist/`**.

---

### Mobile (Capacitor)

**Sign-in on device:** If you see “Sign-in unavailable”, the app was built without Supabase env vars. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` or `.env.local` (copy from `.env.example`), then run `npm run build` and `npm run cap:sync:all` (or `npx cap sync ios`). Vite inlines these at build time, so they must be set before building.

**One-time: add platforms**

```bash
npx cap add ios
npx cap add android
```

**iOS (simulator or device)**

1. **Terminal 1** — dev server so the app can load from it:
   ```bash
   npm run dev:mobile
   ```
   (Runs Vite with `--host` on port 5174.)

2. **Terminal 2** — sync and open Xcode:
   ```bash
   npm run ios:live
   ```
   App loads from the dev server and can live-reload.

3. **Physical iPhone** (same Wi‑Fi as Mac): set your Mac’s IP:
   ```bash
   CAPACITOR_SERVER_URL=http://YOUR_MAC_IP:5174 npx cap sync ios && npx cap open ios
   ```
   Keep `npm run dev:mobile` running.

**Android (emulator or device)**

1. **Terminal 1:** `npm run dev:mobile`
2. **Terminal 2:** `npm run android:live`

For a **physical Android device** (same Wi‑Fi), use your machine’s IP in `CAPACITOR_SERVER_URL` as above, with `android` instead of `ios`.

**Production mobile build (no live reload)**

```bash
npm run build
npm run cap:sync
npm run ios
# or
npm run android
```

Then run from Xcode or Android Studio; the app serves from the built **`dist/`** folder.

---

## Main scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (web) |
| `npm run dev:mobile` | Vite with `--host` for Capacitor live reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run cap:sync` | Build and sync web assets to native projects |
| `npm run ios` | Ensure iOS project and open Xcode (after sync) |
| `npm run ios:live` | Sync with dev server URL and open iOS |
| `npm run android` | Sync and open Android Studio |
| `npm run android:live` | Sync with dev server URL and open Android |
| `npm run db:push` | Push Supabase migrations (`npx supabase db push --include-all`) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check (jsconfig) |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run expo` | Prints message: this project uses Vite + Capacitor, not Expo |

---

## Features

### Roles and access

- **Coach** — Full coach dashboard: clients, programs, nutrition, review center, messaging, analytics, earnings, organisation/team (when in an org), peak week (when focus is competition/integrated), habits, retention.
- **Client** — Today’s workout, programs, check-ins, nutrition, messaging, progress, habits, peak week (when applicable), milestones.
- **Personal** — Solo athlete: workouts, metrics, nutrition, no coach. Can use **Find a Coach** to discover coaches, view marketplace/public profiles, submit enquiries, and convert to client via invite code.

### Coach features

- **Dashboard (Coach Home)** — Hero review card, Needs Attention, roster health, revenue stability, shortcut tiles (Clients, Analytics, Programs, Review Center, Create Team, etc.).
- **Clients** — List with filters (All, Active, Prep, At Risk, Check-In Due), risk bands, search; client detail with overview, check-ins, program, habits, momentum, milestones, health card, coach assignment (org mode).
- **Programs** — Program builder (blocks, weeks, days), assign to clients, program viewer.
- **Review Center** — Unified queue (check-ins, pose checks, retention alerts, billing, flags); filters and sort; resolve/dismiss; organisation owner/admin can see org-wide queue.
- **Messaging** — Threads per client; assigned coach/client relationship preserved; no team-wide broadcast.
- **Nutrition** — Nutrition plans, weeks, adjustments.
- **Analytics** — Roster trends, compliance, retention risk, attention queue, momentum and habit analytics; org owners/admins have **Organisation Analytics** (org-wide metrics and coach workload).
- **Earnings / Stripe** — Trainer earnings, Pro plan upgrade/cancel, Connect (when configured).
- **Peak week** (competition/integrated) — Peak week engine, coach dashboard, editor, client view, peak week check-ins and review.
- **Habits** — Define habits per client (categories, targets), client daily logging, adherence and streak views; momentum score combines habits, workouts, check-ins, engagement.
- **Retention** — Retention risk, attention queue, re-engagement nudges, retention analytics.
- **Referrals & public results** — Referral dashboard (code, shareable link, profile/story views, enquiries, signups), public coach profile (`/coach/:slug`), result stories (transformation/prep), coach enquiries inbox; Personal-to-Coach conversion card (profile views, enquiries, converted, rate). Analytics: `v_referral_analytics_by_coach`, `get_personal_conversion_metrics`, `get_org_personal_conversion_metrics`.
- **Marketplace listing** — Coach marketplace setup page: display name, headline, bio, pricing summary, visibility, accepts (transformation / competition / personal). Listing powers Find a Coach discovery and marketplace profile page (`/marketplace/coach/:slug`). Entry points: More, Referral dashboard, Account, onboarding.
- **Organisation / team** — Create organisation (solo → team), Organisation Dashboard (summary, workload by coach, quick actions), Team Management (invite, roles, deactivate), Organisation Analytics (owner/admin, including referral and Personal-to-Coach conversion), client assignment to coaches within org.

### Client features

- **Today / workout** — Today’s workout, log completion, peak week day plan when in prep.
- **Programs** — View assigned program.
- **Check-ins** — Submit check-ins; peak week check-ins when in prep.
- **Nutrition** — View nutrition plan.
- **Messages** — Thread with coach.
- **Progress** — Progress photos, metrics.
- **Habits** — Daily habit logging, adherence and streak on dashboard.
- **Momentum** — Momentum score and status on dashboard.
- **Milestones** — Milestones card.
- **Athlete dashboard** — Unified view: today’s workout, habits, momentum, progress insights.

### Marketplace & discovery (Find a Coach)

- **Coach discovery** — List of public coaches (coach_marketplace_profiles + profiles). Filters: coach type, accepts transformation/competition, location, pricing. Cards: name, headline, type, short bio; CTA View Profile. Loading skeleton and empty states (no coaches found / no match; clear filters).
- **Marketplace coach profile** — Public profile by slug: name, headline, bio, accepted client types, pricing, public result stories, Enquire CTA, Book consultation (placeholder). Loading skeleton; empty state when no public results yet.
- **Coach marketplace setup** — Coaches create/update listing (display name, headline, bio, pricing, visibility, accepts). Empty state when no listing yet; loading skeleton.
- **Personal-to-coach conversion** — Events in platform_usage_events: personal_opened_find_a_coach, personal_viewed_coach_profile, personal_submitted_enquiry, personal_converted_to_client. Coach Referral Dashboard shows conversion card; Organisation Analytics (owner/admin) shows global rate, top converting coaches, comp vs transformation split.

### Organisation / team features

- **Create Team** — Entry points from More and Coach Home; solo coach creates organisation and becomes owner; can invite coaches later (no forced upgrade).
- **Organisation Dashboard** — Summary metrics (coaches, clients, competition/transformation, pending reviews, risk, momentum), quick actions (Manage Team, Organisation Analytics, Assign Clients, Review Queue), workload-by-coach table.
- **Team Management** — List members (role, active, joined), invite by email, change role, deactivate/reactivate; owner/admin only.
- **Organisation Analytics** — Owner/admin: total clients, active coaches, avg compliance, retention distribution, pending reviews, momentum, prep roster, revenue snapshot (when available), coach workload table.
- **Client assignment** — On client detail: assign/reassign client to a coach in the same organisation; owner/admin can assign any org coach; coach can assign only themselves when allowed by permissions.

### Auth and backend

- **Supabase Auth** — Email/password, OTP; session and profile loading.
- **Profiles** — Role (coach, client, personal), coach_focus (transformation, competition, integrated), organisation_id when in an org.
- **Data** — Clients, programs, check-ins, messages, habits, engagement events, retention/attention views, organisations, organisation_members, coach_marketplace_profiles, client_result_stories, coach_public_enquiries, client_subscriptions, client_payments; Edge Functions for key operations; RLS and organisation-scoping where applicable.

---

## Supabase

- **Link project (one-time):**  
  `npx supabase link --project-ref <PROJECT_REF>`  
  (Get `<PROJECT_REF>` from the Supabase dashboard URL.)
- **Migrations:**  
  `npm run db:push` or `npx supabase db push --include-all`.  
  Migrations live under **`supabase/migrations/`**; they define tables, views, RLS, and triggers for auth, profiles, clients, programs, check-ins, messages, habits, organisations, review queue, retention, momentum, billing (client_subscriptions, client_payments, atlas_plans), referrals (coach_referral_codes, coach_referral_events, client_result_stories), enquiries (coach_public_enquiries), marketplace (coach_marketplace_profiles), and personal conversion metrics (RPCs reading platform_usage_events).
- **Edge Functions** — Deployed to Supabase; used for invite codes, trainer earnings, Stripe, public coach profile, submit-public-enquiry, track-referral-event, and other server-side operations. See **`supabase/functions/`** and any functions README for deploy and env setup.

---

## Deployment

- **Web**  
  - Build: `npm run build`.  
  - Deploy the **`dist/`** folder to Vercel (or any static host).  
  - Set **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** in the deployment environment.  
  - **Vercel:** `vercel.json` is set up with `buildCommand`, `outputDirectory`, and `framework: "vite"`.

- **iOS / Android**  
  - Build: `npm run build` then `npx cap sync`.  
  - Open **`ios/`** or **`android/`** in Xcode or Android Studio and build/submit.  
  - Do **not** set `CAPACITOR_SERVER_URL` for store builds; the app uses the bundled **`dist/`** assets.

### Xcode / iOS console messages

When running the app from Xcode you may see:

- **`UIScene lifecycle will soon be required`** — Apple is moving toward requiring the UIScene lifecycle. The app currently uses the older `UIApplicationDelegate` + `window` pattern. **No fix needed for now**; the app runs fine. When Apple enforces this, you can adopt UIScene (add scene manifest to Info.plist and a SceneDelegate) or update the Capacitor iOS template.
- **`Could not create a sandbox extension for .../App.app`** — Common in Simulator; usually harmless. If the app runs and loads the web view, you can ignore it.
- **`KeyboardPlugin: no resize`** — Capacitor keyboard plugin; no action needed unless you rely on keyboard resize behavior.
- **`Networking process took X seconds to launch`** — Normal WebKit startup log.
- **`WebContent ... Unable to hide query parameters from script`** — WebKit internal; safe to ignore.
- **`Accessory bar visible change`** — Keyboard accessory bar; informational only.

---

## Project structure (high level)

- **`src/`** — React app: `pages/`, `components/`, `lib/` (auth, Supabase client, roles, permissions, momentum, re-engagement, org scope, referrals, payments, etc.), `data/`, `services/` (analytics, engagement), `ui/`. Marketplace: CoachDiscoveryPage, CoachMarketplaceProfilePage, CoachMarketplaceSetupPage; skeletons and empty states in LoadingState.
- **`supabase/`** — `migrations/`, `functions/` (Edge Functions).
- **`ios/`**, **`android/`** — Capacitor native projects (generated/updated by `cap add` and `cap sync`).
- **`index.html`** — Entry HTML; Vite injects the script.
- **`vite.config.js`** — Vite config (port 5174, alias `@` → `src/`, React, SVGR, circular dependency check).

---

## Context for new AI chats (copy-paste this)

When you open a new chat with an AI assistant, copy the block below so it has full project context. **Update this block whenever you add new features or conventions** so the next chat stays in sync.

```
PROJECT: Atlas Performance Labs — performance coaching platform for coaches and personal users (web + native).

STACK:
- Frontend: React 18, Vite 6, Tailwind, React Router, TanStack Query, Framer Motion, Radix UI, Lucide. Path alias: @ → src/
- Mobile: Capacitor (iOS/Android). This is NOT Expo — do not use Expo, expo-cli, or Expo APIs.
- Backend: Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions). Client: @/lib/supabaseClient (getSupabase, hasSupabase).
- Payments: Stripe (checkout, subscriptions, Connect when configured).
- Hosting: Vercel (web). Dev: npm run dev (port 5174). Build: npm run build → dist/

ROLES & ACCESS:
- Roles: coach | client | personal (canonical; no "athlete" or "trainer" in DB).
- Coach focus (profiles.coach_focus): transformation | competition | integrated. Gates comp prep, peak week, posing, habits, etc.
- Organisation: solo coach can "Create Team" → becomes owner. Org has owner/admin/coach/assistant/posing_coach. Owner/admin see org-wide queue, analytics, team management; coaches see assigned clients. Permissions: @/lib/organisationPermissions (canManageTeam, canAssignClients, etc.). Scoping: @/lib/organisationScope (resolveOrgCoachScope for org_wide vs coach_only).

KEY PATHS & CONVENTIONS:
- Auth: @/lib/AuthContext (useAuth: user, role, profile, coachFocus). Roles: @/lib/roles.
- API: invokeSupabaseFunction (Edge Functions); pass JWT via header. No Base44; legacy stubs in @/lib/emptyApi.js if referenced.
- Clients: clients table has coach_id, trainer_id, assigned_coach_id, organisation_id. Keep coach_id/trainer_id in sync with assigned_coach_id for compatibility.
- Data: Supabase tables/views — clients, profiles, checkins, message_threads, message_messages, program_blocks, client_state, client_engagement_events, client_habits, client_habit_logs, organisations, organisation_members, organisation_invites, coach_marketplace_profiles, client_result_stories, coach_public_enquiries, client_subscriptions, client_payments, v_coach_review_queue, v_client_retention_risk, v_client_momentum, v_client_habit_adherence, v_coach_attention_queue, v_referral_analytics_by_coach, peak_weeks, peak_week_plan_days, peak_week_checkins, contest_preps. Platform usage / personal conversion: platform_usage_events (personal_opened_find_a_coach, personal_viewed_coach_profile, personal_submitted_enquiry, personal_converted_to_client); RPCs get_personal_conversion_metrics, get_org_personal_conversion_metrics.
- Marketplace: Coach discovery (CoachDiscoveryPage), marketplace profile (CoachMarketplaceProfilePage), coach setup (CoachMarketplaceSetupPage). Skeletons: CoachDiscoverySkeleton, CoachMarketplaceProfileSkeleton, CoachMarketplaceSetupSkeleton. EmptyState for no coaches, no public results, no marketplace profile.
- UI: @/ui/tokens (colors, spacing, shell), @/ui/pageLayout (pageContainer, standardCard, sectionLabel). EmptyState, skeletons in @/components/ui/LoadingState. Design: Atlas shell, premium/operational tone.

RULES:
- Correct the prompt first: align table/column names, ownership, and paths with this codebase (see migrations, existing libs). Then implement.
- Do not introduce Expo or a second Supabase client. Use existing getSupabase() and organisation/permission helpers.
- New features: add to this README context block and to the main README feature list so the next chat stays current.
```

---

## License

This project is private and proprietary. All rights reserved.
