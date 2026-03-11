# Migration checklist — avoid push errors

Before adding or changing migrations, follow these rules so `db push` and out-of-order applies don’t fail.

## 1. Unique version (timestamp) per file

Supabase uses the **numeric prefix** of the filename as the migration version. Two files with the same prefix cause a duplicate key error when the second runs.

- **Rule:** Every file must have a **unique** prefix, e.g. `YYYYMMDDHHMMSS_description.sql`.
- **Check:** Run `npm run db:check-migrations` (or the script below). No two files should share the same prefix.
- **Fix:** Rename one file to a new timestamp (e.g. `…014100_…` instead of `…014000_…`).

## 2. Idempotent object creation

Migrations may run on DBs that already have some objects, or run more than once after repair.

- **Tables:** Use `CREATE TABLE IF NOT EXISTS` (and `CREATE INDEX IF NOT EXISTS`).
- **Views:** Use `DROP VIEW IF EXISTS …` before `CREATE VIEW`.
- **Policies / triggers:** Use `DROP POLICY IF EXISTS` / `DROP TRIGGER IF EXISTS` before `CREATE`.
- **Functions:** Use `CREATE OR REPLACE FUNCTION` where possible.

## 3. View dependency order

You cannot drop a view if another view depends on it.

- **Rule:** When a migration replaces a view that **other views** use (e.g. `v_client_retention_risk` used by `v_coach_review_queue`), **drop the dependent views first**, then the base view, then recreate in reverse order.
- **Example:** Before `DROP VIEW v_client_retention_risk`, add `DROP VIEW IF EXISTS v_coach_review_queue;`.

## 4. Don’t assume columns that might not exist

Some DBs (e.g. older or different migration paths) may not have every column.

- **Rule:** Avoid relying on columns that were added in other migrations or only in some environments (e.g. `clients.full_name`). Prefer columns that exist in the canonical schema (e.g. `clients.name`), or use a pattern that works either way (e.g. `COALESCE(c.name, '')` and avoid `c.full_name` unless that column is guaranteed by an earlier migration in the same chain).

## 5. Quote reserved words

PostgreSQL reserves words like `placing`, `user`, `order`, `check`.

- **Rule:** If a column or identifier is a reserved word, use double quotes: `"placing" TEXT`.

## 6. Refer only to the current shape of depended-on objects

When a migration uses a **view** (e.g. `v_client_retention_risk`), it must match the **current** definition of that view in the codebase.

- **Rule:** If a later migration (e.g. `retention_scores`) changes that view (columns or logic), **every migration that selects from it** must use the new column list and semantics (e.g. `risk_band IN ('at_risk','churn_risk')` and no `last_checkin_at`), not the old one.

## 7. Optional: self-contained “bridge” migrations

If migration B depends on a table created in migration A, but A might not have run on some remotes (e.g. out-of-order push):

- **Option:** In B, use `CREATE TABLE IF NOT EXISTS …` (and indexes/policies) for that table at the top of B so B can run even when A is missing. Prefer this only when you need to support that scenario; otherwise keep dependencies strict and fix order.

## Quick check before push

```bash
# Check for duplicate migration versions
npm run db:check-migrations

# Preview what would be applied
npm run db:push:dry
```

Then run `npm run db:push` (or `db push --include-all`).
