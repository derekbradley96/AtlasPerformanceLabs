# Atlas App QA & Audit Checklist

Use this checklist for every major release across iOS, Android, and Web. Focus on **coach**, **client**, and **personal** roles.

---

## 1. Auth & Roles

- **Auth entry**
  - [ ] `/auth` is the only production auth entry (no direct use of legacy trainer/solo login pages).
  - [ ] `/auth/callback` correctly finishes Supabase redirects (signup, magic link, recovery).
- **Roles**
  - [ ] `profiles.role` only stores `coach` / `client` / `personal` (no `trainer`/`solo`/`athlete` written).
  - [ ] Logging in as each role lands on the correct dashboard:
    - [ ] Coach → `/home`
    - [ ] Client → `/client-dashboard`
    - [ ] Personal → `/solo-dashboard`
  - [ ] No “Role selection” / onboarding role pages appear in production flows.

---

## 2. Routing & Role Gating

- **Protected routes**
  - [ ] `/clients`, `/clients/:id` and review routes are only accessible to **coach** (or admin bypass).
  - [ ] `/programs`, `/plan`, `/team`, `/inbox`, `/closeout`, `/briefing`, `/analytics`, `/revenue*` are coach-only.
  - [ ] Client and Personal users never see:
    - [ ] Clients list
    - [ ] Review Center
    - [ ] Coach-only settings (branding, team, plan)
- **Legacy routes**
  - [ ] `/trainer`, `/trainer-dashboard` redirect to `/home`.
  - [ ] `/solo`, `/athlete` resolve to the personal dashboard only (no separate role).

---

## 3. Coach Types & Prep Access

- **Coach focus**
  - [ ] Account settings shows coaching focus options: `transformation`, `competition`, `integrated`.
  - [ ] Changing focus persists and reloads correctly.
- **Comp Prep visibility**
  - [ ] Transformation focus hides Comp Prep entry points on More/Review.
  - [ ] Competition / Integrated focus shows Comp Prep (and Peak Week) where expected.

---

## 4. Navigation & Back Behaviour

- **Bottom nav**
  - [ ] Coach tabs: **Home, Clients, Messages, More**.
  - [ ] Client tabs: **Home (client-dashboard), Today, Progress, Messages, More** (in that order).
  - [ ] Personal tabs: **Home (solo-dashboard), Today, Progress, Nutrition, More**.
- **Back button**
  - [ ] Client detail (`/clients/:id`) → back returns to `/clients` (or original list if deep-linked).
  - [ ] Message thread (`/messages/:id`) → back returns to `/messages`.
  - [ ] Review detail (`/review/:type/:id`) → back returns to appropriate review queue.
  - [ ] If there is no browser history (hard link), back falls back to `/home` instead of doing nothing.
- **Swipe-to-go-back (mobile)**
  - [ ] Edge swipe works on pushed/detail routes (clients, messages, review detail).
  - [ ] Edge swipe does **not** trigger on tab roots (Home, Clients, Messages, More).
  - [ ] Edge swipe is ignored on text inputs, buttons, and horizontally scrollable content.

---

## 5. Button Wiring & CTAs

- **Coach**
  - [ ] Coach Home tiles:
    - [ ] “Review check-ins” opens Review Center queue.
    - [ ] “Open Clients” goes to `/clients`.
    - [ ] “Inbox / Command Center / Revenue / Programs / Comp Prep / Analytics” all navigate to implemented routes only.
  - [ ] Clients list:
    - [ ] Row tap opens `/clients/:id`.
    - [ ] Message CTA opens `/messages/:clientId`.
    - [ ] Any “Add client” or import buttons open their sheets/pages.
- **Client**
  - [ ] Messages list → thread → back to Messages.
  - [ ] More page:
    - [ ] “Athlete dashboard” (if present) points to `/client-dashboard`, not a personal/athlete route.
    - [ ] Client-only rows (sessions, supplements, equipment) work and are not visible to other roles.
- **Personal**
  - [ ] Personal dashboard CTAs (Today, Progress, Nutrition) route correctly.
  - [ ] No coach-only CTAs appear (Plan & Billing, Clients, Review Center, Team, etc).

---

## 6. App Shell & Layout Consistency

- **Header**
  - [ ] Title matches the route and does not duplicate page-level headings.
  - [ ] Notification bell shows once in the header for all roles.
- **Spacing & overflow**
  - [ ] Lists and cards respect `pageContainer` / `standardCard` spacing.
  - [ ] No horizontal scrollbars on core screens (except where explicitly needed).
  - [ ] Icons are consistent sizes (e.g. 20–24px for row icons).
- **Loading & empty states**
  - [ ] Coach Home, Clients, Messages, Review Center, Today:
    - [ ] Show skeletons while loading.
    - [ ] Show friendly empty states when no data.
  - [ ] No raw error messages or stack traces surface in the UI.

---

## 7. Mobile Behaviour (iOS / Android)

- [ ] Safe-area insets are respected (top/bottom).
- [ ] Keyboard does not overlap inputs or message composer.
- [ ] Pull-to-refresh works on supported list screens and does not interfere with normal scrolling.
- [ ] Back button (hardware on Android, navigation gestures on iOS) match AppShell back behaviour.

