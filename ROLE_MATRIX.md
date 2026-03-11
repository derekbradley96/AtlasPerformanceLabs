# Role Matrix – Screens vs Roles

Single source of truth for role handling: `src/lib/roles.js` (`normalizeRole`, `isCoach`, `isAthlete`, `isClient`, `isAdmin`).

## Role map

| Role (display) | Internal role | DB profile.role | Notes |
|----------------|---------------|------------------|--------|
| **Coach**      | `trainer`     | `coach` or `trainer` | Full coach flows: clients, review center, programs, coach_focus. |
| **Athlete**    | `solo`        | `athlete` or `solo` / `personal` | Personal/solo dashboard; no Clients, Review Center, Programs. |
| **Client**     | `client`      | `client`         | Client dashboard; linked to a coach. |
| **Admin**      | `admin`       | —                | DEV only; bypass + view-as switcher. |

## Screens vs roles (allowed / blocked)

| Screen / Route | Coach | Athlete | Client | Admin (DEV) |
|----------------|-------|---------|--------|-------------|
| `/home` (Coach dashboard) | ✅ | ❌ (→ solo-dashboard) | ❌ (→ messages) | ✅ (by effectiveRole) |
| `/solo-dashboard` | ❌ | ✅ | ❌ | ✅ if impersonating |
| `/client-dashboard` | ❌ | ❌ | ✅ | ✅ if impersonating |
| `/messages` | ✅ | ✅ | ✅ | ✅ |
| `/more` (Profile) | ✅ | ✅ | ✅ | ✅ |
| `/clients`, `/clients/:id` | ✅ | ❌ | ❌ | ✅ |
| `/review-center`, `/review-global`, `/review/:type/:id` | ✅ | ❌ | ❌ | ✅ |
| `/programs`, `/programbuilder`, `/earnings`, `/leads` | ✅ | ❌ | ❌ | ✅ |
| `/inbox`, `/closeout`, `/briefing` | ✅ | ❌ | ❌ | ✅ |
| `/coach-type`, `/setup` | ✅ | ❌ | ❌ | ✅ |
| `/account` (Coaching focus) | ✅ | ❌ | ❌ | ✅ |
| `/plan`, `/team`, `/settings/branding` | ✅ (owner) | ❌ | ❌ | ✅ |
| `/comp-prep/*` | ✅ (if coach_focus) | ❌ | ❌ | ✅ |
| `/admin-dev-panel`, `/navigation-audit` | DEV only | DEV only | DEV only | DEV only |

## Bottom nav (role-aware)

- **Coach:** Home, **Clients**, Messages, More.
- **Athlete:** Home, Messages, More (no Clients).
- **Client:** Home (client-dashboard), Messages, More (no Clients).

## Route guards

- Coach-only screens use `<RequireAuthAndRole role="trainer" />`. Athlete and Client see AccessDenied or redirect.
- No Athlete-only route guard beyond routing to `/solo-dashboard` when role is `solo`.
- View-as (role switcher) is **DEV only**: `canUseRoleSwitcher = isDev && user?.email === ADMIN_EMAIL`.

## Defaults

- **Unknown/missing role:** `DEFAULT_INTERNAL_ROLE = 'solo'` (athlete). No hardcoded `'trainer'` default.
- **Tab bar:** Uses `getTabRoutesForRole(effectiveRole ?? role ?? DEFAULT_INTERNAL_ROLE)`.
