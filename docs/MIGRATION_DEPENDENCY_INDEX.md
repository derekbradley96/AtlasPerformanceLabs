# Migration dependency index (current app expectations)

This lists **Supabase migrations** that align with **current client code** for high-risk flows. It is not every migration in `supabase/migrations/` (200+). Run **`npm run db:push`** on staging/prod so `schema_migrations` matches this repo.

**Preflight:** `npm run db:check-migrations` (duplicate version / reserved-word scan).

---

## Messaging (threads, messages, realtime, replies)

| Migration file | Purpose |
|----------------|---------|
| `20260409180000_messaging_participant_rls_read_receipts.sql` | Thread RLS + read receipt columns used by messaging UI |
| `20260410103000_realtime_messaging_publication.sql` | Adds `message_messages`, `message_threads` to `supabase_realtime` publication |
| `20260410120000_message_messages_reply_to.sql` | `message_messages.reply_to_id` for reply threading |

**App touchpoints:** `src/data/messagingService.js`, chat components, `useData` / realtime subscriptions.

---

## Program assignment sync (client sees assignments without manual reload)

| Migration file | Purpose |
|----------------|---------|
| `20260410121500_realtime_program_assignments_publication.sql` | Adds `program_block_assignments` to realtime publication |

**App touchpoints:** program assignment flows, client dashboard query invalidation / realtime.

---

## Client (athlete) self-service on `clients` row

| Migration file | Purpose |
|----------------|---------|
| `20260410140000_clients_update_athlete_own_row.sql` | RLS: client updates own roster row when `clients.user_id = auth.uid()` |

**App touchpoints:** `ClientDetail.jsx`, profile/athlete field saves via `clients` table.

---

## Related release QA docs

- `docs/RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md` — messaging RLS + payment gate tests  
- `docs/STAGING_PROOF_MESSAGING_PAYMENT.md` — staging evidence log  
- `docs/RELEASE_GATE_ONBOARDING.md` — onboarding gate  
- `docs/COACH_STAGING_QA_SCRIPT.md` — coach smoke

---

## Profiles / onboarding (representative)

| Migration file | Purpose |
|----------------|---------|
| `20260315180000_profiles_onboarding_complete.sql` | Onboarding completion flags |
| `20260316130000_profiles_coach_onboarding_fields.sql` | Coach onboarding fields |
| `20260325153000_profiles_update_policy_own.sql` | Profile self-update policy |

**App touchpoints:** `AuthContext.jsx`, `ProfileAccountPage.jsx`, coach/personal onboarding flows.

---

*When adding a feature that depends on a new column, policy, or publication: append a row here in the same PR as the migration.*

---

## Troubleshooting: “Connection terminated due to connection timeout”

If **SQL Editor**, **Database → Reset password**, and **`npm run db:push`** all time out, the failure is **not** fixable from this repo (wrong `.env`, migration SQL, or app code). The hosted **Postgres instance is unreachable** from Supabase’s platform or is still waking up.

**Do this in order:**

1. **Free tier — paused project**  
   Dashboard → **Project Settings → General**. If the project is **paused**, use **Restore / Resume** and wait **1–3 minutes**. In SQL Editor run `select 1;` until it succeeds before migrations or password reset.

2. **Network (you)**  
   Try without VPN; another network (e.g. hotspot) rules out local routing issues (rare for SQL Editor, common for CLI).

3. **Platform**  
   Check [Supabase status](https://status.supabase.com). If `select 1` still fails after restore and a wait, open **Help / Support** from the dashboard with your **project ref** and the exact error string.

**Until SQL Editor can run `select 1;`**, manual migration paste and CLI `db:push` will not work; no repository change substitutes for a healthy database.
