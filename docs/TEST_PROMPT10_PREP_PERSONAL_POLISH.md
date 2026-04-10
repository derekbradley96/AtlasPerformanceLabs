# Test Prompt 10 — Competition prep + Personal polish (implemented)

Polish only: **no new systems**. Focus on tokens, safe areas, touch targets, hierarchy, empty/loading states, and light haptic feedback on primary navigation.

## Personal (`GeneralDashboard.jsx`)

- **Safe areas:** top/bottom padding uses `env(safe-area-inset-*)` on the main scroll surface, loading shell, and error shell.
- **Touch targets:** hero CTA uses `touchTargetMin` (44px); quick-access tiles use `minHeight: 92` + `WebkitTapHighlightColor: transparent`.
- **Haptics:** `impactLight()` on hero CTA, all quick-access tiles, dashed “Find a coach”, and primary/secondary actions in the empty “Recent activity” card.
- **Empty activity CTAs:** full-width on small screens, `minHeight: touchTargetMin`, centered content.

## Competition prep hub (`CompPrepHome.jsx`)

- **Safe areas** on the screen container; **eyebrow + stronger title** hierarchy (`Prep` / `Competition Prep`).
- **Search field:** Atlas tokens (`surface2`, `border`, `text`) — removed slate/white mismatch; `minHeight: touchTargetMin`, focus ring, aria-label.
- **Client rows:** `minHeight: touchTargetMin`, token text color, no `hover:bg-white/5`.
- **Empty states:** distinct **no search matches** (clear search) vs **no prep athletes** (copy + next step to Clients).
- **Primary CTA** (client submit): `colors.primary`, `touchTargetMin`, shell radius.
- **Pose / Photo / Media** rows: `shell.cardRadius`, `touchTargetMin`, tap highlight removed.

## Personal route loading (`SoloDashboardPage.jsx`)

- Replaced ad-hoc spinner with shared **`PageLoader`** on `colors.bg` + safe-area padding (matches `Home.jsx`).

## Prep header (`PrepHeader.jsx`)

- While data loads, shows a **compact pulse skeleton** inside the same `Card` footprint instead of disappearing (reduces layout jump on client profile for prep clients).

## Client Peak Week (`ClientPeakWeekPage.jsx`)

- **Removed duplicate bottom padding** (`pb-8` + inline `96`); single `paddingBottom` with safe area.
- **Sign-in** state: clearer copy, full-width **Go back** with `touchTargetMin` + haptic.
- **Error / empty** wrappers: bottom safe-area padding.
- **Loading:** `minHeight` on skeleton region for stability.
- **Submit check-in** button: `minHeight: touchTargetMin`, semibold label.

## Verify

1. Personal home on device/notch: content clears home indicator; tap Today / hero — haptic + navigation.
2. Comp Prep (coach): search styling matches app dark theme; empty + no-match states read clearly.
3. Client with prep: open profile — prep header area shows skeleton briefly then content.
4. Peak Week (client): scroll to bottom — no double gap; CTA is easy to tap.

## Build

`npm run build` after changes.
