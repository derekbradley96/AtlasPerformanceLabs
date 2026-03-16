# Atlas Full Audit – Before vs After

This report summarises the Atlas app + website audit and the key implementation changes made across auth, routing, roles, UI, and performance.

---

## 1. Auth & Login Flow

**Before**
- Multiple auth entry points (`/trainer-login`, `/solo-login`, role-select screens) created confusion.
- Auth callbacks routed to mixed and sometimes legacy dashboards (`/messages` for clients, `/trainer` variants).
- Legacy roles (`trainer`, `solo`, `athlete`) still appeared in auth logic and routing decisions.

**After**
- **Single auth entry**: `/auth` (via `AuthScreen`) is the canonical production entry for login, signup, and password flows.
- **Unified callback**: `/auth/callback` now:
  - Exchanges Supabase tokens.
  - Waits for `profile.role`.
  - Routes to:
    - Coach → `/home`
    - Client → `/client-dashboard`
    - Personal → `/solo-dashboard`
- **Legacy login routes**:
  - `/trainer-login` → redirects to `/auth?mode=login&account=coach`.
  - `/solo-login` → redirects to `/auth?mode=login&account=personal`.
  - `/role-select` → DEV-only; production redirects to `/auth`.
- Auth guard helpers (`AuthGuard`, `OnboardingGate`) now always hand off to `/auth` instead of separate role/onboarding flows.

---

## 2. Routes, Roles, and Coach Types

**Before**
- Mixed use of `trainer`, `solo`, and `athlete` alongside `coach`, `client`, and `personal`.
- Duplicate dashboards and legacy route names (e.g. `/trainer-dashboard`, `/athlete`) created ambiguity.

**After**
- **Canonical roles** enforced via `src/lib/roles.js`:
  - Live roles: `coach`, `client`, `personal` (with optional `admin`).
  - Legacy values `trainer`, `solo`, `athlete` are read-only and normalised:
    - `trainer` → `coach`
    - `solo` / `athlete` → `personal`
- **Dashboards per role**:
  - Coach → `/home` (CoachHomePage / TrainerDashboard shell).
  - Client → `/client-dashboard`.
  - Personal → `/solo-dashboard` (+ personal insights/performance pages).
- **Legacy routes**:
  - `/trainer`, `/trainer-dashboard` → redirect to `/home`.
  - `/solo` → redirects to `/home`.
  - `/athlete` → now an alias for the personal dashboard, gated by `Roles.PERSONAL`.
- **Coach types** remain consistent:
  - Values: `transformation`, `competition`, `integrated`.
  - Used in Account and comp-prep gating to control visibility of prep features.

---

## 3. Button Wiring & Navigation

**Before**
- Some CTAs, especially around personal vs athlete flows, pointed to legacy routes.
- Multiple login/role-select entry points increased the chance of landing on the wrong screen.

**After**
- **More page (client)**:
  - “Athlete dashboard” row now routes to `/client-dashboard` instead of the legacy `/athlete` path.
- **Login paths**:
  - All marketing and legacy login/role pages now funnel into `/auth` with appropriate query params.
- **Core flows** (Coach/Client/Personal) were verified:
  - Coach Home tiles → appropriate routes (Clients, Messages, Review Center, Programs, Revenue, Analytics, Comp Prep, etc.).
  - Clients list → client detail → messages / review center.
  - Client dashboards → Today, Progress, Messages, More.

---

## 4. Back Navigation & Swipe-Back

**Before**
- Edge-swipe and back navigation were partly centralised but not clearly documented; potential for inconsistent fallback in some flows.

**After**
- `AppShell`:
  - Uses `useEdgeSwipeBack` on the main content container:
    - Only active on non-tab routes.
    - Ignores interactive elements and respects `data-no-swipe-back`.
  - `handleBack`:
    - Uses `location.state.from` when available (returns to the exact originating page).
    - Provides explicit fallbacks:
      - `/messages/:id` → `/messages`.
      - `/clients/:id` (and `/client/*`) → `/clients`.
      - Otherwise: `navigate(-1)` and, if the URL doesn’t change, fallback to `/home`.
