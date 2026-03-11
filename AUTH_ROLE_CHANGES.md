# Auth Signup & Role Consistency – Changes Summary

**Canonical roles:** `'trainer'`, `'client'`, `'solo'` (optional: `'admin'`).  
**Supabase:** Profile trigger reads `auth.users.raw_user_meta_data.user_type` as fallback for `profiles.role`.

---

## 1. Files Touched and Exact Code Changes

### `src/lib/roles.js`
- **CANONICAL_ROLES** set to `['trainer', 'client', 'solo']` (was coach/client/personal).
- **DEFAULT_ROLE** set to `'solo'` (was `'personal'`) so unknown roles do not default to trainer.
- **normalizeRole**: maps `trainer`/`coach` → `'trainer'`, `client` → `'client'`, `solo`/`personal`/`athlete` → `'solo'`. Unknown → `'solo'`.
- **getUserRole**, **isCoach**, **isClient**, **isPersonal**: now return true for `'trainer'`, `'client'`, `'solo'` respectively.
- **roleHomePath**: trainer → `/home`, client → `/messages`, solo → `/home`.
- **PROFILE_ROLES**: canonical + legacy read-only (`coach`, `personal`, `athlete`).

### `src/lib/AuthContext.jsx`
- **VALID_ROLES / VALID_ROLES_PERSISTED**: `['trainer', 'client', 'solo']`.
- **PROFILE_ROLES_READ**: `['trainer', 'client', 'solo', 'coach', 'personal', 'athlete']`.
- **LOCAL_TRAINER_USER**: `user_type`/`role` set to `'trainer'` (sandbox only; not used when real auth exists).
- **getStoredRole**: reads `coach` → `'trainer'`, `personal` → `'solo'` from storage.
- **persistRole**: persists only `trainer`/`client`/`solo`; stores SOLO_STORAGE_KEY when role is `'solo'`.
- **buildFakeUser**: `normalised === 'trainer'` for stableId `local-trainer`; same for client/solo.
- **normalizeProfile**: fullName fallback uses `user_metadata.display_name` first, then `full_name`/`name`; default name `'User'`.
- **signUp**:  
  - Accepts `options.role` or `options.user_type`; normalises to `user_type` (`trainer`|`client`|`solo`).  
  - Sends **options.data** to Supabase as: `user_type`, `display_name`, and `coach_focus` (only when `user_type === 'trainer'`).  
  - No `role` key in `data`; trigger should read `raw_user_meta_data.user_type`.
- **Boot / onAuthStateChange**: when profile role is missing, patch with `role: 'solo'` (not `'personal'`).
- **Dev-only log on login**: after loading profile (or when using fallback), `console.log('[AUTH DEBUG] login', { user_type: session.user?.user_metadata?.user_type, profiles_role: profileRow?.role })`.
- **Coach focus**: guard uses `normalizeRole(role) !== 'trainer'` (not `'coach'`).
- **setFakeSession** fallback: `'solo'` when value invalid (was `'coach'`).
- **enterAdmin** default: `'trainer'` (was `'coach'`).
- **effectiveRole** fallback when admin: `'trainer'`.
- **isSolo**: `normalizeRole(role) === 'solo'`.
- **updateProfile**: coach_focus only when `normalizeRole(profile.role) === 'trainer'`.

### `src/screens/AuthScreen.jsx`
- **signupRole** state: `'trainer'` (was `'coach'`).
- **signupValid**: coach focus required when `signupRole === 'trainer'`.
- **handleSubmit**: builds `user_type: signupRole` and `display_name: (displayName ?? '').trim()`, `coach_focus` only when `signupRole === 'trainer'`; passes to `signUp(..., { user_type, display_name, coach_focus? })`.
- Account type buttons: values `'trainer'`, `'client'`, `'solo'`; labels "Trainer", "Client", "Solo". Coaching focus section shown when `signupRole === 'trainer'`.

### `src/pages/RoleSelection.jsx`
- **handleRoleSelect**: sends `user_type: roleKey` (no override). Solo now sends `user_type: 'solo'` (was `'general'`).

### `src/pages/Home.jsx`
- **LOCAL_USER_FALLBACK**: set to `{ id: 'local-solo', full_name: 'Guest', user_type: 'solo', role: 'solo', email: 'local@atlas' }` so unauthenticated/default UI does not assume trainer.

### `src/App.jsx`
- **hasRole**: `role === 'trainer' || role === 'client' || role === 'solo'` (was coach/client/personal).
- **EntryRoute**: solo branch `role === 'solo'` → `Navigate to={roleHomePath('solo')}`.
- **RequireRole / RequireAuth**: same `hasRole` check (trainer/client/solo).
- **RequireAuthAndRole**: all coach-only routes use `role="trainer"` (was `role="coach"`).

