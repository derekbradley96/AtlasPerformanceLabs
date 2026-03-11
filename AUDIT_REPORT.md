# Atlas Performance Labs – Bulletproof Audit Report

**Date:** 2025-03  
**Scope:** Full repo (Capacitor + React Router + Supabase). Stability, wiring, security, production readiness.

---

## Full engineering + UX audit (latest)

### Red flags found (with file paths and why)

| Severity | Issue | File(s) | Why it matters |
|----------|--------|---------|----------------|
| **High** | Entry route `hasRole` omitted `personal` | `src/App.jsx` | Users with legacy or internal role `personal` (athlete) would fail `hasRole` and see RoleSelect instead of app. |
| **Medium** | `VALID_COACH_FOCUS` duplicated | `src/App.jsx`, `src/lib/data/coachProfileRepo.js` | Two sources of truth; drift risk for coach_focus validation and onboarding redirect. |
| **Medium** | `coach_focus` comparison case-sensitive in coachProfileRepo | `src/lib/data/coachProfileRepo.js` | DB could return mixed case; `includes(profile.coach_focus)` could fail. |
| **Low** | Profile.jsx dev role switch uses `user_type` (trainer/solo/client) | `src/pages/Profile.jsx` | Invokes `user-update-role` with internal names; backend must map to DB `coach`/`athlete` or profile could be inconsistent. |
| **Info** | Supabase table names | — | Confirmed: app uses **message_threads** and **message_messages** only; no `public.messages`. Migrations and code aligned. |
| **Info** | RLS | `supabase/migrations/` | clients: `trainer_id = auth.uid()`; message_threads/message_messages: coach_id = auth.uid(). Correct. |

### Fixes applied (this audit pass)

1. **Entry hasRole** – Added `role === 'personal'` so athletes with internal role `personal` are treated as having a valid role and are routed to the app (e.g. `/home` → SoloDashboard). **File:** `src/App.jsx`.
2. **Single source for VALID_COACH_FOCUS** – Exported `VALID_COACH_FOCUS` from `src/lib/coachFocus.js`; removed duplicate from `src/App.jsx` and `src/lib/data/coachProfileRepo.js`; both now import from `coachFocus.js`.
3. **coach_focus comparison** – In `hasCoachTypeSet` and `getCoachType`, normalize `profile.coach_focus` with `.toString().trim().toLowerCase()` before `VALID_COACH_FOCUS.includes()`. **File:** `src/lib/data/coachProfileRepo.js`.
4. **DATA_CONTRACTS.md** – Added at project root: documents `profiles.role` and `coach_focus` allowed values, message tables (`message_threads`, `message_messages`), clients table and RLS, and that no `public.messages` is used.

### Remaining recommendations

- **Profile.jsx role switch** – If `user-update-role` is used, ensure the backend maps internal role (`trainer`/`solo`/`client`) to DB `coach`/`athlete`/`client` when writing `profiles.role`. Otherwise document as dev-only and do not use in production.
- **Unread counts** – Messaging currently returns `unread_count: 0`; add backend support and wire when ready.
- **reply_to_id** – Add column to `message_messages` and wire in sendMessage if reply threading is required.
- **Consistent use of roles.js** – Prefer `isCoach(role)`, `isAthlete(role)`, `isClient(role)` from `src/lib/roles.js` over raw `role === 'trainer'` where appropriate to keep a single vocabulary.

### QA checklist (iOS / Android / Web)

- [ ] **All roles:** Sign in as Coach → see coach dashboard; sign in as Athlete (or sign up Personal) → see athlete/solo flow; sign in as Client → see client dashboard. No RoleSelect after auth.
- [ ] **Athlete signup:** Sign up with Account type “Athlete” → in Supabase `profiles.role` = `athlete` (never `trainer`).
- [ ] **Coach signup:** Sign up with Account type “Coach” + coaching focus → `profiles.role` = `coach`, `profiles.coach_focus` in `transformation`|`competition`|`integrated`.
- [ ] **Navigation:** Coach: Home, Clients, Messages, More. Athlete: Home, Messages, More (no Clients). Client: appropriate dashboard and Messages. Back from detail screens returns to list; no infinite loop.
- [ ] **Messages:** List loads; open thread; send text; swipe row → Delete does not open thread; long-press bubble → custom action sheet (no iOS callout).
- [ ] **Coach focus:** Transformation: Comp Prep hidden in More. Competition/Integrated: Comp Prep visible.
- [ ] **iOS:** Keyboard opens; composer flush to keyboard; no accessory bar; safe area respected.
- [ ] **Android:** Same as iOS for composer and safe area.
- [ ] **Web:** Build and preview; no console errors; role-based redirects work.
- [ ] **Production build:** Role switcher (“View as”) not visible; `node scripts/doctor.js` passes.

