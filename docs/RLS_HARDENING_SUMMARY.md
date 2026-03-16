# RLS Hardening Pass – Summary

Full Row Level Security review of `supabase/migrations`. One new migration applies fixes: **20260326120000_rls_hardening_full_pass.sql**.

## Goals

- Every exposed `public` table has RLS enabled.
- Policies match Atlas roles: **coach**, **client**, **personal**, **admin**.
- No policy recursion; avoid inline admin checks that read `profiles`.
- Ownership-based policies (not role-string-only).
- Coach/client/org/personal isolation; minimal admin bypass.

## Table: RLS status, policy status, risk before/after

| Table | RLS status | Policy status | Risk before | Risk after |
|-------|------------|---------------|-------------|------------|
| **public.profiles** | Was unenforced in migrations | Missing select_own, update_own | High: any authed user could read/update any profile | Low: own row only + admin select via helper |
| **public.clients** | Enabled | Added clients_select_client_own (user_id = auth.uid()) | Medium: client role might not see own row from app | Low: client can read own row |
| **public.organisations** | Enabled | Unchanged (uses current_user_organisation_ids, current_user_is_admin) | Low | Low |
| **public.organisation_members** | Enabled | Unchanged (uses SECURITY DEFINER helpers) | Low | Low |
| **public.checkins** | Enabled | Unchanged (coach + org + client) | Low | Low |
| **public.notifications** | Enabled | Unchanged (profile_id = auth.uid()) | Low | Low |
| **public.notification_preferences** | Enabled | Added DELETE for own profile | Low: no delete policy | Low |
| **public.device_tokens** | Enabled | Unchanged | Low | Low |
| **public.device_push_tokens** | Enabled | Unchanged | Low | Low |
| **public.security_audit_logs** | Enabled | Replaced inline profiles read with current_user_is_admin() | Medium: inline profiles in policy | Low |
| **public.beta_feedback** | Enabled | Replaced inline profiles read with current_user_is_admin() | Medium: inline profiles in policy | Low |
| **public.atlas_coaches** | **Was disabled** | Added select/insert/update own (user_id = auth.uid()::text) | High: no RLS | Low |
| **public.atlas_services** | **Was disabled** | Added full CRUD for coach (via atlas_coaches) | High: no RLS | Low |
| **public.atlas_leads** | **Was disabled** | Added full CRUD for coach | High: no RLS | Low |
| **public.atlas_clients** | **Was disabled** | Added full CRUD for coach | High: no RLS | Low |
| **public.atlas_payments** | **Was disabled** | Added full CRUD for coach | High: no RLS | Low |
| **public.atlas_review_items** | **Was disabled** | Added full CRUD for coach | High: no RLS | Low |
| **public.client_* (billing, payments, subscriptions, etc.)** | Enabled | Unchanged | Low | Low |
| **public.message_threads / message_messages** | Enabled | Unchanged | Low | Low |
| **public.peak_weeks, peak_week_*, contest_preps, pose_* ** | Enabled | Unchanged (coach + client) | Low | Low |
| **public.client_habits, client_habit_logs** | Enabled | Unchanged | Low | Low |
| **public.coach_referrals, coach_referral_*, client_result_stories** | Enabled | Unchanged | Low | Low |
| **public.feature_flags, system_metrics, bug_reports, user_feedback** | Enabled | Unchanged | Low | Low |

## Changes in 20260326120000_rls_hardening_full_pass.sql

1. **Helper (SECURITY DEFINER)**  
   - `current_user_owns_client(p_client_id uuid)`  
   - Centralizes coach ownership (coach_id or trainer_id = auth.uid()) for reuse in RLS or app code.

2. **public.profiles**  
   - `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`  
   - `profiles_select_own`: SELECT where id = auth.uid()  
   - `profiles_update_own`: UPDATE where id = auth.uid()  
   - (Admin select already uses `current_user_is_admin()` in earlier migration.)

3. **public.clients**  
   - `clients_select_client_own`: SELECT where user_id = auth.uid() so client role can read own row.

4. **public.security_audit_logs**  
   - Replaced inline `(SELECT ... FROM profiles WHERE id = auth.uid())` with `current_user_is_admin()`.

5. **public.beta_feedback**  
   - Replaced inline profiles check with `current_user_is_admin()` for select and update.

6. **public.notification_preferences**  
   - `notification_preferences_delete_own`: DELETE where profile_id = auth.uid().

7. **public.atlas_coaches**  
   - RLS enabled.  
   - select/insert/update own: user_id = (auth.uid())::text.

8. **public.atlas_services, atlas_leads, atlas_clients, atlas_payments, atlas_review_items**  
   - RLS enabled.  
   - Full CRUD for coach: coach_id IN (SELECT id FROM atlas_coaches WHERE user_id = (auth.uid())::text).

9. **Indexes**  
   - `clients_user_id_idx` on public.clients(user_id) WHERE user_id IS NOT NULL  
   - `device_tokens_profile_id_idx` on public.device_tokens(profile_id)

## Verification

- **Coach**: Only own clients and org-scoped data (existing policies + helpers).  
- **Client**: Only own records (user_id = auth.uid() on clients; client_id in (own clients) on child tables).  
- **Personal**: Only own records (profile_id / user_id = auth.uid()).  
- **Admin**: Explicit read-only bypass via `current_user_is_admin()` only where already defined (organisations, organisation_members, clients, client_payments, profiles, security_audit_logs, beta_feedback).

## Legacy trainer/solo

- **Security decisions**: Coach ownership uses `current_user_owns_client()` and existing policies with COALESCE(coach_id, trainer_id) or trainer_id only where already present. No new role-string checks for trainer/solo.  
- **Compatibility**: Centralized in `current_user_owns_client()` (and existing clients policies) so trainer_id remains supported without spreading legacy names into new policies.

## Applying

```bash
# Local
npx supabase db push

# Or run the migration file against your DB
psql $DATABASE_URL -f supabase/migrations/20260326120000_rls_hardening_full_pass.sql
```

If **atlas_*** tables do not exist (Stripe migration not applied), the migration will fail at the first `ALTER TABLE public.atlas_coaches`. In that case, remove or comment out section 6 (atlas_* tables) in the migration file before running.
