# End-to-end strict manual QA (browser) — Atlas

**This document is the execution checklist.** It does not replace running the app: fill **Pass / Fail / N/A / Blocked** in your environment.

**Agent/automation note:** A coding agent **cannot** complete real browser validation against your Supabase project, Stripe, or production data. Use this file (or export to spreadsheet) for humans or your own Playwright/Cypress suite.

---

## 0) Preconditions

| # | Check | Result |
|---|--------|--------|
| P1 | Staging or local `npm run dev` with valid `.env` / Supabase URL + anon key | |
| P2 | Migrations applied (including readiness + adaptive tables if testing those flows) | |
| P3 | Test accounts: **Coach** (admin optional), **Client**, **Personal** (and **Solo** if you use it) | |
| P4 | Coach profiles with `coach_focus` / journey types you need: **transformation**, **competition**, **integrated** (as applicable) | |
| P5 | Mobile: narrow viewport (375×812) + safe-area; Desktop: 1280px | |

---

## 1) Roles — access smoke (strict)

**Rule:** Each step is **Pass** only if the user sees the expected screen or a clear, intentional **access denied** with recovery path.

| Step | As Coach | As Client | As Personal | Pass/Fail |
|------|----------|-----------|-------------|-----------|
| 1.1 | `/home` loads coach home | `/client-dashboard` loads | `/solo-dashboard` or home per routing | |
| 1.2 | Tab bar shows expected tabs (coach) | Client tabs | Personal tabs | |
| 1.3 | `/clients` OK | Redirect or deny (expected) | Deny (expected) | |
| 1.4 | `/today` OK | OK | OK | |
| 1.5 | `/messages` OK | OK | OK (if enabled) | |
| 1.6 | `/workout-player` with program (client/personal) | OK | OK | |
| 1.7 | `/readiness-checkin` (client/personal) | N/A or deny | OK | OK |
| 1.8 | `/review-center/queue` coach-only | Deny | Deny | |
| 1.9 | `/admin/...` only admin | Deny for non-admin | Deny | |

---

## 2) Coach types / focus — targeted scenarios

Repeat **core coach workflow** (invite → program → nutrition → assign → client review) for each coach variant you support.

| Coach variant | Profile setup | Home shows expected intro | Prep surfaces only when expected | Pass/Fail |
|---------------|---------------|---------------------------|-----------------------------------|-----------|
| Transformation | `coach_focus` = transformation | No peak/pose clutter | Peak week hidden or N/A | |
| Competition | competition focus | Prep copy acceptable | Peak/pose routes reachable | |
| Integrated | integrated | Both contexts explained | Filters / split UX OK | |

**Core workflow steps (per variant)**

| # | Step | Pass/Fail |
|---|------|-----------|
| C1 | Open **Home** → **Start here** or **First actions** visible per roster state | |
| C2 | **Invite client** / add client path works | |
| C3 | **Program builder** opens and saves | |
| C4 | **Nutrition builder** opens | |
| C5 | **Program assignments** can assign to a client | |
| C6 | **Clients** → open a client → **Client detail** loads | |
| C7 | **Review Center** queue loads; item opens | |
| C8 | **Inbox** loads (coach) | |
| C9 | **Messages** thread open with a client | |

---

## 3) Adaptive readiness — Scenario A (client) & B (personal)

Use the detailed rows in `docs/QA_COACH_SMOKE_AND_ADAPTIVE.md` and mark each **Pass/Fail**.

Additional strict checks:

| # | Check | Pass/Fail |
|---|--------|-----------|
| R1 | Readiness save failure shows **actionable** error (table/RLS), not silent | |
| R2 | `?return=/workout-player` returns correctly after submit | |
| R3 | Coach **Apply/Ignore** updates visible state | |
| R4 | Workout player **does not** mutate stored program when adjustment is runtime-only | |

---

## 4) Workout player — strict

| # | Step | Pass/Fail |
|---|------|-----------|
| W1 | Entry → **Start** → playing without dead ends | |
| W2 | **Complete set** → rest timer → **Start next set** | |
| W3 | Last set → next exercise automatically | |
| W4 | Session complete → CTAs work | |
| W5 | Data visible in Supabase for `workout_sessions` / sets (if using Supabase) | |

---

## 5) Full app route sweep (beyond “priority surfaces”)

**Approximate route declarations in `src/App.jsx`:** ~100 `path="..."` occurrences (includes nested routes; not all are unique URLs).

### 5.1 How to generate a fresh inventory locally

```bash
# From repo root (requires ripgrep)
rg 'path="[^"]+"' src/App.jsx | sed 's/.*path="//;s/".*//' | sort -u
```

### 5.2 Tiered pass/fail (recommended)

| Tier | Scope | Pass criteria |
|------|--------|----------------|
| **P0** | Auth, splash, role landing, tab routes, logout | No blank screen; no uncaught error overlay |
| **P1** | All coach main flows: clients, client detail, program builder, nutrition builder, assignments, review center, inbox, messages | Loads + primary CTA works |
| **P2** | Prep/competition: peak week, pose checks, comp-prep subtree | Loads with correct coach focus; no prep leakage for transformation-only |
| **P3** | Marketplace, leads, billing, org, admin | Only if you use them; Stripe/admin as applicable |
| **P4** | Marketing site subtree | Public access OK |

### 5.3 Dev helper route

If `import.meta.env.DEV`, app exposes **`/navigation-audit`** — use it to assist manual navigation coverage (see `App.jsx`).

---

## 6) Sign-off

| Role | Tester | Date | Build / commit | Notes |
|------|--------|------|----------------|-------|
| Coach | | | | |
| Client | | | | |
| Personal | | | | |

**Definition of done (strict):** every **non-N/A** row in sections 1–5 for your release scope is **Pass**, or **Fail** with a linked ticket.