---

## ROLE COVERAGE (hard constraint)

Every feature, route, and UI state must work correctly **per role**. For every finding and fix:

1. **Which roles are affected** – Coach (trainer), Client, Athlete (solo/personal), Admin/testing, or coach_focus variants.
2. **Which roles were tested** – Explicitly state which role(s) the fix was validated under.
3. **Expected behavior per role** – What each role should see or be blocked from.

**Gating rules:**

- **coach_focus** must never leak Competition Prep UI into Transformation-only focus (`shouldShowModule(coachFocus, 'comp_prep')` used on More, ReviewCenter, CompPrep routes).
- **Role gating** must never show Coach-only pages to Client or Athlete (`RequireAuthAndRole role="trainer"` on clients, review, programs, etc.).
- **View as (testing)** must never ship enabled in production: `canUseRoleSwitcher` is now `isDev && (user?.email === ADMIN_EMAIL)` so the role switcher is hidden in prod builds.

---

## Roles enumerated

| Role | Source | Notes |
|------|--------|------|
| **Coach (trainer)** | `profile.role` / Supabase `profiles.role` | Full coach flows: clients, messages, review center, programs, comp prep (if focus allows). |
| **Client** | `profile.role === 'client'` | Client dashboard, my program, check-ins, messaging, find trainer. No coach routes. |
| **Athlete / Personal (solo)** | `profile.role === 'solo'` or `'personal'` | Solo dashboard, workouts, progress; no clients/review. |
| **Admin / testing** | `role === 'admin'` (DEV) or `user?.email === ADMIN_EMAIL` | Admin bypass for auth; role switcher only in DEV. |
| **coach_focus variants** | `profile.coach_focus`: `transformation` \| `competition` \| `integrated` | Transformation: no Comp Prep. Competition/Integrated: Comp Prep visible. |

---

## Role matrix (screens × roles)

| Screen / Route | Coach | Client | Athlete (solo) | Admin/testing |
|----------------|-------|--------|----------------|----------------|
| `/home` | Allowed (TrainerDashboard) | Redirect/Home → client-dashboard | Allowed (SoloDashboard) | Allowed (bypass) |
| `/client-dashboard` | Hidden (role guard) | Allowed | Hidden | Allowed if impersonating client |
| `/solo-dashboard` | Hidden | Hidden | Allowed | Allowed if impersonating solo |
| `/clients`, `/clients/:id` | Allowed | **Hidden** (RequireAuthAndRole) | **Hidden** | Allowed (bypass) |
| `/messages`, `/messages/:clientId` | Allowed | Allowed | Allowed | Allowed |
| `/review-center`, `/review-global`, `/review/:type/:id` | Allowed | **Hidden** | **Hidden** | Allowed |
| `/inbox`, `/closeout`, `/briefing` | Allowed | **Hidden** | **Hidden** | Allowed |
| `/programs`, `/programbuilder`, `/earnings`, `/leads`, etc. | Allowed | **Hidden** | **Hidden** | Allowed |
| `/comp-prep/*` | Allowed only if `shouldShowModule(coachFocus, 'comp_prep')` | **Hidden** | **Hidden** | Allowed |
| `/myprogram`, `/workout`, `/progress`, `/clientcheckin` | Hidden (nav) | Allowed | Allowed (solo) | By effectiveRole |
| `/more` (Profile/Account) | Allowed; Comp Prep row gated by coach_focus | Allowed | Allowed | Allowed; role switcher **DEV only** |
| `/admin-dev-panel`, `/navigation-audit` | **DEV only** (Navigate to `/` in prod) | **DEV only** | **DEV only** | **DEV only** |

---

## Implementation order (step 0 done first)

**0) Role map + route map + guards audit**

