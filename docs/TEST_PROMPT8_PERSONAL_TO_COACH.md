# Test Prompt 8 — Personal → Coach conversion (implemented)

## Goal

Make the path **Personal → Find a coach → profile → enquiry** feel natural, low-friction, and clear on value—without duplicating discovery systems.

## What changed

### Single discovery surface

- **`/findtrainer`** now **`Navigate`s to `/discover`** (`FindTrainer.jsx`). The old edge-function list UI is removed from this route so bookmarks and legacy links land on the same marketplace as the rest of the app.
- **Sidebar + CTAs** now point to **`/discover`** with label **“Find a coach”** (was “Find Trainer” → `/findtrainer`).
- Updated: `sidebar.jsx`, `CoachingUpgradeCard.jsx`, `ClientDashboard.jsx`, `MyTrainer.jsx`, `EnterInviteCode.jsx`, `routeMeta.js`, `routeInventory.js`.

### Discover (`CoachDiscoveryPage.jsx`)

- **Personal-only value banner**: Explains that coaching is optional, Atlas logging stays, one message starts the conversation.
- **Search** (name, headline, bio, location, coach type label).
- **“Personal → coach”** chip when `accepts_personal_transitions` is true (query now selects that column).
- **Two actions per card**: **View profile** + **Message** (navigates to profile with `state: { openEnquiry: true }`).

### Marketplace profile (`CoachMarketplaceProfilePage.jsx`)

- **Hero clarity**: “Open to: …” line from acceptance flags; **“Who they work with”** section (renamed from “Accepts”).
- **Sticky bottom CTA**: **Message {name}** + reassurance copy (“Free to reach out…”).
- **Enquiry modal streamlined**:
  - Prefills **name** and **email** from `useAuth()` (`profile.display_name`, session metadata, email).
  - **Interest** options filtered by what the listing accepts; default type inferred (e.g. transformation-only → transformation).
  - **Single optional** “Anything else?” field (replaces separate goal + long message).
  - If optional field is empty, submit sends a **default friendly intro** so users can send in one tap after review.
  - Submit label **“Send message”**; success copy mentions email reply.
- **Deep link**: `location.state.openEnquiry` or **`#enquire`** opens the modal and clears hash/state with `replace`.

### Public referral profile (`PublicCoachProfilePage.jsx`)

- Same **prefill**, **default message**, **combined optional details**, **sticky Message CTA**, and **openEnquiry / #enquire** behaviour so discovery **Message** works for coaches without a marketplace slug (`/coach/:referral_code`).
- **Primary CTA** is **Message**; **Apply for coaching** is secondary.
- Referral **enquiry_started** tracking resets per **slug** so multiple coaches still track correctly.

## How to re-test manually

1. Sign in as **personal**; open **Find a coach** (`/discover` or sidebar).
2. Confirm banner (personal), search, filters, **Message** on a card → modal opens on profile.
3. Confirm name/email prefilled; **Send message** with empty optional field succeeds (check coach inbox / function logs as appropriate).
4. Hit **`/findtrainer`** → should land on **`/discover`**.
5. Optional: open `/marketplace/coach/{slug}#enquire` → modal opens.

## Success criteria (mapping)

| Criterion | Implementation |
|-----------|----------------|
| Natural transition | Personal banner + optional coaching framing; “Message” not “hard sell”. |
| Fewer steps to enquiry | List → Message skips reading long profile; prefilled fields + default body. |
| Profile clarity | Open to / who they work with + sticky CTA. |
| One system | `/findtrainer` → `/discover`; one list source (`coach_marketplace_profiles`). |

## Build

After changes, run: `npm run build`.
