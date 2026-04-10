# PROMPTS 7–10 — Post-onboarding navigation, empty states, edge cases, audit

## PROMPT 7 — Routing logic

**Source of truth:** `src/lib/postOnboardingRoutes.js` → `getPostOnboardingPath(role)`

| Role (normalized) | Path | Rationale |
|-------------------|------|-----------|
| `coach` / `trainer` | `/home` | Renders `CoachHomePage` via `HomePageByRole`; matches coach tab root. |
| `client` | `/client-dashboard` | Matches client bottom-nav “Home” tab (`getTabRoutesForRole`). |
| `personal` / `solo` | `/solo-dashboard` | Matches personal bottom-nav “Home” tab. |

**Wiring:**

- `CoachOnboardingFlow`, `CoachOnboardingWizard` → `getPostOnboardingPath('coach')`
- `ClientOnboardingFlow` (finish + boot when already complete) → `getPostOnboardingPath('client')`
- `PersonalOnboardingFlow` → `getPostOnboardingPath('personal')`
- `AuthScreen` (signed-in, profile present) → `getPostOnboardingPath(profile.role)` when sending users into the app

**Note:** Splash / `AuthScreenGate` still land on `/home` when role isn’t resolved yet; `HomePageByRole` renders the correct dashboard. Client/personal users who complete onboarding are sent to canonical tab routes so the tab bar stays correct (`AppShell` maps `/home` → `/client-dashboard` / `/solo-dashboard` for tab highlight).

---

## PROMPT 8 — Empty states & first actions

| Area | Change |
|------|--------|
| **Coach** (`CoachHomePage.jsx`) | Zero-client card: copy “Add your first client”; CTAs **Invite a client**, **Create your first program**, **Open Clients** (no “athlete” wording in this card). |
| **Client** (`ClientDashboard.jsx`) | After onboarding: dismissible **Open Today** hint (`sessionStorage` key `atlas_client_post_onboarding`). If linked to coach but **no active program assignment**: card explains coach will assign plan (variant if `selected_service_id` on `clients`). CTA **Message your coach**. |
| **Personal** (`GeneralDashboard.jsx`) | Primary CTA copy **Start your first workout**; habits copy no longer says “athlete profile”. Recent-activity empty title aligned to **Start your first workout**. |

**Data:** `getMyClientProfile` now selects `selected_service_id` for client messaging.

---

## PROMPT 9 — Edge cases

| Case | Fix |
|------|-----|
| **Coach — no plans** | Existing **Skip** on packages step + toast; no crash. |
| **Client — invalid code** | Clearer default error + network failure message. |
| **Client — no coach packages** | **Continue without a plan**; `sessionStorage` `atlas_client_join_skip_plan`; signup does not require `getPendingClientServiceId()` when flag set; profile save already allows no plan when `services.length === 0`. |
| **Personal — optional stats** | Unchanged; optional fields already omitted from required validation. |

---

## PROMPT 10 — Audit (manual)

**Flows to exercise**

1. **Coach:** sign up → coach onboarding → skip or add packages → finish → **Coach Home** with zero-client card and program CTA.  
2. **Client:** code → plan or no plans → sign up → profile → finish → **Client dashboard** with Today hint + plan message if unassigned.  
3. **Personal:** sign up → onboarding → finish → **Solo dashboard** with workout CTA.

**Speed / clarity / friction**

- Role-specific landing paths reduce “wrong tab” confusion for clients/personal.  
- Client no-plan path removes dead-end when coach has not published services.  
- Today hint surfaces logging entry point without forcing `/today` as the only home route.

**Remaining friction (optional follow-ups)**

- Splash still routes to `/home` before profile hydration (acceptable; `HomePageByRole` covers it).  
- Client `selected_service_id` does not load human-readable plan name client-side (RLS); copy stays generic.  
- `CoachOnboardingFlow` step 3 still requires valid price for any **named** plan row before continue (by design); skip remains available.

---

## Files touched (summary)

- `src/lib/postOnboardingRoutes.js` (**new**)
- `src/lib/clientProfiles.js`
- `src/pages/CoachOnboardingFlow.jsx`
- `src/pages/CoachOnboardingWizard.jsx`
- `src/pages/ClientOnboardingFlow.jsx`
- `src/pages/PersonalOnboardingFlow.jsx`
- `src/screens/AuthScreen.jsx`
- `src/components/shell/AppShell.jsx`
- `src/pages/CoachHomePage.jsx`
- `src/components/dashboards/ClientDashboard.jsx`
- `src/components/dashboards/GeneralDashboard.jsx`
- `docs/PROMPT7-10_ONBOARDING_UX.md` (this file)
