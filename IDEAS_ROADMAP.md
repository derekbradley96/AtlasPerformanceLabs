# Atlas Performance Labs – Ideas Roadmap

Tracked list of product/UX, retention, technical, and quick-win ideas. Status: **Planned** | **In progress** | **Done**.

---

## Product & UX

| Idea | Status | Notes |
|------|--------|------|
| **Quick actions from Home** – 1-tap "Reply to [client]", "Review check-in", "Send payment reminder" from briefing | Done | Home briefing cards link to Messages/Inbox/Client |
| **Client state at a glance** – Phase + trend pill and traffic light (on track / needs attention / at risk) on Clients list | Done | Phase pill + health risk pill on each row |
| **Smarter Messages** – Unread filter + "Mark all read"; quick-reply shortcuts in thread | Done | Filter already exists; "Mark all read" + quick-reply chips in ChatThread |
| **Comp prep timeline** – Per-client view: weeks to show, milestones, done vs upcoming | Planned | Needs design; data exists |
| **Offline / poor network** – Cache key views, queue message sends | Planned | Larger effort |

---

## Retention & engagement

| Idea | Status | Notes |
|------|--------|------|
| **Client nudges** – "Send nudge to [client] – no check-in in X days" in Inbox/Briefing with 1-tap | Done | Nudge CTA in Briefing/Inbox where relevant |
| **Loyalty / streaks in UI** – Surface "X months with you" / streak on ClientDetail and list | Done | ClientDetail shows loyalty; list shows small badge |
| **Weekly digest** – Email or in-app "This week: Y reviews, Z unread, N at risk" with deep links | Planned | Needs email/backend |

---

## Technical & quality

| Idea | Status | Notes |
|------|--------|------|
| **E2E / critical-path tests** – Playwright: login → Home → Clients → Messages | Planned | Add `e2e/` and npm script |
| **Error reporting** – Sentry or POST to backend for production errors | Planned | Optional; ErrorBoundary + window.onerror already log |
| **Performance** – Lazy-load heavy routes; virtualize long lists; image optimization | Done | Lazy routes for Comp Prep, Program Builder, Earnings |

---

## Differentiation

| Idea | Status | Notes |
|------|--------|------|
| **Templates for "what to say"** – Per phase/scenario, save/pick canned messages | Planned | New store + UI |
| **Program compliance view** – Per client: days completed vs planned this month | Done | Simple compliance block on ClientDetail |
| **White-label extension** – Accent, logo, "Powered by Atlas" toggle for client-facing screens | Planned | Extend existing Branding |
| **Coach notes** – Private notes per client, trainer-only | Done | Stored in clientDetailStorage; section on ClientDetail |

---

## Quick wins

| Idea | Status | Notes |
|------|--------|------|
| **Pull-to-refresh on Messages and Clients** | Done | AppShell enables PTR for /messages; Clients/Home already had it |
| **Search on Clients** – By name/email; filter by phase or status | Done | Search + segment filters already present; ensured phase filter |
| **Reset demo data** – In More or Admin | Done | "Reset demo data" in More (demo only) |
| **Keyboard shortcuts (dev)** – e.g. G then H = Home, G then C = Clients | Done | Dev-only shortcuts in App.jsx |
| **What's new / first-time tooltips** – Optional for Inbox or Comp Prep | Planned | Lightweight modal or tooltip |

---

## Implementation details (done items)

- **Quick actions from Home:** Briefing cards use existing navigation to `/messages`, `/inbox`, `/clients/:id`; no new API.
- **Client state at a glance:** Clients list uses `getPhaseAwareHealthResult`; phase and risk pill on each Row.
- **Mark all read + quick reply:** Messages page has "Mark all read" button when unread; ChatThread has quick-reply chips that insert text into input.
- **Client nudges:** Briefing/Inbox show "Send nudge" for stale clients; links to Messages with optional prefill.
- **Loyalty/streaks:** ClientDetail already had loyalty modal; added compact "X months" or streak in list subtitle where available.
- **Coach notes:** New `getCoachNotes`/`setCoachNotes` in clientDetailStorage; "Coach notes" collapsible section on ClientDetail.
- **Program compliance:** ClientDetail overview shows "Program days: X/Y this month" from check-ins when data exists.
- **Lazy routes:** Comp Prep, Program Builder, Earnings use `React.lazy` in App.jsx.
- **Pull-to-refresh Messages:** AppShell `enablePullToRefresh` includes `pathname === '/messages'`; Messages registers refresh.
- **Reset demo data:** More page (demo only) shows "Reset demo data" which clears `atlas_demo_dataset_v1` and reloads.
- **Keyboard shortcuts:** In dev, `g then h` → Home, `g then c` → Clients, `g then m` → Messages, `?` → show help.
