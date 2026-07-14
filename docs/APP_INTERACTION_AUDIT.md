# App-wide interaction audit — first pass (2026-07-14)

Scope: every-inch sweep for interaction/UX defects (scrolling, gestures, delete
patterns, keyboard, sheets, native feel). Found by code inspection + pattern
scan; severities are best-guess and some need an on-device pass to confirm.
Already fixed this session: shell header title centering, personal safe-area
double-count (empty band), builder redesign. Not repeated below.

Status key: [ ] open · [~] partially done · [x] done

---

## P0 — hits users constantly, fix first

- [x] **Keyboard covers inputs.** (0b7253b) Root cause: `capacitor.config.ts`
  sets `Keyboard.resize: 'none'`, so the WebView never shrinks — iOS paints the
  keyboard over the page and, because the viewport still reports full height,
  the browser never scrolls the focused field into view. Only ChatThread
  compensated (13/191 screens had any handling). Fixed once in AppShell via new
  `useKeyboardAwareFocus` + keyboard-inset bottom padding on the scroll
  container, scoped away from `noOuterScroll` (chat) pages which lift their own
  composer. **Needs an on-device pass** to confirm feel across forms.

- [~] **Bottom sheets don't swipe-down to dismiss.** CORRECTION to the first
  pass: the "~50" figure conflated centred dialogs and full-screen modals (which
  correctly use `fixed inset-0` and should NOT drag) with real bottom sheets.
  The true count is **17** bottom-anchored sheets not using a drawer. A shared
  `components/ui/BottomSheet.jsx` (vaul: drag-to-dismiss + backdrop + Escape)
  now exists; `ProgramBuilderPageImpl` assign sheet migrated. Remaining to
  migrate:
  `BetaSupportModal`, `BetaFeedbackModal`, `prep/PosingLogSheet`,
  `consultation/RequestConsultationModal`, `program/ExerciseSelector`,
  `coaching/CoachMarketplaceQuickCompleteModal`, `workout/ExerciseSearchModal`,
  `ProgressPhotos`, `More`, `PersonalMyProgram`, `CoachMarketplaceProfilePage`,
  `PublicCoachProfilePage`, `plan/TrainerPlan`, `client-detail/ClientDetailModals`,
  `compPrep/CompMediaList`, `compPrep/TrainerCompClient`.
  (~10 files already use the `ui/drawer` vaul primitive and are fine.)

- [x] **Inconsistent / missing delete confirmation.** (this pass) `Nutrition`
  meal delete fired instantly on one tap with no confirm/undo → now goes through
  `ConfirmDialog`. `window.confirm` is gone from the codebase: its only user,
  `pages/Workout.jsx`, was confirmed dead (unrouted, unimported — the build
  never compiled it) and deleted. Sweep found only 5 no-confirm deletes total;
  the rest are deliberate:
  - `ActiveWorkout` set delete — stays instant on purpose (high-frequency,
    trivially re-added; a confirm would be hostile).
  - `CommunityRoomPage` — coach **soft**-delete (recoverable). Optional confirm.
  - `AdminDevPanel`, `EditCheckInTemplate`, `CoachResultsStoryBuilderPage` —
    admin/coach authoring surfaces, low blast radius.

## P1 — inconsistency & native feel

- [ ] **Nested / non-standard scrolling.** ~20 pages set their own
  `overflow-y-auto` inside AppShell's own scroll container (double-scroll / trap
  risk) — e.g. `More`, `ProfileAccountPage`, `ProgressPhotos`, `EditProfile`,
  `CoachMarketplacePage/ProfilePage`, `PrepDashboardPage`, several
  `client-detail/*` sheets. Momentum (`-webkit-overflow-scrolling`) is set on
  some and not others. Decide on ONE scroll owner per screen.

- [ ] **`100vh` / `h-screen` on ~20 pages** (`Leads`, `Notifications`,
  `Coaches`, `ReviewCheckIn`, dashboards, etc.). `100vh` is wrong on mobile
  Safari (ignores the dynamic toolbar) → clipped bottoms / mis-sized screens.
  Move to the shell's `flex-1 min-h-0` pattern or `100dvh`.

- [ ] **Swipe actions only on 2 lists.** `SwipeRow` (swipe-to-delete/pin) is
  used only in `Messages` and `Clients`. Every other list (programs, workouts,
  meals, exercises, check-ins, notifications) has no swipe affordance →
  inconsistent. Either add swipe to the main lists or drop the expectation.

- [ ] **Long-press barely used + duplicated.** Two `useLongPress` hooks:
  `hooks/useLongPress.js` (350ms, pointer events, haptic) is live but used ONLY
  by `ChatBubble`; `components/app/useLongPress.js` (400ms, touch/mouse,
  move-cancel, no haptic) is **dead code**. Delete the dead one; decide where
  long-press should exist (list items? cards?) and apply it consistently.

- [ ] **Pull-to-refresh hardcoded to a few routes** (`/home`, `/inbox`,
  `/community`, `/clients`, `/messages`, `/comp-prep`, `/briefing`). Missing on
  the personal data screens users most want to refresh: `/progress`,
  `/nutrition` (Log), `/today`, `/myprogram`. Make PTR opt-in per scrollable
  data screen, or enable on all tab roots.

- [ ] **Escape-to-close on only 4 components.** Desktop-web modals mostly can't
  be dismissed with Esc. Fold into the standard sheet/modal component.

## P2 — polish (confirm on device)

- [ ] Tap-target audit: icon-only buttons < 44×44 across headers, cards, rows.
- [ ] Loading / empty / error state coverage per screen (some lists jump from
  blank to populated with no skeleton/empty copy).
- [ ] Haptics consistency — present in SwipeRow / some buttons, absent in many
  primary actions.
- [ ] Image handling — broken-image fallbacks, `alt` text, load placeholders
  (avatars, coach logos, progress photos).
- [ ] Transition/animation consistency (some routes animate in, some snap).
- [ ] Double-tap / rapid-tap protection beyond the 76 pages that disable on
  pending (spot-check the rest).

## Needs an on-device pass (can't confirm from code)

- [ ] Every screen top-spacing / alignment on a notch iPhone (we found two
  layout bugs already; there may be more per-screen).
- [ ] Scroll-into-view when opening keyboards mid-form.
- [ ] Sheet/modal behaviour with the keyboard open.
- [ ] Safe-area bottom under the tab bar on each scrollable screen.
