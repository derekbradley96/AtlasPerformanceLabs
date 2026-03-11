# Premium UI/UX Upgrade – Touched Files & QA Checklist

## Touched files (quick list)

### Design system & theme
- `src/ui/tokens.js` – existing; extended/used by theme
- `src/ui/theme.js` – **new** – single theme object (colors, typography, elevations, shadows, spacing)
- `src/ui/styles.js` – **new** – helpers: `cardStyle`, `sectionTitleStyle`, `screenContainerStyle`, `hairlineBorder`, `glassPillStyle`, `iconButtonStyle`
- `src/ui/Text.jsx` – **new** – typography component (h1, h2, h3, body, muted, caption, label, mono)

### UI components (new or updated)
- `src/components/ui/TopBar.jsx` – **new** – centered title, back (left), right slot, safe area
- `src/components/ui/SegmentedTabs.jsx` – **new** – iOS-style segmented control
- `src/components/ui/Skeleton.jsx` – **new** – single skeleton box
- `src/components/ui/SkeletonCard.jsx` – **new** – card-shaped skeleton (used on ClientDetail)
- `src/components/ui/EmptyState.jsx` – **new** – title, description, icon, optional CTA
- `src/components/ui/ConfirmDialog.jsx` – **new** – confirm modal (destructive/primary)
- `src/components/ui/useToast.js` – **new** – thin wrapper around sonner (success, error, info)

### System & logic
- `src/components/system/NetworkBanner.jsx` – **new** – offline banner (“Changes will sync when back online”)
- `src/lib/coachFocus.js` – **new** – `getEnabledModules(coachFocus)`, `shouldShowModule(coachFocus, moduleKey)` for role-aware gating

### Shell & layout
- `src/components/shell/AppShell.jsx` – NetworkBanner added between header and main content
- `src/components/ErrorBoundary.jsx` – “Go home” uses hash or path so navigation works

### Screens
- `src/pages/ClientDetail.jsx` – SegmentedTabs, SkeletonCard, EmptyState (“No phase”), call prep sheet, Overview default
- `src/components/clients/ClientOverviewPanel.jsx` – Call / Video / Copy link; `onOpenCallPrep`; toast on copy
- `src/pages/TrainerDashboard.jsx` – `showPrepFeatures` gated by `shouldShowModule(coachFocus, 'comp_prep')`
- `src/pages/More.jsx` – “Competition Prep” row hidden when `!shouldShowModule(coachFocus, 'comp_prep')`
- `src/pages/ReviewCenterGlobal.jsx` – Comp Prep chip hidden for transformation focus; filter reset when comp_prep hidden

---

## 10-step manual QA checklist (iPhone + Android)

Run these on **iPhone** and **Android** (and optionally web) to verify the premium upgrade.

1. **Navigation & shell**
   - [ ] Open app → Home, Clients, Messages, More tabs switch correctly; no double bottom bar; no blank bottom gap on pushed routes.
   - [ ] From Home, open a client → ClientDetail shows **Overview** by default (not Check-ins or Program).
   - [ ] Segmented tabs “Overview / Check-ins / Program” switch smoothly; active state is clear (pill/highlight).

2. **ClientDetail – dashboard & phase**
   - [ ] While client dashboard loads, skeleton cards appear (no blank white flash).
   - [ ] If client has no phase, “No phase set” empty state appears with “Change phase” CTA; tapping it opens Set Phase modal.
   - [ ] If client has a phase, main dashboard card shows phase and “Change phase” button works.

3. **ClientDetail – Contact & calls**
   - [ ] “Calls & Check-ins” (or Contact) section shows Call, Video, and Copy link.
   - [ ] Copy link copies meeting link and shows a success toast.
   - [ ] Call / Video open the call-prep sheet (snapshot, metrics, prep notes, Start Call / Start Video); from sheet, starting call/video launches device action (tel / FaceTime / Meet etc.) as expected on device.

4. **Set Phase modal**
   - [ ] Open “Set Phase” / “Change phase” → modal opens, scrolls if content is long, and **Cancel** closes the modal (no broken behavior).
   - [ ] Save is reachable (scroll to bottom if needed) and saves phase; success feedback (toast or UI update).

5. **Messages**
   - [ ] Messages list loads; empty state (no threads) is centered and clear.
   - [ ] Open a thread: composer is pinned to bottom; thread scrolls behind it; no “halfway up screen” layout bug.
   - [ ] Send a message: button state (e.g. disabled until text/attachment); “Sending…” then sent state.

6. **Review Center**
   - [ ] Review Center loads; segment tabs (Active / Waiting / Done) and filter chips render.
   - [ ] For **transformation** coach focus: “Comp Prep” chip is **not** shown; for **competition** or **integrated**, it is shown.
   - [ ] If Comp Prep was selected and focus is switched to transformation, filter resets to “All” (no stuck comp_prep filter).
   - [ ] Empty state per segment shows correct copy (“You’re clear”, “Nothing waiting”, etc.).

7. **Home (Coach) & coach focus**
   - [ ] With **transformation** focus: comp-prep–related tile/briefing (e.g. posing counts, peak week) is hidden or reduced.
   - [ ] With **competition** or **integrated**: comp prep briefing/tiles visible as before.
   - [ ] Tiles and briefing card spacing look consistent with design system.

8. **Profile / More & Account**
   - [ ] More screen: “Competition Prep” row is **hidden** when coach focus is **transformation**; visible for competition/integrated.
   - [ ] Account: Coaching focus selector updates Supabase and local state; after change, Home and Review Center reflect new focus (e.g. Comp Prep chip/row show or hide).

9. **Offline & errors**
   - [ ] Turn off network: small “Offline. Changes will sync when back online” banner appears at top (or equivalent).
   - [ ] Trigger a fatal error (e.g. throw in a component): Error Boundary shows premium error page with **Retry** and **Go home**; “Go home” navigates to `/home` (hash or path) and does not leave user stuck.

10. **Consistency & no dead taps**
    - [ ] All primary CTAs (Save, Send, Start Call, etc.) have working handlers (no dead buttons).
    - [ ] Same background/base and card radius across Home, ClientDetail, Messages, Review Center, Profile.
    - [ ] Back from ClientDetail or from Health/Review sub-screens returns to previous route reliably (no back-loop between two screens).

---

*After running the checklist, note any failures by step number and device (iOS/Android/Web) for follow-up.*
