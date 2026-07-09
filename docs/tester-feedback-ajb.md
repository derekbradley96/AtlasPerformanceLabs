# Tester feedback — AJB Boardrooms (Antony Barnett), 8 Jul 2026

> **Status (9 Jul 2026, commit 46d72c1):** Items 1–4 built and verified in-browser
> on coach + client roles. Item 5's tab set is already the target after item 3
> (Home/Clients/Messages + Create) — what remains is the TestFlight device pass,
> which also covers the "already done" login/keyboard re-check. Item 6 skipped as
> recommended. Learn-more copy in `src/lib/featureHelp.js` is baseline — Derek to
> review/replace.

Usability review of the Atlas iOS beta. **All coach-side, first-time-experience UX
— no bugs.** The core message: Atlas's best coach tools are buried in the *More*
menu, so a new coach thinks the app is smaller than it is. Make it look as capable
as it already is.

> **Scope rule for every item below: coach role only.** The review is a coach's
> first session. Do NOT change client or personal navigation, and do not give
> clients/personal users a "Create" button or a coach-shaped tab bar.

---

## Already done — verify, don't rebuild

- **Login / keyboard (his #1, "Low/hygiene").** iOS keyboard covering the login
  fields is fixed (global scroll-into-view on keyboard open + field-to-field, in
  `src/App.jsx` `NativeKeyboardConfig`). Paste + password-manager autofill already
  work on the auth screen. Just re-check on the next TestFlight build.

---

## Build these, in this order

### 1. Settings cog  (quick, low risk) — his #6
Pull Business / Account / Preferences / Profile out of *More* into a dedicated
**cog icon** (top-right of the coach dashboard header). `ProfileAccountPage` already
exists — this is a new entry point, separating "configure" from "create."

### 2. Marketplace card on the coach Dashboard  (high impact, low risk) — his #8
Coach marketplace setup is currently in More → Grow (two taps deep). Add a prominent
**Marketplace card on CoachHome** (`src/pages/CoachHomePage.jsx`). Cheaper and lower
risk than adding a nav slot — do the dashboard card, not a tab, first.

### 3. Convert coach "More" tab → "+ Create" menu  (the headline, medium) — his #2 + #4
Turn *More* into a prominent **Create** action surfacing what a coach can build:
training programmes, methodology packages, nutrition plans, check-in templates,
supplement stacks, marketplace content, client resources. All these routes/pages
already exist — this is navigation + labelling, not new features. Coach role only.

### 4. "Learn more" help affordance  (medium; needs copy) — his #7
Small **Learn more / Help** link on creation screens, especially **Methodology
Packages** (he singled it out as confusing). Engineering: add the affordance + a
simple in-app help sheet with a paragraph per feature. **Copy is TBD (Derek to
supply).** Don't let this block the nav work.

### 5. Reduce coach bottom nav to Dashboard / Clients / Messages + Create  (medium, HIGHEST RISK) — his #3
Do this as its own deliberate, device-tested task AFTER 1–4. The tab bar is shared
infrastructure across roles (`getTabRoutesForRole`, `AppShell`), so it needs careful
coach-only config and on-device verification.

### 6. Horizontal swipe between tabs — his #5  →  SKIP / optional
Recommend against. Swipe-to-change-tab fights horizontal scrollers, carousels, and
the existing swipe-back gesture; high fiddle, real regression risk, small payoff.
Only if there's spare time.

---

## Recommended product posture (his framing, worth keeping in mind)
Move from a *navigation-led* app to a *creation-led* coaching workspace: within the
first minute a coach should see what they can build, manage, publish, and sell.
