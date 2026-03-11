# Atlas Performance Labs – AI / Cursor prompt rules

Use this block for all prompts when working in this repo.

---

## Rule for every task

**If anything is wrong or unclear in the user’s prompt, correct it for what we are doing and for all prompts coming.**

Before implementing:

1. Align the request with this repo: stack (React, Vite, Capacitor, Supabase), existing patterns (single Supabase client, React Router, roles/guards), and file layout.
2. Fix or clarify the prompt (table names, column names, ownership model, output format) so the result doesn’t conflict with existing code or conventions.
3. Then implement. Do not introduce a second Supabase client, Expo, or other stack mismatches.

This keeps additions consistent and avoids confusion or breakage.

---

You are working in the **Atlas Performance Labs** repo.

**Tech stack**
- **Frontend:** React (JSX); primary UI is `.jsx`. Some data/theme files are TypeScript (`.ts`/`.tsx`).
- **Build:** Vite.
- **Mobile:** Capacitor (iOS/Android). No Expo, no React Native.
- **Backend:** Supabase (Postgres, Auth, RLS, Storage). Reuse the existing Supabase client and env (e.g. `@/lib/supabaseClient`).
- **Routing:** React Router (`react-router-dom`). App uses HashRouter on Capacitor and BrowserRouter on web; route paths are the same.

**Rules**
1. **No Expo or React Native.** This is a Vite + Capacitor app.
2. **Reuse existing Supabase setup.** Do not add a second client or change the existing client pattern.
3. **Database changes:** Add new migration files under `supabase/migrations/`. Use the existing naming: `YYYYMMDDHHMMSS_short_description.sql`. Prefer `DROP POLICY IF EXISTS` / `CREATE POLICY` for RLS so migrations are idempotent.
4. **Routing:** Use React Router only (Route, Routes, Navigate, useNavigate, useParams, Outlet, etc.). Do not introduce another router.
5. **Scope of changes:** Only change or create files that are needed for the task. Avoid broad refactors or renaming unrelated code.
6. **TypeScript:** The repo has some `.ts`/`.tsx` (e.g. `useData.ts`). Prefer JSX (`.jsx`) for new UI unless the file or feature is already TypeScript. Do not add TypeScript to existing JSX-only modules unless required.
7. **After changes:** Run `npm run build` and fix any errors. Respect existing lint/typecheck; do not disable them without good reason.

**Roles / auth**
- Canonical roles: coach (trainer), client, personal (solo). Guards use `Roles.COACH`, `Roles.CLIENT`, `Roles.PERSONAL`, `Roles.ADMIN` from `@/lib/roles`. Route protection uses `RequireRole` and `allow={[Roles.COACH]}`, etc. Coach focus: `transformation` | `competition` | `integrated`.

**When you’re done, provide**
- **Files changed** (list paths).
- **Migrations** (if any): path and a short description or key SQL.
- **Key code snippets** (only what’s necessary to understand the change).
- **How to test** (short steps: build, then 2–4 manual checks).

---
