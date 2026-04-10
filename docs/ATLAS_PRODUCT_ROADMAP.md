# Atlas — lane-based product roadmap

This document is the **single planning spine** for Atlas development. It aligns **roles** (Personal, Coach, Client) with **platform quality** work, and maps to **delivery phases** without mixing unrelated lanes.

**Related:** [`SCREEN_MIGRATION_CHECKLIST.md`](./SCREEN_MIGRATION_CHECKLIST.md) (screen state + `data-atlas-*` contract), [`src/lib/atlasMigrationPhases.js`](../src/lib/atlasMigrationPhases.js), [`RELEASE_GATE_ONBOARDING.md`](./RELEASE_GATE_ONBOARDING.md), [`PERSONAL_BASIC_ACCEPTANCE.md`](./PERSONAL_BASIC_ACCEPTANCE.md) (P1.1 manual gate).

---

## Working rules (non-negotiable)

1. **Lanes are sequential at the milestone level** — finish a **lane milestone** before starting the next in the same phase, unless a Platform task unblocks everyone (e.g. lint/build).
2. **No random lane-hopping** — e.g. do not build Coach marketplace copy while Personal Basic acceptance criteria are undefined.
3. **Every major screen** uses: explicit **state derivation** (Atlas / domain engines), **shared components + tokens**, and the **migration checklist** (`data-atlas-migration-phase` / `data-atlas-primary-state` where applicable).
4. **Shared systems stay unified** — one engine, role wrappers (Personal / Client / Coach); Personal → Client translation where the workflow is shared (Law 4).
5. **Both shells** — website and app shells are first-class; do not ship one shell “later.”

---

## Lanes

| Lane | Scope |
|------|--------|
| **1. Personal** | Personal Basic + Personal Enhanced; solo training, nutrition, progress, program builder (self-serve), tier upgrades |
| **2. Coach** | Review Center, check-in review, client OS / Client Detail, program builder (coach), marketplace listing + profile |
| **3. Client** | Parity with Personal for shared workflows; coach-directed copy; messaging, check-ins, plan execution |
| **4. Platform** | QA gates, automated tests, lint/typecheck, CI, native (Capacitor) readiness, release process |

---

## Phases (priority order)

### PHASE 1 — Personal foundation

**Goal:** A coherent, shippable Personal product with clear Basic vs Enhanced boundaries and goal-aware behaviour.

| Milestone | Lane | Done when |
|-----------|------|-----------|
| P1.1 Personal Basic complete | Personal | [`PERSONAL_BASIC_ACCEPTANCE.md`](./PERSONAL_BASIC_ACCEPTANCE.md) passes on web + app; Basic gating consistent (`personalPlanAccess` / tier) |
| P1.2 Personal Enhanced complete | Personal | Enhanced-only features gated; upgrade paths tested on web + app |
| P1.3 Goal-aware behaviour locked | Personal | Nutrition/training/adaptation interpretations use goal context (shared modules, not one-off UI) |
| P1.4 Onboarding + tier selection | Personal + Platform | [`RELEASE_GATE_ONBOARDING.md`](./RELEASE_GATE_ONBOARDING.md) Personal-related checks; tier → discover handoff consistent |
| P1.5 Personal QA | Platform | Scripted Personal QA pass (see repo `docs/*QA*`); no P1 regressions |

### PHASE 2 — Coach workflow + conversion

**Goal:** Coaches can run daily workflow and conversion (marketplace → profile) reliably.

| Milestone | Lane | Done when |
|-----------|------|-----------|
| P2.1 Review Center | Coach | Hub, global review, unified queue, check-ins list, per-client `ReviewCenter` — migration attrs + shared derivers in `atlasMigrationPhases.js` |
| P2.2 Check-in Review | Coach | `CheckInReviewDecisionWorkspace` desktop + app; shared prep inputs |
| P2.3 Client Detail / OS | Coach | `ClientOperatingSystemLayout` + Client Detail sections state-driven |
| P2.4 Program Builder (coach) | Coach | Assign/edit flows; no duplicate program logic vs Personal engine |
| P2.5 Marketplace + Coach Profile | Coach | Discovery, cards, public profile; conversion analytics via shared helpers |

### PHASE 3 — Client alignment

**Goal:** Client experience matches Personal quality for shared workflows; coach ownership respected.

| Milestone | Lane | Done when |
|-----------|------|-----------|
| P3.1 Client ↔ Personal parity | Client | Nutrition, workouts, readiness, progress use shared engines + Client wrapper |
| P3.2 Client check-in flow | Client | Same quality bar as Personal check-in where workflow overlaps |
| P3.3 Client messaging | Client | Threads + notifications coherent with Coach |
| P3.4 Client plan execution | Client | Today / program / logging paths complete without dead ends |