- **Where role is stored:** `profile.role` from Supabase `profiles` (trainer | client | solo | personal); `effectiveRole` in AuthContext (role or admin impersonation); `profile.coach_focus` (transformation | competition | integrated).
- **Guard utilities:** `RequireAuthAndRole` (role="trainer" | "client" | "solo"), `RequireCompPrepAccess` (coach_focus allows comp prep), `RequireCoachOwner` (account owner only). Coach-only routes wrap with `<RequireAuthAndRole role="trainer">`.
- **Protected routes:** All `/clients/*`, `/review-center`, `/review-global`, `/programs`, `/inbox`, etc. use `RequireAuthAndRole role="trainer"`. `/admin-dev-panel` and `/navigation-audit` use `import.meta.env.DEV ? <Component /> : <Navigate to="/" replace />`.
- **Role switcher:** `canUseRoleSwitcher = isDev && (user?.email === ADMIN_EMAIL)` and `setRoleOverride` gated with `isDev` so "View as (testing)" never ships in production.

Then proceed with the original critical fixes (ConfirmDialog, console guards, etc.).

---

## 1. Findings by Severity

### Critical

| # | What's wrong | Roles affected | Repro | Affected files | Fix plan |
|---|--------------|----------------|-------|----------------|-----------|
| C1 | **window.confirm in production** – ReviewDetail and CheckinReview use `window.confirm('Send message to client...')` instead of app ConfirmDialog; inconsistent UX and breaks in some WebViews. | Coach only (trainer review flows) | Open review item, add feedback, tap send. | `src/pages/ReviewDetail.jsx`, `src/pages/CheckinReview.jsx` | Replace with ConfirmDialog; same pattern as Messages delete. |
| C2 | **Unconditional console.log in main.jsx** – Boot log runs in production. | All roles | Load app in prod build. | `src/main.jsx` | Guard with `import.meta.env.DEV` or remove. |
| C3 | **console.log without DEV guard** – ClientDetail line 342 logs loaded payload in all envs. | Coach only | Open any client detail. | `src/pages/ClientDetail.jsx` | Wrap in `if (import.meta.env.DEV)`. |
| C4 | **Role switcher (View as) in production** – `canUseRoleSwitcher` was true for ADMIN_EMAIL in prod; testing UI must never ship. | Admin/testing only | Log in as admin in prod build; More showed "Developer tools (testing)". | `src/lib/AuthContext.jsx` | Set `canUseRoleSwitcher = isDev && (user?.email === ADMIN_EMAIL)`; gate setRoleOverride with isDev. |

### High

| # | What's wrong | Roles affected | Repro | Affected files | Fix plan |
|---|--------------|----------------|-------|----------------|-----------|
| H1 | **window.confirm for destructive actions** – IntakeTemplatesList and Team use `window.confirm` for delete/remove. | Coach only | Delete template; remove team member. | `src/pages/intake/IntakeTemplatesList.jsx`, `src/pages/team/Team.jsx` | Use ConfirmDialog for consistency and safe-area. |
| H2 | **Supabase console.log in production** – supabaseStripeApi.js logs VITE_SUPABASE_URL and functions base. | All roles (Supabase users) | Load app with Supabase configured. | `src/lib/supabaseStripeApi.js` | Guard with `import.meta.env.DEV`. |
| H3 | **useData console.log in production** – useData.ts logs isAuthed, trainerId on every use. | All roles | Navigate as authenticated user. | `src/data/useData.ts` | Already inside `if (import.meta.env.DEV)` – verify and leave as-is or remove. |
| H4 | **clientsService / checkInsService console.log** – Multiple logs in data layer. | Coach (clients/check-ins) | List clients or check-ins. | `src/data/clientsService.ts`, `src/data/checkInsService.ts` | Guard all with `import.meta.env?.DEV`. |

### Medium

| # | What's wrong | Roles affected | Repro | Affected files | Fix plan |
|---|--------------|----------------|-------|----------------|-----------|
| M1 | **createPageUrl('ClientDetail') + ?id=** – NutritionBuilder and ClientAttentionCard navigate to `/clientdetail?id=`. App has RedirectClientDetail to `/clients/:id`; ensure redirect reads `id` and pushes. | Coach only | Navigate from Nutrition plan or Intelligence card to client. | `src/App.jsx` (RedirectClientDetail), `src/pages/NutritionBuilder.jsx`, `src/components/intelligence/ClientAttentionCard.jsx` | Verify RedirectClientDetail uses searchParams.get('id') and navigate('/clients/' + id). |
| M2 | **ErrorBoundary console.log** – Copies crash JSON to console for writeCrashLog.mjs; useful in dev but verbose in prod. | All roles | Trigger a crash. | `src/components/ErrorBoundary.jsx` | Guard with `import.meta.env.DEV` or reduce to console.error once. |
| M3 | **Messaging: getUnreadMessageCountTotal** – useData exposes it; repo may not implement for Supabase (unread_count 0). | Coach (Messages tab badge) | Trainer shell badge on Messages tab. | `src/data/useData.ts`, `src/lib/repo/index.js`, messagingService | Document that unread is 0 until backend supports it; no crash. |
| M4 | **Duplicate MessageActionSheet** – One in `components/app/MessageActionSheet.jsx` (old), one in `components/messages/MessageActionSheet.jsx` (premium). ChatThread uses messages/. | Coach, Client (messaging) | N/A | `src/components/app/MessageActionSheet.jsx` | Keep app/ for any other consumers or remove if unused; document. |

