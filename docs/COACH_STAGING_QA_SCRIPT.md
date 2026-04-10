# Coach staging QA script (three coach focuses)

Use this for a **scripted pass on staging** before release. One sign-in per row (or refresh profile between runs). Record **Pass / Fail / Notes** in the last column.

## Preconditions

- Staging URL and credentials documented internally (not in this repo).
- Three coach accounts (or one account with changeable `coach_focus`), mapped to:
  - **Transformation**
  - **Competition**
  - **Integrated**
- Supabase views used on Coach Home are populated for at least one client per account (optional but ideal).

## Global smoke (every account)

| Step | Action | Expected |
|------|--------|----------|
| G1 | Sign in as coach | Lands on **Home** (`CoachHomePage`), no blank shell |
| G2 | Open **More** | Marketplace listing opens **Marketplace setup** (`/marketplace-setup`); prep entries match entitlements |
| G3 | Tab **Home** → scroll | Sections render: today’s focus strip, action queue area, quick actions, business snapshot; no repeated dead links |
| G4 | Open **Review Center** (from primary CTA or queue) | Queue loads; no infinite spinner |

## Per-focus checklist

### A — Transformation coach

| Step | Route / area | Expected |
|------|----------------|----------|
| A1 | `/home` | Intro copy describes transformation workflow; **no** prep-only metrics surfaced as primary (per product rules) |
| A2 | More → comp-prep / prep dashboard | **Hidden or gated** unless account has competition prep entitlement |
| A3 | `/marketplace-setup` | Listing editor loads; photo/sections reachable from completion hints if incomplete |
| A4 | `/inviteclient` / add client | Invite flow usable |

### B — Competition coach

| Step | Route / area | Expected |
|------|----------------|----------|
| B1 | `/home` | Intro references stage / peak / posing where applicable; priority strip can include prep-relevant filters when entitled |
| B2 | `/prep-dashboard` | Prep command center loads when entitled |
| B3 | `/comp-prep` | Prep library & tools reachable from **More** when `hasCompetitionPrep` |
| B4 | Client on prep journey | Needs attention / queue can segment or label prep vs lifestyle where integrated logic applies |

### C — Integrated coach

| Step | Route / area | Expected |
|------|----------------|----------|
| C1 | `/home` | Intro mentions both journeys; **Clients** filtering by journey usable |
| C2 | Attention / workload | Where data exists, prep vs lifestyle bucketing or labels appear without errors |
| C3 | More | Marketplace + prep entries consistent with entitlements (no duplicate marketplace routes) |
| C4 | Review Center | Filtered paths from home (e.g. check-ins, retention) resolve |

## Sign-off

| Focus | Tester | Date | Environment | Result | Notes |
|-------|--------|------|-------------|--------|-------|
| Transformation | | | | | |
| Competition | | | | | |
| Integrated | | | | | |

## Follow-ups

- If a step fails, capture **route**, **role**, **coach_focus**, and **browser / app shell** (website vs Capacitor).
- Regression: run `npm run test:unit` after changes touching coach home, routing, or access gates.
