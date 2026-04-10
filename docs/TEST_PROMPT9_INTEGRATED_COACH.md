# Test Prompt 9 — Integrated (mixed) coach workflow (implemented)

## Goal

Integrated coaches run **lifestyle/transformation** and **prep/stage** athletes side by side without blended UI, wrong tools, or a single undifferentiated queue.

## Source of truth

- **`profiles.coach_focus === 'integrated'`** → show roster “lane” filters and split dashboards where helpful.
- **Client lane** (`src/lib/clientJourney.js`):
  - **Prep / stage:** `clients.client_type === 'competition'` **or** `show_date` set (legacy prep signal).
  - **Lifestyle:** everything else (including `client_type` `transformation` or `integrated` without a show date).

## What changed

### 1. Shared helpers — `src/lib/clientJourney.js`

- `normalizeClientJourneyType(client)` — fine-grained type for future use.
- `journeyRosterBucket(client)` → `'prep' | 'lifestyle'` — used for filtering and gating.
- `journeyRosterBadgeLabel(client)` → short badge: Prep / Lifestyle / Hybrid.

### 2. Clients list — `src/pages/Clients.jsx`

- **Integrated coaches only:** **Roster context** chips — **All types | Lifestyle | Prep / stage** (persisted in URL as `?journey=lifestyle` / `?journey=prep`).
- List filtering applies **on top of** existing segment chips (All, Active, Prep, etc.).
- **Row badge** shows lane (Prep / Lifestyle / Hybrid) for quick scanning.
- **Header copy** explains switching context and that profile tools follow the track.
- **Empty state** when a lane has no matches offers **Show all types**.

### 3. Coach Home — `src/pages/CoachHomePage.jsx`

- **Subtitle** for integrated coaches points to Clients filters + grouped queue.
- **Prep priorities** card copy clarifies prep tools vs lifestyle work.
- **Needs Attention:** when `coach_focus` is integrated and client rows were loaded, queue is **split** into:
  - **Prep / stage roster** (with link to `/clients?journey=prep`)
  - **Lifestyle roster** (with link to `/clients?journey=lifestyle`)
- Fetches `clients.id, client_type, show_date` for attention `client_id`s only.
- Refactored row UI into **`AttentionItemRow`** to avoid duplicated markup.

### 4. Client profile — `src/pages/ClientDetail.jsx` (feature leakage fix)

- **Prep header + timeline** (PrepHeader, timelines, empty prep state) now shows for integrated coaches **only if** `journeyRosterBucket(client) === 'prep'`.
- **Lifestyle** athletes no longer see the big prep block with “No prep data for this client”.
- **Prep command centre** unchanged (already gated to competition clients or active prep).
- **Integrated coaches:** header shows a **“{Prep|Lifestyle|Hybrid} track”** badge; non-integrated coaches still see the **Competition** badge when applicable.

## Manual test checklist

1. Set coach to **integrated** (Account / profile `coach_focus`).
2. **Clients:** confirm **Roster context** chips; toggle **Lifestyle** vs **Prep / stage**; URL updates; counts match expectations.
3. Open a **lifestyle** client → **no** prep timeline section; open a **prep** client → prep surfaces appear.
4. **Coach Home:** with clients in both lanes, **Needs Attention** shows two subsections when the journey map loads; links jump to filtered Clients.

## Build

`npm run build` passes after these changes.
