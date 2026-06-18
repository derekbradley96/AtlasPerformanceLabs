# Migration Consolidation Plan

This document describes **how** to consolidate `supabase/migrations/` into a smaller, reasoned baseline. **Do not execute consolidation** until the preconditions in [Timeline](#timeline) are met.

For day-to-day migration hygiene and risky flows, see `docs/MIGRATION_DEPENDENCY_INDEX.md` and `supabase/MIGRATION_PUSH.md`.

---

## Current state

| Metric | Value |
|--------|--------|
| **Migration file count** | **281** individual `.sql` files under `supabase/migrations/` |
| **Earliest (lexicographic / timestamp prefix)** | `20250213000000_canonical_schema.sql` |
| **Most recent** | `20260428144000_leads_public_profile_columns.sql` |
| **Risk** | **High** — any consolidation must **not** change the effective production schema or confuse migration history already recorded on hosted/staging databases. |

### Ten most recent migrations (newest last)

| File | Purpose (short) |
|------|-----------------|
| `20260424081000_increment_function.sql` | `public.increment(integer)` helper. |
| `20260424081500_program_notes_and_checkin_tags.sql` | `program_blocks.coach_notes`, `checkins.coach_review_tags`. |
| `20260424090000_workout_logging_upgrade.sql` | Prescribed set fields, `program_exercises.sets_config`, workout session readiness, etc. |
| `20260424100000_workout_exercise_notes.sql` | `workout_exercise_notes` table + RLS. |
| `20260424110000_workout_tempo_superset.sql` | Tempo, superset, RIR, rest on `program_exercises`; `workout_sessions.session_rpe`. |
| `20260424123000_competition_prep_client_extensions.sql` | Prep pace ack on check-ins, `contest_preps` pacing fields, RPC. |
| `20260424153000_client_journey_stage.sql` | `clients.journey_stage`. |
| `20260425010000_increment_coach_term_usage.sql` | `increment_coach_term_usage` for `coach_saved_terms`. |
| `20260425020000_leads_table.sql` | `public.leads` table + indexes / column backfill. |
| `20260428144000_leads_public_profile_columns.sql` | `leads.message` and related columns for public profile capture. |

---

## Why consolidate (problem statement)

- **281** ordered files make it hard for a new developer to see the *current* schema at a glance.
- Historical edits, hotfixes, and renames are spread across many timestamps; **git history** remains the audit trail even after consolidation.
- Consolidation is **operational surgery**: it must align local files, CLI expectations, and **whatever table Supabase/your host uses to record applied versions** (often discussed as `schema_migrations` in project docs — **verify the exact catalog for your Supabase version** before any manual SQL).

---

## Consolidation approach (do **NOT** run yet)

### Step 1 — Create a consolidated baseline (backups)

When you are allowed to touch production (or a full clone), capture evidence:

```bash
mkdir -p backups
supabase db dump --data-only > backups/production-backup.sql
supabase db dump --schema-only > backups/production-schema.sql
```

- Adjust connection flags / linked project per your Supabase workflow.
- Store backups in a **secure** location, not only in the repo.

### Step 2 — Generate a single baseline migration (local)

Goal: one file that reproduces the **current** cumulative schema (equivalent to applying all 281 in order on a clean DB).

Locally (example flow):

```bash
supabase db reset   # applies all existing migrations to a clean local DB
supabase db dump --schema-only > supabase/migrations/00000000000001_consolidated_baseline.sql
```

- **Naming:** use a version string that sorts **before** or **after** existing policy per your chosen strategy; coordinate with the team.
- **Review:** the dump may include objects you do not want in migrations (extensions, roles, comments) — trim intentionally so the baseline is maintainable.

### Step 3 — Archive old migrations

Move historical files out of the active folder so new developers only read the baseline + **recent** deltas.

Example (illustrative — **adjust globs** to your retention rule, e.g. “keep last 6 months active”):

```bash
mkdir -p supabase/migrations/archive
# Example only — do not run without listing matches first:
# mv supabase/migrations/202502* supabase/migrations/archive/
# mv supabase/migrations/202503* supabase/migrations/archive/
# … etc.
```

- **Critical:** `supabase db push` / CI must only see migrations that match **remote** recorded history **or** a documented cutover procedure.
- Prefer **`git mv`** so history is preserved.

### Step 4 — Migration bookkeeping (hosted DB)

Adding a new consolidated file **without** aligning the remote migration log will cause the CLI to try to re-apply SQL or reject the history.

The project’s internal docs reference **`schema_migrations`** when describing `supabase db push` behavior (`supabase/MIGRATION_PUSH.md`). Your Supabase version may use a different schema/table name (e.g. under `supabase_migrations`).

**Do not** run ad-hoc `INSERT` statements from a generic template without:

1. Reading current Supabase CLI docs for your version.
2. Comparing **local** migration list to **remote** applied versions.
3. Running the cutover on **staging** first.

Example (placeholder only — **not** verified for this repo’s Supabase version):

```sql
-- PLACEHOLDER — verify table name, columns, and checksum/version rules before use.
-- INSERT INTO … (version, name, statements) VALUES ('00000000000001', 'consolidated_baseline', …);
```

Often the **safer** approach is a **new project** or **branching DB** with only the baseline + new migrations, then cut traffic — not a hand-edited production `INSERT`.

---

## Timeline

Do **NOT** consolidate until:

- [ ] All pending features are merged (or you accept rebasing/cherry-picking migration-only PRs after cutover).
- [ ] Production has a **recent full backup** (data + schema), tested restore optional but ideal.
- [ ] You have a **maintenance window** (or read-only period) if any replay/repair is needed.
- [ ] **All team members** know the cutover date, new baseline filename, and how CI runs `db push` / `db reset`.

---

## Immediate action (documentation / tagging)

1. **Tag the current migration count in git** (run once at plan adoption):

   ```bash
   git tag migration-baseline-281 HEAD
   ```

2. **Push tags** when ready: `git push origin migration-baseline-281`

3. This consolidation is **planning only** — no requirement to change application code; **`npm run build`** should remain green after adding this doc.

---

## Appendix — Full file list

There are **281** files; listing them all here would go stale. To enumerate locally:

```bash
ls -1 supabase/migrations/*.sql | wc -l
ls -1 supabase/migrations/*.sql | sort | head -5
ls -1 supabase/migrations/*.sql | sort | tail -5
```

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-01 | Initial plan: counts, earliest/latest, last 10 summary, guarded steps. |