### PHASE 4 — Ship quality + platform

**Goal:** Repeatable release, measurable risk reduction, native-ready builds.

| Milestone | Lane | Done when |
|-----------|------|-----------|
| P4.1 QA / release gate | Platform | Release checklist + onboarding gate green per deploy |
| P4.2 High-risk test coverage | Platform | Tests for shared engines (nutrition, adaptation, access, messaging contracts) |
| P4.3 Lint + typecheck discipline | Platform | `npm run lint` / `npm run typecheck` clean in CI (or explicit allowlist) |
| P4.4 Native readiness | Platform | `npm run build` + `cap sync`; smoke on iOS/Android for safe areas + navigation |

---

## Current progress (snapshot)

Evidence: `docs/SCREEN_MIGRATION_CHECKLIST.md` application logs, `src/lib/atlasMigrationPhases.js`, and core Personal/Coach modules.

| Phase | Area | Status (honest) |
|-------|------|------------------|
| **1** | Personal core loop (home/today/nutrition/progress) | **Partially migrated** — Atlas UI context + surface states in use; some branches still map-worthy |
| **1** | Basic vs Enhanced | **Implemented in product** — tier gating centralised (`personalPlanAccess`, program builder splits); needs ongoing QA |
| **1** | Onboarding / tier / discover | **Substantially wired** — tier selection → discover, migration attrs, release gate doc for onboarding |
| **2** | Review Center / check-in review | **In progress / structurally migrated** — workspace shared for shells; routing unification ongoing per checklist |
| **2** | Marketplace / profile / conversion | **In progress** — screen state + coach cards + profile CTA modes; analytics consolidation ongoing |
| **3** | Client parity | **Ongoing** — explicit in rule book; measure against shared engines per screen |
| **4** | Tests | **~67 Vitest tests** — strong for modules covered; not full-app coverage |
| **4** | Lint / typecheck | **Lint: green** (`npm run lint`); typecheck should stay green in CI |

---

## Next actionable tasks (top 5)

These follow **Phase 1 → Platform** order and respect **lane discipline**:

1. **Platform — keep lint green:** Run `npm run lint` before every merge; fix hooks-order issues immediately (see `ProfileAccountPage`, `ProgressPage`, `PublicCoachProfilePage`, `TodayPage` — hooks must be unconditional). Unused imports: `eslint --fix` when safe.
2. **Personal lane — P1.1 acceptance:** Run [`PERSONAL_BASIC_ACCEPTANCE.md`](./PERSONAL_BASIC_ACCEPTANCE.md) on **web + app**; log gaps only as state-map or shared-module tasks.
3. **Personal lane — P1.3 goal-aware audit:** Trace goal → interpretation in `src/lib/atlasInsights.js`, `src/lib/personalAdaptationLayer.js`, `src/lib/personalNutritionProfile.js`, `src/lib/nutritionInterpretation.js` (and UI only for copy); remove duplicate goal branching where you find it.
4. **Coach lane — P2.1 (remaining):** Review Center **migration attrs** are on hub, global review, unified queue, check-ins list, per-client `ReviewCenter`, check-in route shells + workspace — next is **narrative/branch cleanup** per checklist, not more `data-atlas-*` unless a route is missing.
5. **Platform — P4.2:** Add tests for **next highest-risk** shared module not yet covered (e.g. access gating, notification routing, or nutrition interpretation) — pick one module per sprint.

---

## Blockers & inconsistencies (known)

| Item | Severity | Notes |
|------|----------|--------|
| **SCREEN_MIGRATION “Phase” vs roadmap Phase** | Low | Checklist “Phase 1–4” = **core loop / conversion / onboarding / secondary**; **roadmap phases** = product milestones P1–P4. Use this doc for product phase; checklist for **screen migration** contract. |
| **Lint / typecheck drift** | Medium | Re-introduce unused imports or hooks-after-return in any PR; run `npm run lint` / `npm run typecheck` in CI or pre-release. |
| **Test breadth** | Medium | Unit tests cover key libs; E2E is largely manual (`docs/E2E_*`, QA docs). |
| **Client vs Personal parity** | Medium | Ongoing; use shared engines first, then Client wrapper copy/permissions. |

---

## Revision

Update this file when a **milestone** flips from open → done, or when **phase priority** changes (e.g. marketplace before Client parity).
