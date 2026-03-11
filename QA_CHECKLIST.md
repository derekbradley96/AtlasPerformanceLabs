# Atlas Performance Labs – QA Checklist

Use this checklist for manual QA on **iPhone**, **Android**, and **Web** before release.  
**Role coverage:** Run the relevant section for each role (Coach, Client, Athlete, Admin/testing in DEV only).

---

## Role matrix (quick reference)

| Area | Coach | Client | Athlete (solo) | Admin/testing |
|------|-------|--------|----------------|----------------|
| Home | Trainer dashboard | Client dashboard | Solo dashboard | By effectiveRole |
| Clients, Review, Programs | Allowed | Hidden | Hidden | Allowed (bypass) |
| Messages | Allowed | Allowed | Allowed | Allowed |
| Comp Prep (More + routes) | Only if coach_focus allows | Hidden | Hidden | DEV only |
| Role switcher (More) | — | — | — | **DEV only** (hidden in prod) |

---

## 1. Auth & onboarding

- [ ] **Login** – Email + password logs in; error message shows for invalid credentials.
- [ ] **Sign up** – Display name required (inline hint if empty); password ≥ 8 chars (inline hint); coach focus required for trainer; success toast and redirect.
- [ ] **Coach focus onboarding** – If trainer has no coach_focus, redirect to coach-type screen; saving updates profile and allows access to home.

---

## 2. Navigation & shell

- [ ] **Bottom nav** – Home, Clients, Review, Messages, More; active state (pill) correct; haptics on tap (native).
- [ ] **Back button** – From Client Detail → back to Clients; from Messages thread → back to Messages or previous screen (from state); no infinite loop between Client ↔ Messages.
- [ ] **Safe areas** – No content under notch/home indicator on iOS; bottom nav above safe area.

---

## 3. Clients

- [ ] **Clients list** – Loads; segments (All, Needs review, etc.) filter correctly; pull-to-refresh refetches list.
- [ ] **Client Detail** – Opens from list; Overview / Check-ins / Program tabs work; default tab is Overview.
- [ ] **Remove client** – “Remove client” link in Overview opens confirm dialog; Confirm removes client and navigates to Clients list; Cancel closes dialog; toast on success/error. **RLS:** As Coach A, try deleting Coach B's client (e.g. swap id in devtools); must fail.

---

## 4. Messages

- [ ] **Messages list** – Empty state when no threads; “New message” CTA opens client picker; list shows merged threads (sandbox + local); pull-to-refresh refetches.
- [ ] **New thread** – From Messages “New message” or Client Detail “Message”: pick client, thread opens; message persists (local or sandbox).
- [ ] **Chat thread** – Skeleton while loading; composer pinned to bottom; send disabled until text (or attachment); “Sending…” state; toast on send failure; keyboard pushes composer up (native).
- [ ] **Delete conversation** – Swipe delete on list row opens ConfirmDialog; Confirm removes from list; Cancel closes dialog.
- [ ] **Message action sheet** – Long-press on a bubble opens Atlas action sheet (Copy, Reply, Delete for me, Delete for everyone when allowed, Cancel); no iOS selection/callout.
- [ ] **Swipe delete vs tap** – Tapping Delete/Pin on a swiped row does not navigate into the chat; only tapping the row content opens the thread.

---

## 5. Review Center

- [ ] **Queue** – Loads; tabs (Active / Waiting / Done) and filter chips work; pull-to-refresh refetches queue; toast on load error.
- [ ] **Send feedback to client** – After marking reviewed, if feedback text is entered, ConfirmDialog “Send message to client?” appears; Send opens Messages with prefilled text; Skip goes to review center / checkins.
- [ ] **Comp Prep filter** – Only visible when coach focus allows; changing focus hides/shows correctly.
- [ ] **“Updated Xm ago”** – Shown; updates after refresh.

---

## 6. Home (Coach)

