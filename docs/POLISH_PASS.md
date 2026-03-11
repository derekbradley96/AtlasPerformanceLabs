# Atlas Premium Polish Pass – Critical Screens

One-time consistency and premium polish pass across the 10 most important Atlas screens. No new UI libraries; React JSX, Vite, Capacitor, existing design system only.

## Shared Additions

### `src/ui/pageLayout.js` (new)
- **pageContainer** – Horizontal padding + top spacing from shell (same rhythm on every screen).
- **standardCard** – Dark card style: `colors.card`, `shell.cardBorder`, `shell.cardRadius`, `shell.cardShadow`.
- **sectionLabel** – Uppercase section headers: 12px, semibold, letter-spacing, `colors.muted`.
- **sectionGap** – Vertical spacing between sections (`shell.sectionSpacing`).

### Shared components used
- **EmptyState** – Same icon container, title, description, optional CTA across empty states.
- **LoadingState** – Skeletons: `ClientListSkeleton`, `MessagesListSkeleton`, `DashboardSkeleton`; card-style loading placeholders where “Loading…” was used.
- **shell** (tokens) – `pagePaddingH`, `topSpacing`, `cardRadius`, `cardBorder`, `cardShadow`, `sectionLabelMarginBottom` for alignment.
- **Atlas typography** – `atlas-page-title`, `atlas-section-title`, `atlas-card-title`, `atlas-meta` for hierarchy.
- **Atlas blue only** – Primary accent `colors.primary` (#3B82F6); no teal/cyan/green as main accent (e.g. Messages pin/unpin use `colors.primary` / `colors.surface2` / `colors.danger`).

---

## Files Changed

| File | Changes |
|------|--------|
| `src/ui/pageLayout.js` | **New.** Shared page container, card style, section label, section gap. |
| `src/pages/Clients.jsx` | pageContainer; standardCard for list wrapper; search bar `borderRadius: shell.cardRadius`; EmptyState for “No clients yet” and “No matches”; UserPlus icon for primary CTA. |
| `src/pages/CoachHomePage.jsx` | pageContainer + sectionGap; standardCard for all cards; sectionLabel for “Needs Attention”, “Revenue & Roster Health”, “Shortcuts”; single primary CTA (Open Review Center) already in place. |
| `src/pages/Messages.jsx` | Removed bright divider under “Conversations”; sectionLabel for list header; shell padding for scroll area; PIN_BG = `colors.primary`, UNPIN_BG = `colors.surface2`, DELETE_BG = `colors.danger`. |
| `src/pages/ClientDetail.jsx` | standardCard for Master Dashboard card; `atlas-card-title` for “Master Dashboard”. |
| `src/pages/ReviewCenterQueuePage.jsx` | pageContainer; loading skeleton (card-style placeholder) instead of “Loading…”; EmptyState for “Queue clear” with ClipboardCheck icon; standardCard on queue item cards. |
| `src/pages/ProgramBuilderPage.jsx` | standardCard on all Card components (block/suggestions/empty). |
| `src/pages/CheckInReviewPage.jsx` | pageContainer; loading skeleton instead of “Loading…”; standardCard on Metrics, Notes, Photos cards; sectionLabel for “Atlas Summary” and “Atlas Insights”; atlas-meta for meta text. |
| `src/pages/Account.jsx` | pageContainer; standardCard for main list container. |
| `src/pages/More.jsx` | pageContainer when content shown; standardCard for “Please sign in” card. |
| `src/pages/TodayPage.jsx` | standardCard on hero/content Cards (padding 20). |
| `src/components/dashboards/ClientDashboard.jsx` | standardCard on hero “Today’s Workout” and “Coach connection” cards. |

---

## Quality Pass Summary by Screen

1. **CoachHomePage** – Already had hero → needs attention → revenue/roster → shortcuts. Standardised card style and section labels; pageContainer and sectionGap for spacing.
2. **Clients (Clients.jsx)** – One primary action (Add client); EmptyState for both empty cases; list in standardCard; search bar radius aligned to shell; Import bodyweight link unchanged.
3. **ClientDetail** – Master Dashboard card uses standardCard and atlas-card-title; rest of page unchanged for scope.
4. **ProgramBuilderPage** – All cards use standardCard; layout and primary CTA unchanged.
5. **TodayPage** – Hero and main content cards use standardCard; existing shell padding and sectionGap kept.
6. **CheckInReviewPage** – Skeleton loader; standardCard on content cards; section labels and atlas-meta; one primary CTA (Mark Reviewed).
7. **Messages** – No bright divider; sectionLabel for header; shell padding; accent colours from tokens (Atlas blue, surface2, danger).
8. **AthleteDashboard / ClientDashboard** – Hero and coach cards use standardCard; one primary CTA (Today / Continue Workout).
9. **ReviewCenterQueuePage** – Skeleton when loading; EmptyState when queue empty; standardCard on items; pageContainer.
10. **More / Account** – pageContainer; standardCard on main card/list; Account list and More rows unchanged in structure.

---

## Removed or Avoided

- Random helper-text clutter (left as-is where minimal).
- Inconsistent subtitle styles (replaced with atlas-meta / sectionLabel where touched).
- Bright dividers under headers (Messages divider removed).
- Misaligned pills/badges (no structural change; existing CountPill/segments kept).
- Teal/cyan/green as main accent (Messages and tokens already Atlas blue; confirmed).
- Flat “Loading…” where a skeleton was easy to add (ReviewCenterQueuePage, CheckInReviewPage).

---

## Layout and Performance

- **Top spacing** – pageContainer uses `shell.topSpacing` and `shell.pagePaddingH` so every screen has the same top and horizontal rhythm.
- **Card radius and border** – standardCard uses `shell.cardRadius` (16) and `shell.cardBorder` for dark, consistent cards.
- **Empty states** – EmptyState component used on Clients, Messages (already), ReviewCenterQueuePage.
- **Loading** – Skeleton or card-style placeholder on ReviewCenterQueuePage and CheckInReviewPage; existing skeletons on Clients, Messages, CoachHome (DashboardSkeleton).
- **Business logic** – Unchanged except where required for polish (e.g. no new API calls or state).