### Low

| # | What's wrong | Roles affected | Repro | Affected files | Fix plan |
|---|--------------|----------------|-------|----------------|-----------|
| L1 | **TODO/FIXME scatter** – Various TODOs in messaging (canDeleteForEveryone, reply_to_id backend). | Coach, Client (messaging) | Code search. | `src/pages/ChatThread.jsx`, `src/lib/messaging/messageStore.js` | Add AUDIT_REPORT "Next Sprint" and leave code TODOs. |
| L2 | **routeMeta ROUTE_TITLES** – Some paths like `/clientdetail` exist; actual route is `/clientdetail` (redirect). | All roles (redirect) | Title for redirect route. | `src/lib/routeMeta.js` | No change; redirect route shows "Client" when resolved. |
| L3 | **GeneralDashboard window.location.href** – Uses `window.location.href = createPageUrl('MyProgram')` instead of navigate. | Client / Athlete | Click from general dashboard. | `src/components/dashboards/GeneralDashboard.jsx` | Prefer navigate() for SPA; low priority. |

---

## 2. What Was Already in Good Shape

- **Routes** – message_threads and message_messages exist in Supabase migrations; RLS enabled; no `public.messages` stub.
- **Messaging** – supabaseMessaging.js uses message_threads / message_messages; messagingService normalizes body/created_date; listMessages/sendMessage/deleteThread wired.
- **Navigation** – handleBack in AppShell uses location.state?.from and path-based fallbacks (messages → /messages, clients → /clients); RedirectClientDetail for /clientdetail?id=.
- **SwipeRow** – ignoreNextClickRef and guard in Messages handleRow (openRowId === clientId) prevent swipe-delete from opening chat.
- **Keyboard / safe-area** – useKeyboardInset hook; composer fixed with translateY(-keyboardInset); paddingBottom on message list.
- **Theme** – tokens use Atlas blue; no teal/cyan in critical paths (only comments in VoiceNoteComposer/AudioBubble).
- **Auth** – Boot timeout 20s; profile load error toast; no secrets in repo (env vars).

---

## 3. Quick Wins (Top 10)

1. **Replace window.confirm with ConfirmDialog** in ReviewDetail and CheckinReview (send feedback).
2. **Guard main.jsx console.log** with DEV so prod stays quiet.
3. **Guard ClientDetail console.log** (line 342) with import.meta.env.DEV.
4. **Replace window.confirm with ConfirmDialog** in IntakeTemplatesList (delete template) and Team (remove member).
5. **Guard supabaseStripeApi.js console.log** with DEV.
6. **Guard clientsService/checkInsService console.log** with import.meta.env?.DEV.
7. **Add scripts/doctor.js** – run lint, typecheck, build, and grep for public.messages, window.confirm, console.log in src (outside DEV), hardcoded hex, TODO/FIXME.
8. **Verify RedirectClientDetail** – reads ?id= and navigates to /clients/:id.
9. **ErrorBoundary** – guard verbose console.log with DEV.
10. **QA_CHECKLIST** – add “Message action sheet” and “Swipe delete does not open chat” if not already there.

---

## 4. Next Sprint (Larger Refactors)

- **Unread counts** – Backend support for message read state; then wire getUnreadMessageCountTotal to real data.
- **reply_to_id** – Persist in Supabase message_messages (add column + migration) and wire sendMessage.
- **Single MessageActionSheet** – Deprecate app/ version if unused; use messages/ everywhere.
- **GeneralDashboard** – Use navigate() instead of window.location.href for in-app links.
- **Centralize createPageUrl** – Ensure all links use it and document pageKey → path mapping (routeInventory/routeMeta).

---

## 5. Fixes Applied (This Pass)

