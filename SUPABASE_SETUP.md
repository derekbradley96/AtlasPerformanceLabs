# Supabase setup (clients + profiles)

Use this in the **Supabase SQL Editor** (Dashboard → SQL Editor). Do **not** run these in the app.

## Checklist for Supabase to work

1. **Create a Supabase project** at [supabase.com](https://supabase.com) and get:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **Anon (public) key** from Project Settings → API

2. **Env vars in the app** (create or edit `.env.local` in the repo root, do **not** commit real keys):
   ```bash
   VITE_SUPABASE_URL=sb_publishable_sS7cQL3p-FE3CKEhin8Feg_IV5m4ZIX
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1anRlb2pkanhvcXJqZHBhbGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODAxNjksImV4cCI6MjA4NzE1NjE2OX0._YSJ4JAiuv1YAaNxVKstxxXs_4btx-1BpuHVacMUa8o
   ```
   Restart the dev server after changing env (`npm run dev`).

3. **Run the SQL below** in the Supabase Dashboard → SQL Editor (create table, enable RLS, add policy).

4. **Auth and RLS:** The `clients` policy uses `trainer_id = auth.uid()`. So:
   - **If you use Supabase Auth:** Sign in with Supabase (e.g. email/password); the app must use the signed-in user’s `id` as `trainer_id` when listing/creating clients. Until you wire login to Supabase Auth, `auth.uid()` is null and RLS will block access.
   - **If you are not using Supabase Auth yet:** The app falls back to local storage and still works; Supabase sync will start working once the app passes a real Supabase Auth user id as `trainer_id`.

5. **Optional – Forgot/Reset password:** ForgotPassword and ResetPassword pages use Supabase Auth when env vars are set; no extra setup beyond the same URL and anon key.

---

## 1. Create `clients` table

```sql
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  name text not null,
  phase text,
  days_out int,
  created_at timestamptz default now()
);
```

## 2. Enable Row Level Security (RLS)

```sql
alter table clients enable row level security;
```

## 3. Policy: trainers manage their own clients

```sql
create policy "Trainers manage their own clients"
on clients
for all
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());
```

---

After running the above, set in your app (e.g. `.env.local`, never commit real keys):

- `VITE_SUPABASE_URL=https://<project>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<anon key>`

Then restart the dev server. The app will sync clients with Supabase when these env vars are present; if they are missing or a call fails, it falls back to local storage.

---

## 4. Profiles table (for auth routing)

The app uses `public.profiles` to store **role** and **display_name** per user. Role is fixed at signup (trainer vs personal). Create the table and a trigger that copies signup metadata into `profiles`:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('trainer', 'personal', 'client', 'solo')),
  display_name text default ''
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create profile on signup from auth.users raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'trainer'),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

After running this, signup with "Trainer" or "Personal Mode" will store the role in `profiles` and the app will route to the correct dashboard after login.

For coach accounts the app uses `coach_focus` as the single source of truth (`transformation` | `competition` | `integrated`). Run the migration `supabase/migrations/20250302000000_profiles_coach_focus.sql` to add the column. Update your `handle_new_user` trigger to set `coach_focus` from `raw_user_meta_data` (e.g. `new.raw_user_meta_data->>'coach_focus'`) so signup persists it.

---

## 5. Redirect URLs for email confirmation & password reset (Capacitor iOS)

For the native app, auth links (confirm email, reset password) must open the app, not the browser. Add the deep link to Supabase:

1. In **Supabase Dashboard** go to **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add:
   - `capacitor://localhost/auth/callback`
3. Optionally set **Site URL** to your production web URL; the app uses `redirectTo` so email links will use the callback URL above when running in Capacitor.

Without this, confirmation links would point at `http://localhost:5174` and fail on a physical iPhone (localhost is the device).

---

## 6. Nutrition plan weeks (optional)

For the **Nutrition** tab in Client Detail (weekly macro adjustments), run the migration that creates `public.nutrition_plans` and `public.nutrition_plan_weeks`:

- **File:** `supabase/migrations/20250223100000_nutrition_plan_weeks.sql`
- **Requires:** `public.clients` table (id, trainer_id) to exist.
- **RLS:** Trainers get full CRUD on their own plans/weeks; client read policy is TODO until client auth mapping exists.

Run that migration in the Supabase SQL Editor (or via `supabase db push` if using the CLI).

---

## 7. Add `coach_type` to profiles (migration)

Run this after the profiles table exists. Adds `coach_type` for trainer coaching focus: **prep** | **fitness** | **hybrid**. Default is `'fitness'`. (Legacy values `general` and `both` are mapped in the app to `fitness` and `hybrid`.)

```sql
alter table public.profiles
  add column if not exists coach_type text default 'fitness';

-- Optional: restrict values (allow legacy for backward compat)
alter table public.profiles
  drop constraint if exists profiles_coach_type_check;
alter table public.profiles
  add constraint profiles_coach_type_check
  check (coach_type is null or coach_type in ('prep', 'fitness', 'hybrid', 'general', 'both'));
```

Update the signup trigger so new users get `coach_type` from signup metadata:

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, display_name, coach_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'trainer'),
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'coach_type'), ''), 'fitness')
  );
  return new;
end;
$$ language plpgsql security definer;
```

After running this, signup can pass `coach_type` in metadata (`prep` | `fitness` | `hybrid`) and the app can read/update it from `profiles`. Trainers with `coach_type` null or empty are prompted to choose on first load.

---

## 7. Nutrition plan weeks (weekly macro adjustments)

The app uses **weekly nutrition adjustments** per client: one plan per trainer+client, and one row per week with optional macros (calories, protein, carbs, fats, phase, notes).

**Migration:** Run the SQL in `supabase/migrations/20250223100000_nutrition_plan_weeks.sql`. It:

- Creates `public.nutrition_plans` (id, trainer_id, client_id) — one plan per trainer+client.
- Creates `public.nutrition_plan_weeks` (id, plan_id, week_start, phase, calories, protein, carbs, fats, notes, created_at) with unique (plan_id, week_start).
- Enables RLS on both tables; trainers get full CRUD on their own plans/weeks. Client read-only policy is left as TODO until client auth mapping exists.

After running the migration, the **Nutrition** tab in Client Detail can get-or-create a plan and list/upsert weekly rows.
