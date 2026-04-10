# Personal Basic — acceptance checklist (P1.1)

Use this before calling **Personal Basic** “done” for a release. Run on **website shell** and **app shell** (Vite + Capacitor). Personal **Enhanced** checks are out of scope here except where Basic must not show Enhanced-only affordances.

**Related:** [`ATLAS_PRODUCT_ROADMAP.md`](./ATLAS_PRODUCT_ROADMAP.md), [`personalPlanAccess`](../src/lib/personalPlanAccess.js), Screen Gate in [`SCREEN_MIGRATION_CHECKLIST.md`](./SCREEN_MIGRATION_CHECKLIST.md).

---

## Preconditions

- [ ] Account is **Personal** role, **Basic** tier (not Enhanced): program builder / upgrade prompts should match `personalPlanAccess` gates.
- [ ] Signed-in session stable (no infinite redirects).

---

## Core loop (routes)

| Area | Path / entry | Pass criteria |
|------|----------------|---------------|
| **Home / dashboard** | `/home` (General dashboard) | Loads without error; primary action is obvious; no Enhanced-only builder claims on Basic. |
| **Today** | `/today` | Session card + fuel/readiness rows; Basic copy where tier applies; no duplicate primary CTAs. |
| **Nutrition** | `/nutrition` | Targets or onboarding to targets; logging path works; goal-aware copy where implemented. |
| **Progress** | `/progress` | Personal branch renders; empty vs data states sensible; migration `data-atlas-*` on root if QA automation expects it. |
| **Program (self-serve)** | `/program-builder` or entry from Today | Basic: edit/create path matches product intent; Enhanced-only controls hidden or lead to upgrade, not broken states. |

---

## Tier & conversion (Basic user)

- [ ] **Find a coach / tier** flows do not show Enhanced features as unlocked.
- [ ] Deep links to **`/personal/coach-tier-selection`** (when used) then discover — no dead end (see roadmap / marketplace docs).

---

## Shell

- [ ] **Web:** layout uses horizontal space; no stretched-mobile-only layout on desktop where a split or wider column is expected.
- [ ] **App:** safe areas respected; primary actions reachable; sticky patterns where the screen already uses them.

---

## Sign-off

| Role | Name | Date | Web | App |
|------|------|------|-----|-----|
| Owner | | | ☐ | ☐ |

**Failures:** file issues as state-model or shared-module fixes, not one-off hacks per the Atlas rule book.