- **C1** – Replaced `window.confirm` with `ConfirmDialog` in ReviewDetail and CheckinReview ("Send message to client with your feedback?"). Added state and confirm/cancel handlers; dialog title "Send message to client?", confirm "Send", cancel "Skip". **Roles:** Coach only (review flows).
- **C2** – Guarded boot `console.log` in `src/main.jsx` with `import.meta.env.DEV`. **Roles:** All.
- **C3** – Wrapped ClientDetail loaded-payload `console.log` in `if (import.meta.env.DEV)`. **Roles:** Coach only.
- **C4** – Role switcher (View as) dev-only: `canUseRoleSwitcher = isDev && (user?.email === ADMIN_EMAIL)` and `setRoleOverride` gated with `isDev` in `src/lib/AuthContext.jsx`. Role switcher card on More is never shown in production. **Roles:** Admin/testing only.
- **H1** – Replaced `window.confirm` with `ConfirmDialog` in IntakeTemplatesList (delete template) and Team (remove team member). Added deleteConfirmOpen/templateIdToDelete and removeConfirmOpen/memberIdToRemove state and handlers. **Roles:** Coach only.
- **H2** – supabaseStripeApi.js already guards Supabase URL logs with `import.meta.env?.DEV`; no change.
- **Scripts** – Added `scripts/doctor.js`: runs lint, typecheck, test:unit, build, and grep scan for public.messages, window.confirm, unconditional console.log, hardcoded hex, TODO/FIXME, **plus role-safety** (dev-only routes, role-switcher in prod). Package.json: `"doctor": "node scripts/doctor.js"`.
- **RedirectClientDetail** – Verified: uses useSearchParams.get('id') and Navigate to `/clients/${id}`; no change needed.
- **ReviewDetail hooks** – Moved `handleSendFeedbackConfirm` and `handleSendFeedbackCancel` useCallbacks above all early returns to satisfy React hooks rules.

---

## 6. UI/UX quality bar (enforced while fixing)

- **Consistent header layout and spacing** across Coach, Client, Athlete shells (TopBar / route titles).
- **Consistent bottom nav** – no duplicate tab bars; single BottomNavPremium with role-appropriate tabs.
- **Consistent empty states, skeletons, error toasts** – EmptyState, Skeleton, ConfirmDialog, Toast used across all roles where applicable.
- **Consistent primary action styling** – same button tokens (primary, danger) per role.
- **Consistent keyboard behavior** – messaging and forms (iOS/Android/Web) use same composer/keyboard handling.
- **No teal / single accent** – Atlas blue only; no teal/cyan in any role shell.

---

## 7. What to Test Now (by role)

**All roles**

- Build and doctor: `npm run build`, `node scripts/doctor.js` (role-safety checks pass in prod build).
- Back button: From detail screens, back goes to list; no loop (test as Coach and as Client).

**Coach**

1. Clients → Client Detail → Message → send message; back to Messages list.
2. Messages: swipe row → Delete → ConfirmDialog; tap row (not Delete) opens chat.
3. Long-press bubble → action sheet (Copy, Reply, Delete); no iOS callout.
4. **Copy** – From message action sheet tap Copy → toast “Copied”; paste elsewhere to verify.
5. Intake template delete, Team remove: ConfirmDialog flows.
6. Transformation focus: Comp Prep row in More hidden; Competition/Integrated: Comp Prep visible.
7. Direct URL `/clients/xyz` as Coach: allowed; as Client (if ever reached): AccessDenied.

**Client**

8. Client dashboard and Messages: can open threads, send messages; no Coach-only nav items.
9. More: no "Developer tools (testing)" in production build; no Coach-only rows.

**Athlete (solo)**

10. Solo dashboard; no Clients / Review Center; messaging if available same as Client.

**Admin / testing (DEV only)**

11. In DEV: More shows "Developer tools (testing)" for ADMIN_EMAIL; switch role → view as Client/Solo; in production build the card is hidden.
12. `/admin-dev-panel` and `/navigation-audit`: in prod redirect to `/`.

**Platform testing (iOS / Android / Web)**

- **Web:** `npm run build` then `npm run preview` (or `npm run start`). Run the “What to test now” steps above in Chrome; verify back button, Messages, ConfirmDialogs, role switcher (DEV only), and no Coach routes as Client.
- **iOS:** `npm run cap:sync` then open in Xcode and run on simulator or device. Test safe areas, keyboard (composer above keyboard), long-press action sheet (no system callout), and role-based flows. Use DEV build to verify role switcher on More; production build must not show it.
- **Android:** Same as iOS via `npm run android`. Confirm back behavior, Messages swipe/delete, and keyboard behavior.
- For each platform, run the role-specific checks (Coach 1–7, Client 8–9, Athlete 10, Admin 11–12) where applicable.
