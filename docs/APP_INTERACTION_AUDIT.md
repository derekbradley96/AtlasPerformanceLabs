# App-wide interaction audit — first pass (2026-07-14)

Scope: every-inch sweep for interaction/UX defects (scrolling, gestures, delete
patterns, keyboard, sheets, native feel). Found by code inspection + pattern
scan; severities are best-guess and some need an on-device pass to confirm.
Already fixed this session: shell header title centering, personal safe-area
double-count (empty band), builder redesign. Not repeated below.

Status key: [ ] open · [~] partially done · [x] done

---

## P0 — hits users constantly, fix first

- [ ] **Keyboard covers inputs.** Only 13 / 191 pages handle the keyboard inset
  (`useKeyboardInset` / scroll-focused-input-into-view). Major form pages have
  NO handling — `EditProfile`, `ProfileAccountPage`, `NutritionTargetsPage`,
  `ClientCheckIn`, `CoachOnboardingWizard`, and most onboarding/intake screens.
  On native the software keyboard hides the field you're typing in. Needs a
  shared "keyboard-aware scroll" wrapper applied app-wide, or `Keyboard`
  (Capacitor) resize mode set to `native`/`ionic` + focused-input scroll.

- [ ] **Bottom sheets don't swipe-down to dismiss.** ~50 sheets are custom
  `fixed inset-0` overlays; only 2 use a real draggable drawer (`vaul`). Native
  users expect to drag a sheet down to close. Worse, only ~22 of them even close
  on backdrop tap, so some sheets can ONLY be closed by an explicit button.
  Standardise on one sheet component (drag-to-dismiss + backdrop tap + Escape).

- [ ] **Inconsistent / missing delete confirmation.** Chat message delete
  confirms (pending-state), but e.g. `Nutrition` meal delete fires instantly on
  tap (`deleteMealMutation.mutateAsync` with no confirm, no undo). Sweep every
  destructive action for one consistent pattern (confirm dialog OR
  delete-with-undo snackbar). `Workout.jsx` still uses raw `window.confirm`
  (ugly browser dialog on native) — replace with the in-app `ConfirmDialog`.

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
