# Coach marketplace profile — builder requirements

Public coach URLs use `coach_marketplace_profiles` plus `listing_details` (JSONB). The in-app editor is **Marketplace listing** (`CoachMarketplaceSetupPage`). Enforced client-side when **Visible in discovery** is on; apply DB constraints if you need server-side guarantees.

## Required before `is_public`

- **Display name** — non-empty.
- **Headline** — ≥ 12 characters; specific (who + how), not generic slogans.
- **Bio** — ≥ 40 characters; concrete experience and approach.
- **Profile photo** — `profiles.avatar_url` set (account settings / profile image URL).
- **Client types** — at least one of transformation or competition/prep accepted.
- **Pricing** — either pricing summary ≥ 8 characters **or** a positive **starting monthly amount**, and at least **one** included service toggle on.

## `listing_details` fields (structured)

| Area | Field | Notes |
|------|--------|--------|
| Identity / delivery | `delivery_mode` | `online` \| `hybrid` \| `in_person` |
| Positioning | `ideal_client_lines` | string[] — bullet list |
| Positioning | `not_ideal_lines` | string[] — trust through specificity |
| Positioning | `coaching_philosophy` | optional string |
| Positioning | `accountability_style` | optional string |
| Services | `services` | booleans keyed as in `SERVICE_DEFS` in `coachMarketplaceListingDetails.js` |
| Trust | `years_coaching`, `clients_coached` | numbers optional |
| Trust | `response_time_label` | e.g. “Replies in 24h” |
| Trust | `accepting_new_clients` | boolean |
| Trust | `certifications` | optional string |
| Pricing | `pricing_from_amount`, `pricing_currency` | optional; drives “From £X/mo” on card/profile |
| Pricing | `consultation_available` | if false, primary CTA becomes “View coaching options” |
| Marketplace | `featured_tags` | string[] — up to 4 shown on public profile |
| Marketplace | `match_reason` | optional override for adaptive match copy |

## Quality rules

- Prefer structured bullets and toggles over long vague blurbs.
- Do not ship empty or placeholder-only listings to discovery.
- Headlines and bios are short by design; coach focus on `profiles.coach_focus` still shapes defaults (e.g. default service toggles).

## Related code

- `src/lib/coachMarketplaceListingDetails.js` — parsing, defaults, `validateCoachListingForPublish`.
- `src/pages/CoachMarketplaceSetupPage.jsx` — editor and save payload.
- `src/pages/CoachMarketplaceProfilePage.jsx` — public conversion layout.
- Migration: `supabase/migrations/20260402120000_coach_marketplace_listing_details.sql`.
