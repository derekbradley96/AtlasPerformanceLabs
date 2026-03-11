# Auth + Signup Role – Changes & QA

## Summary

- **Profiles.role** is one of: `'coach'`, `'client'`, `'personal'`.
- **Signup** passes `role` and `display_name` in `supabase.auth.signUp({ ..., options: { data: { role, display_name } } })` (stored in `raw_user_meta_data`; DB trigger should create/update `public.profiles`).
- **No client-side insert** into `profiles` on signup; only an optional **update** of `coach_focus` after signup for coach accounts.
- **No writes of `role='trainer'`** anywhere in the app; legacy values are only **read** and mapped via `normalizeRole()` (trainer→coach, solo/athlete→personal).

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/roles.js` | Added `getUserRole(profile)` returning `'coach' \| 'client' \| 'personal'` from `profile.role`. |
| `src/lib/AuthContext.jsx` | Replaced `profileRoleToInternal(profileRow.role)` with `normalizeRole(profileRow.role)` so role state is always canonical. |
| `src/components/shell/AppShell.jsx` | Coach check: `role !== 'trainer'` → `normalizeRole(role) !== 'coach'`. |
| `src/components/auth/RoleGuard.jsx` | **New.** Route guard: redirects to `roleHomePath(effectiveRole)` when current role not in `allow` list. |
| `src/pages/Profile.jsx` | Uses `getUserRole(profile ?? displayUser)`; canonical `roles = ['coach','client','personal']` for switcher; dev-only banner shows `profiles.role`, resolved role, and `coach_focus`; Account "Role" displays `currentRole`. |
| `src/pages/Account.jsx` | Coaching focus block: `role === 'trainer'` → `role === 'coach'`. |
| `src/components/hooks/useTrainerPermissions.js` | Coach check: `role !== 'trainer'` → `!isCoach(role)`; import `isCoach` from `@/lib/roles`. |

---

## No Remaining Writes of `role='trainer'`

- **Grep** over `src` for `role = 'trainer'` and `.update(..., role: 'trainer')` finds **no matches**.
- **AuthContext** only writes canonical roles (`'personal'` when patching missing profile role; signUp passes `roleForDb` from `normalizeRole(options.role)`).
- **Legacy** values (`trainer`, `solo`, `athlete`) are only **read** (e.g. from `profiles.role` or localStorage) and normalized; they are never written.

---

## Manual Test Checklist

### Coach

1. **Signup** – Choose "Coach", set display name and coaching focus → submit. In Supabase (`auth.users` → user → `raw_user_meta_data`): `role` = `"coach"`, `display_name` set. In `public.profiles`: `role` = `'coach'` (if trigger uses raw_user_meta_data).
2. **Login** – Coach lands on `/home` (trainer dashboard); bottom nav shows Clients, Messages, etc.
3. **Profile** – "Role" shows "Coach"; in dev, debug banner shows `role` (raw) and `coach_focus`.
4. **Account** – "Coaching focus" section visible; can change and save.
5. **Route guards** – Can open Clients, Review Center, Setup; client-only routes redirect as designed.

### Client

1. **Signup** – Choose "Client", set display name → submit. In `raw_user_meta_data`: `role` = `"client"`, `display_name` set. In `public.profiles`: `role` = `'client'`.
2. **Login** – Client lands on `/messages` (or configured client home).
3. **Profile** – "Role" shows "Client"; no coaching focus in banner/Account.
4. **Route guards** – Coach-only routes (e.g. `/clients`, `/review-center`) redirect to client home; client can access Messages, Profile, etc.

### Personal

1. **Signup** – Choose "Personal", set display name → submit. In `raw_user_meta_data`: `role` = `"personal"`, `display_name` set. In `public.profiles`: `role` = `'personal'`.
2. **Login** – Personal lands on `/home` (solo/personal dashboard).
3. **Profile** – "Role" shows "Personal"; no coaching focus.
4. **Route guards** – Coach-only routes redirect to `/home`; personal can use solo features.

### Cross-checks

- **Dev banner** (Profile) – In dev build, banner shows `profiles.role`, resolved role, and (for coach) `coach_focus`.
- **Role switcher** (Profile, dev) – If shown, switching cycles coach → client → personal and calls `user-update-role` with canonical role; reload reflects new role.
- **Existing legacy accounts** – User with `profiles.role = 'trainer'` or `'solo'` sees correct UI as coach or personal; no `role='trainer'` is written back.
