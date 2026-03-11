# Data contracts – Role & table mapping

Single source of truth for Supabase table names, profile fields, and messaging schema used by the app.

---

## 1. `public.profiles`

| Column         | Type    | Allowed values | Notes |
|----------------|---------|----------------|-------|
| `id`           | UUID    | —              | = `auth.uid()` |
| `role`         | text    | **`coach`**, **`client`**, **`personal`** (legacy read-only: `trainer`→coach, `solo`/`athlete`→personal) | Signup writes only `coach`, `client`, or `personal`. App uses `normalizeRole()` in `src/lib/roles.js`; legacy values are never written. |
| `display_name` | text   | —              | User-facing name. |
| `coach_type`   | text    | Legacy: `prep` \| `fitness` \| `hybrid` \| `general` \| `both` | Derived from `coach_focus` for legacy consumers; prefer `coach_focus`. |
| `coach_focus`  | text    | **`transformation`** \| **`competition`** \| **`integrated`** | Only relevant when `role = 'coach'`. Stored lowercase. Single source: `VALID_COACH_FOCUS` in `src/lib/coachFocus.js`. |
| `onboardingComplete` | bool | —        | Coach onboarding done. |

- **Canonical roles:** `coach`, `client`, `personal`. Legacy `trainer` is read as coach, `solo`/`athlete` as personal; never write legacy.
- **Signup:** Account type Coach → `role = 'coach'` (+ coach_focus); Client → `role = 'client'`; Personal → `role = 'personal'`. Enforced in `AuthContext.signUp()` and `AuthScreen.jsx`.

---

## 2. `coach_focus` allowed values

Defined in **`src/lib/coachFocus.js`** as `VALID_COACH_FOCUS`:

- **`transformation`** – Habits, adherence, payment, retention; no Competition Prep.
- **`competition`** – Comp prep, posing, peak week, photo guide.
- **`integrated`** – Both.

Used for: `shouldShowModule(coachFocus, moduleKey)`, coach-type onboarding, and Entry redirect (coach must have coach_focus set).

---

## 3. Message tables (Supabase)

The app uses **these tables only** (no `public.messages`):

| Table                 | Purpose | Key columns |
|-----------------------|--------|-------------|
| **`public.message_threads`** | One thread per coach–client pair | `id`, `coach_id`, `client_id`, `created_at`, `updated_at`, `deleted_at` |
| **`public.message_messages`** | Messages in a thread | `id`, `thread_id`, `sender_role` (enum `coach` \| `client`), `message_text`, `created_at` |

- **RLS:** `message_threads`: coach can only access rows where `coach_id = auth.uid()`.
- **RLS:** `message_messages`: coach can only access rows whose `thread_id` belongs to a thread with `coach_id = auth.uid()`.
- **Code:** `src/lib/messaging/supabaseMessaging.js` and `src/data/messagingService.js` use `.from('message_threads')` and `.from('message_messages')`.
- **Migration:** `supabase/migrations/20250303200000_message_threads_messages.sql`.

---

## 4. Clients table

| Table              | Key column   | RLS |
|--------------------|-------------|-----|
| **`public.clients`** | `trainer_id` (= auth.uid() in this app) | `trainer_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE. |

- **Migration:** `supabase/migrations/20250303100000_clients_rls.sql`.
- **Code:** `src/data/supabaseClientsRepo.ts` uses `.from('clients')` and `trainer_id` for scoping.

---

## 5. Views / other tables used by UI

- **No views** are required for the core messaging or role flows.
- **Coach focus gating:** Uses `profile.coach_focus` and `shouldShowModule(coachFocus, 'comp_prep')` etc. from `src/lib/coachFocus.js`.
- **Stripe / atlas_*** tables:** Some Supabase functions use `atlas_coaches`, `atlas_clients`, `atlas_services`, etc.; the main app uses `profiles`, `clients`, `message_threads`, `message_messages` as above.

---

## 6. Summary

| Concept        | Source | Values / tables |
|----------------|--------|------------------|
| **profiles.role** | DB + AuthContext | `coach`, `client`, `personal` only (legacy read: trainer→coach, solo/athlete→personal) |
| **coach_focus**   | `src/lib/coachFocus.js` | `transformation`, `competition`, `integrated` |
| **Message tables**| Supabase + app code | `message_threads`, `message_messages` only |
| **Clients**       | Supabase           | `clients` with `trainer_id = auth.uid()` |
