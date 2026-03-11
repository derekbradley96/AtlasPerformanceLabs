# Migration push: "inserted before the last migration on remote"

## What happened

`supabase db push` compares **local** `supabase/migrations/*.sql` with the remote **`schema_migrations`** (or equivalent) table. If the remote already has a **newer** migration applied, but your repo still has **older** migration files that were never applied on that remote, the CLI refuses to push without an explicit flag—otherwise history would look inconsistent.

## Fix

Apply pending migrations and record them in order:

```bash
npm run db:push
```

Or directly:

```bash
npx supabase db push --include-all
```

Non-interactive / CI:

```bash
npx supabase db push --include-all --yes
```

Preview only:

```bash
npx supabase db push --include-all --dry-run
```

## If push fails (already applied manually)

If objects already exist (e.g. "relation already exists"), either:

1. Mark the migration as applied without re-running SQL:
   ```bash
   npx supabase migration repair --status applied <timestamp>
   ```
   Use the migration version string as shown in `supabase migration list`.

2. Or fix the migration to use `IF NOT EXISTS` / idempotent patterns so re-run is safe.

## Duplicate migration version (schema_migrations_pkey)

Supabase stores **one row per version** (the numeric prefix of the filename). If two files share the same prefix, e.g.:

- `20250306140000_referrals.sql`
- `20250306140000_rls_use_coach_id.sql`

the second push fails with:

`duplicate key value violates unique constraint "schema_migrations_pkey" ... Key (version)=(20250306140000) already exists`

**Fix:** Rename one file so the prefix is unique (e.g. `20250306140100_rls_use_coach_id.sql`). Order is by version; place the new timestamp after the migration it must follow.

## Avoiding repeat issues

- **Before adding migrations:** Read `supabase/MIGRATION_CHECKLIST.md` and run `npm run db:check-migrations` to catch duplicate versions and common pitfalls.
- Always push from the same branch/state that matches what was applied on remote.
- Avoid applying SQL manually on production without a matching file in `supabase/migrations/`.
- Prefer one migration chain per environment; use `migration repair` when history diverges.
