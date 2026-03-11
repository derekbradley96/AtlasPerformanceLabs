# Full Wiring + Robustness Audit (Trainer, Client, Solo)

## 1) Data layer audit

### Supabase tables/views referenced
| Reference | Schema | Notes |
|-----------|--------|--------|
| `profiles` | public.profiles | select/update; id, role, display_name, coach_type, coach_focus. OK. |
| `clients` | public.clients | select/insert/update/delete; trainer_id. RLS trainer_id = auth.uid(). OK. |
| `message_threads` | public.message_threads | coach_id, client_id. RLS coach_id = auth.uid(). OK. |
| `message_messages` | public.message_messages | thread_id, sender_role. RLS via thread ownership. OK. |
| `checkins` | public.checkins | supabaseCheckinsRepo. Assume RLS by trainer/client. |
| `v_client_master_dashboard` | view | phaseProgramRepo, useClientMasterDashboard. Verify view exists. |
| `client_phases`, `program_blocks`, `program_weeks`, `program_days`, `program_exercises` | public | phaseProgramRepo. |
| `nutrition_plans`, `nutrition_plan_weeks` | public | nutritionPlansService, NutritionEditorScreen. |

**Stale references:** None found. No `public.messages`; app uses `message_messages` + `message_threads`.

### Mutations – error handling + toast
- **AuthContext** signUp/profile update: returns `{ error }`; caller (AuthScreen) shows error. OK.
- **AuthContext** backfill coach_focus (useEffect): `supabase.from('profiles').update(...).then(...)` — no `.catch()`. **P2:** add catch and optional toast.
- **ClientDetail** (phase, program, remove client, etc.): toasts on success/error. OK.
- **Messages** deleteThread: try/catch + toast. OK.
- **ChatThread** sendMessage/sendVoice: catch + toast. OK.
- **Messages initial load:** `Promise.all([data.listClients(), data.listThreads()])` has **no .catch()** — on failure (e.g. RLS, network) state stays empty, no feedback. **P0:** add .catch and toast.
- **Profile** role switch: `invokeSupabaseFunction('user-update-role', ...)` in catch only `console.error` — **P0:** add toast.error so user sees failure.
- **RoleSelection** handleRoleSelect: has toast.error on catch. OK.

### Optimistic UI
- ChatThread: optimistic append on send; rollback on error via toast. Safe.
- Messages delete: confirm then delete then refresh; no optimistic remove. Safe.

---

## 2) Auth + profiles audit

- **Profile on signup:** No client-side insert into `profiles`; trigger expected to create row from `raw_user_meta_data.user_type` (and display_name, coach_focus). Ensure DB trigger exists and sets `profiles.role` from `user_type`.
- **Role consistency:** App canonical roles trainer/client/solo; AuthContext and roles.js use them; signUp sends `user_type` in options.data. OK.
- **Default role:** DEFAULT_ROLE = 'solo'; LOCAL_USER_FALLBACK = solo; setFakeSession fallback = 'solo'; empty profile patch = 'solo'. No default-to-trainer leaks found. OK.

---

## 3) RLS + security assumptions audit

- **clients:** RLS trainer_id = auth.uid(). UI (trainer only) lists/gets by trainerId = session.user.id. Matches. Client/solo never call listClients from a screen that would expose other clients; Messages calls listClients for trainer context (trainer sees their client list). When role is client, useData still uses trainerId = auth.uid() — so listClients(clientUserId) returns clients where trainer_id = clientUserId (empty). listThreads(clientUserId) returns threads where coach_id = clientUserId (empty). So **client on Messages sees empty lists** — by design until client-side thread list (threads where client_id = auth.uid()) is implemented. **P1:** Document or add RLS policy for client to SELECT message_threads WHERE client_id = auth.uid() and wire client thread list.
- **message_threads / message_messages:** RLS coach-only. No client SELECT policy. **P1:** Add client policy for threads where client_id = auth.uid() if client should see their conversations in Supabase.

---

## 4) Navigation + role guards audit

- **RequireAuthAndRole role="trainer":** All trainer-only routes wrapped. OK.
- **RequireRole / RequireAuth:** hasRole = trainer | client | solo. OK.
- **AccessDenied:** Uses `getDashboardPathForRole(role)` → /client-dashboard, /solo-dashboard. App EntryRoute sends client to /messages, solo to /home. **P0:** Use `roleHomePath(role)` from @/lib/roles so “Back to Dashboard” matches post-login behavior (client → /messages, solo → /home).
- **Deep links:** Direct /clients/123 as client/solo hits RequireAuthAndRole → AccessDenied. No blank/loop. OK.
- **PageNotFound:** Uses getDashboardPathForRole. **P2:** Prefer roleHomePath for consistency.

