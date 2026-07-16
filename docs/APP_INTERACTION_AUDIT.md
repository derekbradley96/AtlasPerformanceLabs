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

- [x] **Bottom sheets don't swipe-down to dismiss.** CORRECTION to the first
  pass: the "~50" figure conflated centred dialogs and full-screen modals (which
  correctly use `fixed inset-0` and should NOT drag) with real bottom sheets. The
  true count was **17**, one of which (`workout/ExerciseSearchModal`) was dead
  code and deleted. Added `components/ui/BottomSheet.jsx` (vaul): drag-to-dismiss
  + backdrop tap + Escape + grab handle on mobile, and a centred dialog on wide
  web so the old `sm:items-center` treatment isn't regressed. All 15 remaining
  sheets migrated; zero hand-rolled `items-end` overlays remain.
  Gotcha found: vite does NOT error on a missing import for a JSX identifier —
  it builds clean and throws at runtime. Verify imports explicitly after this
  kind of migration.

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

- [x] **Nested scrolling.** CORRECTION: the first pass flagged "~20 pages" for
  having their own `overflow-y-auto`. That test was wrong — an inner
  `overflow-y-auto` is harmless unless the element also has a *bounded height*.
  Re-tested for bounded-height scrollers, and everything flagged turned out
  legitimate (vaul drawers, search dropdowns, centred modal panels like
  ProfileAccountPage, `.chat-messages`, and PersonalOnboardingFlow which renders
  outside the shell) — except **one real trap**:
  `program-builder/ExerciseEditor` capped the exercise list at
  `min(75vh, 720px)` with its own `overflow-y: auto` **and**
  `overscroll-behavior: contain`, nested inside the builder page. `contain`
  refuses to chain the scroll onto the page, so once the list hit its end the
  page would not move — almost certainly the original "can't scroll down" report
  (the earlier `noOuterScroll` fix was a separate, real bug). The list now
  renders in normal flow: the page is the single scroll owner.
  Also deleted `pages/ProgramBuilder.jsx` — a dead 1117-line legacy builder
  (unimported) that carried the same trap.
  Momentum (`-webkit-overflow-scrolling`) inconsistency is moot now that pages
  don't own scrollers; the shell's scroller sets it.

- [x] **`min-h-screen` dead scroll.** CORRECTION: the first pass claimed `h-screen`
  clipped bottoms on ~20 pages. Wrong — exactly **1** file uses fixed `h-screen`
  (`ui/sidebar.jsx`, legitimately). The real issue is **122 pages using
  `min-h-screen`**: inside the shell, 100vh ignores the header + tab bar, so every
  screen carried ~140px of dead scroll, and the **56** pages that vertically
  centre against it were centring on a box taller than the visible area.
  Neutralising to 0 would have wrecked those 56, so instead AppShell measures the
  content area into `--app-content-h` (ResizeObserver — survives banners and the
  keyboard) and index.css remaps `min-h-screen` inside `.app-shell-scroll` to it.
  `min-h-screen` now means "fill the content area". **Needs a device pass.**

- [ ] **Swipe actions only on 2 lists.** `SwipeRow` (swipe-to-delete/pin) is
  used only in `Messages` and `Clients`. Every other list (programs, workouts,
  meals, exercises, check-ins, notifications) has no swipe affordance →
  inconsistent. Either add swipe to the main lists or drop the expectation.

- [~] **Long-press barely used.** The dead duplicate (`components/app/useLongPress.js`)
  is deleted (0b7253b), along with a second dead dupe `components/app/useKeyboardInset.js`.
  `hooks/useLongPress.js` is live but still used ONLY by `ChatBubble`. Open
  product decision: where else should long-press exist (list items? cards?).

- [x] **Pull-to-refresh.** It was gated on a hardcoded path list AND required the
  page to call `registerRefresh` — only **9** pages ever did, so enabling routes
  alone would have done nothing. PTR now runs on every tab root (plus
  /myprogram, /briefing, /comp-prep/media, /clients/:id); pages with their own
  handler still win, everything else falls back to refetching that screen's
  active queries. Progress, Log, Today and My programme now refresh.

- [~] **Escape-to-close.** Much improved: all 15 migrated sheets get Escape via
  BottomSheet, and ConfirmDialog already had it. Remaining: one-off overlays that
  are neither a BottomSheet nor a ConfirmDialog.

## P2 — polish (confirm on device)

- [x] **Tap targets.** CORRECTION: "icon-only buttons < 44 across headers, cards,
  rows" overstated it — 67 components already use `touchTargetMin` (44) and a
  sweep of both inline-styled and Tailwind-sized buttons found exactly **one**
  real offender: `chat/VoiceNoteButton` at 36×36. Given a 44px hit area with the
  visual circle kept at 36 inside, so the composer looks unchanged. (The other
  sub-44 hits were decorative icon/avatar spans, not tap targets.)
- [~] Loading / empty / error states. Measured, and the flagged screens were
  mostly false positives: the "bare lists" `.map()` over STATIC arrays (menu
  rows, form options — More, ResetPassword, ClientEquipment), which need no empty
  state. Real data lists already use EmptyState/skeletons. No action taken; worth
  a per-screen device pass rather than a grep.
- [~] Haptics — 88 files already use them; coverage is broad, not patchy as the
  first pass implied. Any remaining gaps are taste, not defects.
- [~] **Image handling.** Confirmed real: 32 of 49 files with `<img>` had no
  `onError`, and these are mostly Supabase **signed URLs that expire** — so a
  stale link renders the browser's broken-image glyph mid-UI. Added
  `components/ui/Img.jsx`: falls back to whatever the caller shows when there's
  no image (initials, an icon, a message) and retries on src change. Migrated the
  highest-traffic spots — More avatar (→ initials), the shell coach logo in both
  render paths, and progress photos (→ "Unavailable"). Remaining `<img>` sites can
  move to `<Img>` incrementally.
- [x] Transitions — non-issue. The shell already animates pushed routes centrally
  (`app-shell-push-in`); only 17/189 pages add their own, and that's redundant
  rather than missing.
- [~] Rapid-tap — 76 pages carry a disabled-while-pending guard against 56 with
  mutations, i.e. broadly covered. The handful without a guard are mostly
  idempotent toggles. Not a defect; revisit only if double-submits show up.

## Needs an on-device pass (can't confirm from code)

- [ ] Every screen top-spacing / alignment on a notch iPhone (we found two
  layout bugs already; there may be more per-screen).
- [ ] Scroll-into-view when opening keyboards mid-form.
- [ ] Sheet/modal behaviour with the keyboard open.
- [ ] Safe-area bottom under the tab bar on each scrollable screen.