### `src/pages/Profile.jsx`
- **roles** array: `['trainer', 'client', 'solo']`.
- Dev banner: show `coach_focus` when `currentRole === 'trainer'`.

### `src/pages/Account.jsx`
- Coaching focus block: condition `role === 'trainer'` (was `role === 'coach'`).

### `src/pages/ClientDetail.jsx`
- Milestone evaluation guard: `role === 'trainer'` only (removed redundant `role === 'coach'`).

### `src/components/shell/AppShell.jsx`
- Unread count / coach guards: `normalizeRole(role) !== 'trainer'` (was `!== 'coach'`).

### `src/lib/routeMeta.js`
- **getTabRoutesForRole**: `homePath` for client vs non-client; `isCoach(r)` still used (true for `'trainer'`).

### `src/screens/AuthCallback.jsx`
- **getDashboardPath(role)**: trainer/coach → `/home`, client → `/messages`, solo/personal → `/home`.

### `src/components/hooks/useTrainerPermissions.js`
- No change needed: already uses `isCoach(role)` from `@/lib/roles`, which now treats `'trainer'` as coach.

---

## 2. signUp Data Shape (for DB trigger)

`supabase.auth.signUp` is called with:

```js
options: {
  emailRedirectTo: getAuthCallbackUrl(),
  data: {
    user_type: 'trainer' | 'client' | 'solo',
    display_name: string,
    coach_focus?: 'transformation' | 'competition' | 'integrated'  // only when user_type === 'trainer'
  }
}
```

Trigger should read `raw_user_meta_data.user_type` (and optionally `display_name`, `coach_focus`) to set `public.profiles.role` and related fields.

---

## 3. Removed / Avoided Defaults That Force Trainer

- **DEFAULT_ROLE** is `'solo'` so missing/unknown role does not become trainer.
- **setFakeSession** invalid fallback is `'solo'` (was `'coach'`).
- **LOCAL_USER_FALLBACK** in Home is solo (guest); used only when there is no `authUser`, so it does not override real auth.
- **LOCAL_TRAINER_USER** in AuthContext is used only when there is no Supabase session / no fake session; it is not used after a real login.

---

## 4. Legacy Mapping (read-only)

- **DB / storage:** If `profiles.role` or stored role is `coach` → normalised to `trainer`. If `personal` or `athlete` → normalised to `solo`. App and routing use only `trainer`/`client`/`solo`.

---

## 5. Dev-Only Debug Log

On login (boot and `onAuthStateChange`), when profile is loaded or fallback is used:

```text
[AUTH DEBUG] login { user_type: <auth.user.user_metadata.user_type>, profiles_role: <profiles.role> }
```

When profile is missing/invalid:

```text
[AUTH DEBUG] login (no/invalid profile) { user_type: ..., profiles_role: ..., fallback_role: 'solo' }
```

Use this to confirm the trigger and UI agree.

---

## 6. Manual Test Checklist

1. **Trainer**
   - Sign up: choose Trainer, set display name and coaching focus → submit.
   - In Supabase: `auth.users` → user → `raw_user_meta_data` has `user_type: 'trainer'`, `display_name`, `coach_focus`. `public.profiles.role` = `'trainer'`.
   - Login → land on `/home` (trainer dashboard); nav shows Clients, Messages, More.
   - Profile/Account show Trainer and coaching focus. Dev log shows `user_type` and `profiles_role`.

2. **Client**
   - Sign up: choose Client, set display name → submit.
   - `raw_user_meta_data.user_type` = `'client'`, `profiles.role` = `'client'`.
   - Login → land on `/messages` (or configured client home). No trainer-only routes.

3. **Solo**
   - Sign up: choose Solo, set display name → submit.
   - `raw_user_meta_data.user_type` = `'solo'`, `profiles.role` = `'solo'`.
   - Login → land on `/home` (solo experience). No trainer-only routes.
   - RoleSelection: choose Solo → backend receives `user_type: 'solo'` (not `general`).

4. **Routing and guards**
   - Coach-only routes (Clients, Review Center, Setup, etc.) allow only `role === 'trainer'`; client/solo get AccessDenied or redirect.
   - Client and solo cannot open trainer routes; redirect or access denied behaves as expected.

5. **Dev log**
   - After login, in console: `[AUTH DEBUG] login` with `user_type` and `profiles_role`; confirm they match and match DB.