---

## 5) UI quality audit

- **Messages list swipe:** openRowId guard in handleRow; SwipeRow action buttons stopPropagation. Previous fixes in place. OK.
- **Tap targets:** No systematic 44px audit; ad-hoc. **P2:** Audit min height 44px on primary actions.
- **Empty states:** Messages, ReviewCenter, ClientDetail use EmptyState. OK.
- **Skeletons:** ClientDetail, Profile use SkeletonCard. OK.
- **Padding/safe area:** AppShell uses TAB_BAR_BOTTOM_PADDING and safe-area. **P2:** Spot-check padding consistency on key screens.

---

## 6) Performance audit

- **ClientDetail:** Many useMemo/useCallback; loadClientDetail in useEffect with cancel. loadNutrition in dependency array. No obvious infinite loop; deps look correct.
- **Messages:** loadData in useEffect deps [data, loadData, refreshKey]; loadData useCallback deps [data]. data from useData() may change identity → possible extra fetches. **P2:** Stabilize data reference or accept refetch on data change.
- **useData:** trainerId from useAuth(); callbacks depend on trainerId/effectiveDemoMode. No loop.
- **Expensive selectors in render:** threadList useMemo in Messages; ClientDetail checkInsList, programsListRaw, etc. useMemo. OK.

---

## Prioritized issue list

### P0 (fix now)
| # | Issue | File | Fix |
|---|--------|------|-----|
| 1 | Messages initial load has no .catch; users see empty list with no feedback on failure | src/pages/Messages.jsx | Add .catch() to Promise.all([listClients(), listThreads()]), toast.error on failure |
| 2 | Profile role switch failure only logged to console | src/pages/Profile.jsx | In catch of invokeSupabaseFunction('user-update-role'), add toast.error('Failed to switch role') |
| 3 | AccessDenied “Back to Dashboard” uses getDashboardPathForRole; should match EntryRoute (client→/messages, solo→/home) | src/components/AccessDenied.jsx | Use roleHomePath(role) from @/lib/roles instead of getDashboardPathForRole(role) |

### P1 (fix soon)
| # | Issue | File | Fix |
|---|--------|------|-----|
| 4 | Client role on Messages: listThreads/listClients use coach_id = auth.uid() so client sees empty list; no RLS for client_id = auth.uid() | supabase/migrations, src/data/messagingService.js | Add RLS policy SELECT on message_threads WHERE client_id = auth.uid(); add listThreadsForClient(clientId) and wire Messages when role is client |
| 5 | v_client_master_dashboard and phase/program tables: verify view exists and RLS allows trainer | supabase/migrations | Confirm view + RLS; add migration if missing |

### P2 (backlog)
| # | Issue | File | Fix |
|---|--------|------|-----|
| 6 | AuthContext backfill coach_focus update has no .catch | src/lib/AuthContext.jsx | Add .catch() to supabase.from('profiles').update(...).then(...) |
| 7 | PageNotFound uses getDashboardPathForRole | src/lib/PageNotFound.jsx | Use roleHomePath(role) for consistency |
| 8 | Tap targets < 44px audit | Various | Add minHeight: 44 / touchTargetMin to primary buttons |
| 9 | Messages loadData dependency on data may cause extra refetches | src/pages/Messages.jsx | Consider ref or stable data identity |

---

## P0 fixes applied (exact code changes)

1. **src/pages/Messages.jsx**  
   - In the `useEffect` that runs `Promise.all([data.listClients(), data.listThreads()])`: added `.catch((err) => { ... })` that sets clients/threads to `[]`, calls `toast.error('Failed to load conversations')`, and in DEV logs the error. Ensures load failures surface to the user.

2. **src/pages/Profile.jsx**  
   - Added `import { toast } from 'sonner';`.  
   - In the role-switch `catch` block: added `toast.error('Failed to switch role. Try again.');` so failed role updates are visible.

3. **src/components/AccessDenied.jsx**  
   - Replaced `import { getDashboardPathForRole } from '@/lib/routeInventory'` with `import { roleHomePath } from '@/lib/roles'`.  
   - Set `dashboardPath = role ? roleHomePath(role) : '/home'` so “Back to Dashboard” matches EntryRoute (client → /messages, solo → /home, trainer → /home).
