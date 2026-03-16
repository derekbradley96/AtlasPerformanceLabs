# Supabase migrations

Migrations run in **filename order** (timestamp prefix). Apply with:

- **Local:** `npx supabase db push`
- **Hosted:** Supabase Dashboard → SQL Editor, or your CI/deploy pipeline

## Key migrations for auth and RLS

1. **Profile on signup** – `20260317120000_fix_profile_creation_on_signup.sql`  
   Ensures `public.profiles` rows are created when users sign up (trigger on `auth.users`). Canonical roles: `coach`, `client`, `personal`.

2. **RLS recursion fixes** – run these in order so policies don’t cause infinite recursion:
   - `20260319120000_fix_profiles_rls_recursion.sql` – adds `current_user_is_admin()` and fixes admin policies on profiles, organisations, organisation_members, clients, client_payments.
   - `20260320120000_fix_organisation_members_rls_recursion.sql` – adds `current_user_is_org_member(uuid)` and `current_user_is_org_owner_or_admin(uuid)`; rewrites organisation_members policies to use them.
   - `20260320130000_fix_organisations_rls_recursion.sql` – adds `current_user_organisation_ids()`; rewrites organisations SELECT/UPDATE and clients/checkins org-member policies to use helpers (no inline subqueries on `organisation_members`).

After these, the Clients page and org-scoped queries should work without “infinite recursion” errors.

## Schema notes

- **clients:** `coach_id` and `trainer_id` both used; RLS allows access when `COALESCE(coach_id, trainer_id) = auth.uid()` or (for org members) when `organisation_id` is in the helper result.
- **profiles:** `role` is canonical only: `coach` | `client` | `personal`. Legacy `trainer`/`solo` are not written.
- **organisations / organisation_members:** Use the SECURITY DEFINER helpers above; do not add policies that `SELECT` from `organisation_members` or `organisations` inside another table’s policy (use the helpers instead).