- [ ] **Briefing** – Loads; tiles reflect data; module gating (e.g. Comp Prep) respects coach focus.
- [ ] **Unread / payment** – Tapping unread message or payment overdue navigates to thread/client with correct `from` state for back.

---

## 7. Profile & Account

- [ ] **Profile** – Skeleton while loading auth; user info and actions visible.
- [ ] **Account – Coaching focus** – Selector updates Supabase profile; success toast; Home / More / Review Center reflect new focus (e.g. Comp Prep visibility).

---

## 8. Client Detail – modals & actions

- [ ] **Set Phase** – Opens; validation (phase, block length, start date); Cancel closes; Save updates phase and shows success toast; error toast on failure.
- [ ] **Health breakdown** – Full-screen modal; score, snapshot, trends, flags; actions: Adjust plan, Send summary, Request check-in, **Message client** (navigates to thread).
- [ ] **Contact / Call settings** – Save with validation; success/error toasts.

---

## 9. Empty states & errors

- [ ] **Check-ins** – EmptyState with icon and description when no check-ins.
- [ ] **Program** – EmptyState with “Create program” CTA when no program assigned.
- [ ] **Messages / Review / Clients** – Empty and error states show; toasts for load/save failures where added.

---

## 10. General

- [ ] **Network banner** – Offline banner appears when network is lost (if implemented).
- [ ] **No dead buttons** – Every primary action has a handler and feedback (toast or navigation).
- [ ] **Console** – No uncaught errors or warnings on critical paths (login, client list, messages, review).
- [ ] **Theme** – Atlas blue accent (no teal); dark navy background; consistent cards and spacing.

---

---

## 11. ConfirmDialog consistency (audit pass)

- [ ] **Intake template delete** – Delete template opens ConfirmDialog “Delete template?”; Confirm deletes and refreshes; Cancel closes.
- [ ] **Team remove member** – Remove opens ConfirmDialog “Remove team member?”; Confirm removes and refreshes; Cancel closes.

---

---

## 12. Coach flow QA (role-specific)

- [ ] **Coach only** – Log in as trainer; Home shows Trainer dashboard; Clients, Messages, Review Center, More visible.
- [ ] **Coach focus gating** – Transformation: Comp Prep row in More and comp-prep routes hidden. Competition/Integrated: Comp Prep visible.
- [ ] **Coach routes guarded** – As Client, direct URL to `/clients/123` or `/review-center` shows AccessDenied (or redirect); never Coach UI.
- [ ] **Review send feedback** – Review Detail / Check-in Review: feedback → Mark reviewed → ConfirmDialog; Send/Skip behave correctly.
- [ ] **Intake template & Team** – Delete template and Remove team member use ConfirmDialog; no window.confirm.

---

## 13. Client flow QA (role-specific)

- [ ] **Client only** – Log in as client; Home is Client dashboard; no Clients list, no Review Center, no Coach-only nav.
- [ ] **Messages** – Client can open threads, send messages; same composer and action sheet behavior as Coach.
- [ ] **More** – No "Developer tools (testing)" card in production build; no Coach-only rows (Team, Plan, etc.).

---

## 14. Athlete (solo) flow QA (role-specific)

- [ ] **Solo only** – Log in as solo; Home is Solo dashboard; no Clients, no Review Center.
- [ ] **Messaging** – If available, same as Client (threads, composer, keyboard).

---

## 15. Admin / testing flow QA (DEV only)

- [ ] **Role switcher** – In DEV, as ADMIN_EMAIL user, More shows "Developer tools (testing)" with Trainer / Client / Solo buttons; switch role updates view; "Use my actual role" restores.
- [ ] **Production build** – After `npm run build` and run production bundle: More must **not** show the role switcher card for any user.
- [ ] **Dev-only routes** – In production, `/admin-dev-panel` and `/navigation-audit` redirect to `/` (or home).

---

*Last updated: Audit pass – Role coverage, ConfirmDialog, message action sheet, doctor script; AUDIT_REPORT.md role matrix and role-based QA.*
