# Follow-up 1 — Mobile-only UX fixes

**Goal:** Improve narrow-viewport comfort without new flows or duplicate screens.

## What changed (code)

| Area | Change |
|------|--------|
| **Bottom nav** (`BottomNavPremium.jsx`) | Extra bottom padding above home indicator; `touch-action: manipulation` + no tap highlight on items; label `line-height: 1.25`; `NAV_BAR_HEIGHT` 92→94 so `BOTTOM_NAV_HEIGHT` matches real bar height. |
| **Workout player** (`WorkoutPlayerPage.jsx`) | Entry + playing + error states: `paddingBottom` includes `env(safe-area-inset-bottom)`; entry + active exercise cards `padding` 18→16; **End workout** hit area ≥44px; **Back to Today** full-width / min height where needed; client profile error + empty session back buttons enlarged; reps/weight inputs **full width** (`maxWidth: 100%`); **Add weight** toggle `minHeight` + padding. |
| **Readiness check-in** (`ReadinessCheckinPage.jsx`) | Horizontal padding uses `shell.pagePaddingH`; form bottom padding + safe area; scale grid `minmax(0,1fr)` + slightly tighter gap; scale buttons **min 48px** tall; row cards `padding` 12→14; form vertical gap 10→12. |

## How to retest (narrow / mobile)

1. **Bottom nav:** On a tab route, scroll content to the end — last card should sit above the nav without overlap; tap tabs — no double-tap delay feel (WebKit).
2. **Workout player:** Start session → during workout, **End workout** and **Exit** are easy to tap; reps field uses full width; complete screen **Back to Today** is comfortable; content clears the home indicator.
3. **Readiness:** Complete flow on 320–390px width — 1–5 scale taps feel roomy; submit button clears bottom safe area.

## Not run here

Automated device tests were not executed in CI from this pass; validate on **iOS Safari** + **Chrome Android** when possible.
