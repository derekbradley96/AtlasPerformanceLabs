# Atlas hardening pass report

**Date:** 2026-04-09  
**Scope:** Tooling + high-risk fixes + release discipline. Full end-to-end UI audit of every listed surface was **not** completed in a single pass; remaining items are called out explicitly.

---

## 1. HIGH-RISK ISSUES FOUND

### Auth
| Issue | Severity | Status |
|-------|-----------|--------|
| Stale / overlapping auth states | Unknown without live E2E | **Not fully audited** — use `docs/RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md` + manual auth resume checks |

### Payments (coach-offer / `pending_payment`)
| Issue | Severity | Status |
|-------|-----------|--------|
| Route leakage for unpaid clients | Medium | **Mitigated in code** — `RequireClientCoachOfferSettled` + `clientPendingPaymentAccess.js`; unit tests pass |
| Stripe return vs webhook timing | Medium | **Not E2E-verified** — polling + “Check payment status” in `ClientOnboardingFlow.jsx`; staging required |

### Messaging
| Issue | Severity | Status |
|-------|-----------|--------|
| **`db push` failed:** `operator does not exist: text = message_sender_role` (SQLSTATE 42883) on `message_messages_insert` | **P0** | **Fixed** — `sender_role::text = 'coach' \| 'client'` in `20260409180000_messaging_participant_rls_read_receipts.sql`. **Re-run** `npx supabase db push --include-all` on staging/prod after pull. |
| Thread id vs client id in send paths | High | **Previously fixed** — `ClientDetail` summary-to-chat uses thread id + `openOrCreateThread` fallback |

### Role / tier leakage
| Issue | Severity | Status |
|-------|-----------|--------|
| Transformation coach seeing comp-prep briefing noise | Medium | **Addressed earlier** — `Briefing.jsx` filters peak week row + prep-only priority types when `!hasCompetitionPrep` |
| Personal Basic vs Enhanced auto-program | Low | **Covered by tests** — `autoProgramBuilder.test.js` asserts Basic does not auto-generate Enhanced-only starter |

### Route leakage
| Issue | Severity | Status |
|-------|-----------|--------|
| Pending payment paths | Medium | **Tests** — `isPathAllowedForPendingPaymentClient` / commerce helpers |
| `/messages` while pending | By design | **`ALLOW_CLIENT_MESSAGING_WHILE_PENDING_PAYMENT === false`** — blocked to onboarding |

---

## 2. UI / UX ISSUES FOUND (THIS PASS)

| Issue | Location | Status |
|-------|-----------|--------|
| Conditional hooks (runtime crash risk) | `ImportClientsPage.jsx` | **Fixed** — all `useState` before early `Navigate` return |
| Dead / noisy imports | `More.jsx` (`Building`, `Pill`) | **Fixed** — removed unused lucide imports |
| Duplicate sections / shell drift across Personal–Coach–Client | Many large pages | **Not systematically migrated** — requires screen-by-screen refactor per `atlas-ui` / `PageShell` patterns |

---

## 3. FIXES IMPLEMENTED (GROUPED)

### Database / messaging
- **`supabase/migrations/20260409180000_messaging_participant_rls_read_receipts.sql`:** `message_messages_insert` policy uses `sender_role::text` comparisons so `db push` succeeds on Postgres that types `WITH CHECK` as text vs enum.

### App code quality
- **`src/pages/ImportClientsPage.jsx`:** Hooks unconditionally at top of component (eslint `react-hooks/rules-of-hooks`).
- **`src/pages/More.jsx`:** Removed unused `Building`, `Pill` imports.
- **`src/data/repos/atlasRepo.ts`:** `invokeSupabaseFunction` error handling — `error` cast via `unknown` before `instanceof` (fixes `tsc` TS2358).

### Release / QA discipline
- **`package.json`:** `release:gate:ci` = `lint` + `typecheck` + `build` + full `vitest run`.
- **`docs/RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md`:** SQLSTATE 42883 troubleshooting + terminal “merged command” warning.

---

## 4. QA RESULTS (AUTOMATED)

| Gate | Result |
|------|--------|
| `npm run lint` | **Pass** |
| `npm run typecheck` | **Pass** |
| `npm run build` | **Pass** |
| `npm run test -- --run` | **Pass** (29 files, 176 tests) |
| `npm run release:gate:ci` | **Pass** |
| `npm run release:gate:messaging-payment` | **Pass** (migration check + payment/commerce unit tests) |

**Manual QA (web + app smoke, Stripe, dual-user messaging):** **Not run in CI** — required per `docs/RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md`.

---

## 5. REMAINING BLOCKERS

### Must-fix before production messaging + payment confidence
1. **Apply fixed migration** to staging, then production: `npx supabase db push --include-all` after pulling this repo state.
2. **Staging E2E:** coach ↔ client messaging (C-section of release gate) + unpaid/paid client payment (D/E sections).

### Should-fix soon
- Systematic **shell audit** (website vs app) for remaining stretched-mobile or dense-desktop layouts.
- **Consolidate** duplicate cards on Coach Home / Client Detail / Marketplace using shared layout primitives.

### Low-priority cleanup
- Node **v25** vs Vercel CLI **EBADENGINE** warnings — consider Node 22 LTS for local dev to match tooling expectations.
- `zsh: permission denied: /Users/derekbradley` in old terminal log — stray paste/path; not a repo bug.

---

## 6. RECOMMENDED NEXT ORDER (TOP 5)

1. **Run `db push`** with fixed messaging migration on staging; verify `message_messages_insert` exists and inserts work as coach + client.
2. **Execute** manual checklist in `docs/RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md` (sections C–E).
3. **Pick one vertical** (e.g. Personal Home + Today) for **shell + component consolidation** using `atlas-ui` / `PageShell` — avoid boiling the ocean.
4. **Playwright or Maestro** (optional): automate unpaid-client redirect + one messaging send — highest ROI automated tests.
5. **Audit** `getDailyBriefing` consumers — ensure no other surface shows peak/prep counts to transformation-only coaches without the same filter as Briefing UI.

---

## 7. Product hardening pass (Phase 1 kickoff)

**Source of truth:** this file + `docs/RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md` + `docs/SCREEN_MIGRATION_CHECKLIST.md`.

| Item | Status |
|------|--------|
| Messaging migration apply (remote) | **Operator action** — run `npx supabase db push --include-all` after pull; CI cannot verify Supabase from repo |
| Messaging smoke QA | **Manual** — section C of release gate; log results in `docs/STAGING_PROOF_MESSAGING_PAYMENT.md` |
| Payment gate edge paths | **Expanded unit tests** in `clientPendingPaymentAccess.test.js` (`/client`, `/client/today`, trailing slash, settings paths); staging log same doc |
| Phase 1 screen migration | `ReviewCenter.jsx` + **`ReviewCenterQueuePage.jsx`** aligned (`PageShell`, `PageHeader`, `hasCompetitionPrep` gating, merged queue refetch); **`PersonalOnboardingTierPage.jsx`** migration attrs |
| Release gate green | Run `npm run release:gate:ci` after each meaningful change |

---

## Commands reference

```bash
# Full CI gate (lint, types, build, tests)
npm run release:gate:ci

# Messaging + payment policy unit gate
npm run release:gate:messaging-payment

# Before remote DB apply
npm run db:check-migrations
```