- Result: client detail, message threads, and review detail screens all return to the correct list or a safe dashboard when navigating back, including hardware back and edge-swipe on mobile.

---

## 5. App Shell Unification & Tabs

**Before**
- Tab sets and active route mapping were slightly inconsistent (e.g. client tab order vs spec; legacy `/home` paths per role).

**After**
- `routeMeta.getTabRoutesForRole` is the **single source of truth**:
  - Coach: `/home`, `/clients`, `/messages`, `/more`.
  - Client: `/client-dashboard`, `/today`, `/progress`, `/messages`, `/more`.
  - Personal: `/solo-dashboard`, `/today`, `/progress`, `/nutrition`, `/more`.
- `AppShell`:
  - Uses `getTabRoutesForRole` to render `BottomNavPremium`.
  - Normalises active keys so `/home` maps to the correct per-role dashboard.
  - Ensures tab bar only shows on tab-root routes; pushed routes hide the tab bar and show a back button.

---

## 6. Website UX & Visual Improvements

**Before**
- Marketing pages were functional but visually closer to app screens (simpler nav, less pronounced hero and social proof, app-like card layouts in some sections).

**After**
- `MarketingLayout.jsx`:
  - Upgraded to a more **SaaS-like shell**:
    - Blurred, gradient header with Atlas blue glow.
    - Integrated “Performance Labs” wordmark.
    - Wider content grid (`max-w-6xl`) in header and footer.
    - Refined nav and footer links, including Marketplace.
- `MarketingSections.jsx`:
  - **Hero**:
    - Adds an eyebrow (“Built for performance coaching”), stronger gradient, and refined typography.
    - More premium pill-shaped CTAs with consistent spacing.
  - **Features**:
    - Scales to three columns on large screens for a proper features overview.
  - **Social proof**:
    - Improved testimonial styling with large quotation marks and clearer emphasis.
- Result: the public site feels more like a dedicated marketing experience, clearly separate from the in-app operational shell.

---

## 7. Performance & Stability Guardrails

**Before**
- Some race conditions and “not a function” errors in early-load paths (Clients, Messages) created a perception of slowness and instability.

**After**
- **Auth hydration**:
  - `AuthContext` ensures `authReady` is set correctly even when no session exists, avoiding long boot delays.
- **Clients & Messages guardrail fixes**:
  - Added defensive checks and auto-retry logic so data loaders:
    - Only call functions once they exist.
    - Retry once on transient “not ready” errors.
  - User-facing errors are now friendlier (“Data not ready. Pull down to refresh.”) instead of raw JS errors.
- **Supabase usage**:
  - Queries are guarded behind `hasSupabase` and `authReady`.
  - Dashboards use reasonable limits and skeletons for perceived performance.

---

## 8. Glitch & Edge-Case Polish

**Before**
- Minor inconsistencies in role naming, legacy CTAs, and some potential UI edge cases (e.g. athlete wording vs personal role, small header/footer differences).

**After**
- Roles and CTAs:
  - Canonicalised roles in logic to `coach`, `client`, `personal`.
  - Retained legacy route aliases only as safe redirects to canonical paths.
  - Fixed the client “Athlete dashboard” CTA to point at the correct client dashboard.
- UI/Shell:
  - Ensured high-traffic screens use consistent spacing, icon sizes, and shared `pageLayout` tokens.
  - Confirmed that marketing pages never reuse in-app bottom nav or AppShell header.

---

## 9. QA & Audit Harness

- Added checklists:
  - `docs/APP_QA_AUDIT_CHECKLIST.md` – app-focused:
    - Auth, routing, role gating, coach types, CTAs, back navigation, shells, loading states, and mobile behaviour.
  - `docs/WEBSITE_QA_AUDIT_CHECKLIST.md` – website-focused:
    - Shell separation, hero/CTA design, social proof, marketplace/discovery flows, navbar/footer polish, and mobile layout.
- These documents provide a repeatable path for future QA passes and ensure that the improvements made in this audit can be verified and maintained over time.

