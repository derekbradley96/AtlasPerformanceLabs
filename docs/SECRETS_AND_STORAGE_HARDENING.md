# Secrets and storage hardening pass

Summary of the repo-wide secrets and storage hardening: what was found, what was fixed, and what to do next.

---

## 1. Findings

### 1.1 Env usage

- **`.env` / `process.env` / `import.meta.env`:**
  - **Vite client:** All client-visible config uses `import.meta.env` (Vite inlines only `VITE_*` at build time). Used for: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_MODE`, `VITE_DEV_ANALYTICS_LOG`, `VITE_BUILD_DEBUG`, and `import.meta.env.DEV` for dev-only branches.
  - **vite.config.js:** Uses `process.env` and `loadEnv()` to read Supabase URL/key for build; fails build with a clear warning if missing (when not in test mode).
  - **Edge Functions:** Use `Deno.env.get("SUPABASE_URL")`, `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, `Deno.env.get("STRIPE_SECRET_KEY")`, etc. Server-side only; no service keys in client bundle.
- **No committed secrets in app code.** Only `SUPABASE_SETUP.md` had a real-looking anon key and wrong URL example → **redacted** to placeholders.

### 1.2 localStorage / sessionStorage / Capacitor

- **localStorage:** Used for UI prefs, role persistence, demo/sandbox state, coach/client notes (semi-sensitive), and various “dismissed”/“understood” flags. See **SECURITY_NOTES.md** for full classification.
- **sessionStorage:** Used for short-lived handoff (e.g. invite code + trainer id, lead checkout pending). Cleared when tab closes or after use.
- **Capacitor Preferences:** Used via `@/lib/persistence/storage.js` on native; same logical keys as localStorage. AuthContext clears both on logout.

### 1.3 Sensitive or security-relevant

- **Coach notes / client notes** in `clientDetailStorage.js`: Stored in localStorage; not encrypted. Classified as semi-sensitive; documented in SECURITY_NOTES.md with a recommendation to move to server-backed storage in production. Code comment added.
- **Lead checkout pending** (uid, name, email) in sessionStorage: Short-lived; cleared in LeadCheckoutSuccess. Documented.
- **Auth:** No manual persistence of auth tokens outside Supabase Auth; we only clear our own keys on logout.

### 1.4 Accidental commits / secrets to rotate

- **SUPABASE_SETUP.md:** Contained a **real Supabase anon key** (JWT) and an incorrect example URL. These have been **redacted** in the repo. Because the anon key was committed in the past:
  - **Rotate the Supabase anon key** in Dashboard → Project Settings → API: create a new anon (public) key and revoke or deprecate the old one. Update `.env.local` (and any CI/deploy env) with the new key.
- **supabase/.temp/:** Contains `pooler-url` and `project-ref` (project reference and DB URL). These are local CLI artifacts. **supabase/.temp/** has been added to `.gitignore`. If they were ever committed:
  - **Rotate** the database password if the pooler URL was ever in history, and ensure `.temp` is not in any remote branch. Prefer `supabase db pull` / linking so secrets stay out of the repo.

---

## 2. Fixes applied

| Change | File(s) |
|--------|---------|
| Redact real key and wrong URL example | `SUPABASE_SETUP.md` |
| Add env and secrets ignore rules | `.gitignore` |
| Ignore Supabase CLI temp (project ref, URLs) | `.gitignore` (supabase/.temp/) |
| Add env template without real values | `.env.example` (new) |
| Startup check when `VITE_APP_MODE=real` | `src/lib/envGuard.js` (new), `src/main.jsx` |
| Document device storage and rules | `SECURITY_NOTES.md` (new) |
| Note semi-sensitive notes storage | `src/lib/clientDetailStorage.js` (comment) |

---

## 3. Files changed

- `.gitignore` – env/secrets and supabase/.temp/
- `.env.example` – new template
- `SUPABASE_SETUP.md` – redacted key and URL
- `src/lib/envGuard.js` – new
- `src/main.jsx` – use envGuard, show config error when required env missing
- `src/lib/clientDetailStorage.js` – comment re server-backed notes
- `SECURITY_NOTES.md` – new (env, device storage, what we do not store)
- `docs/SECRETS_AND_STORAGE_HARDENING.md` – this file

---

## 4. Secrets to rotate now

1. **Supabase anon key**  
   The anon key that appeared in `SUPABASE_SETUP.md` should be treated as exposed. In Supabase Dashboard → Project Settings → API: generate a new anon (public) key, update `.env.local` and any deploy/CI env, then revoke or stop using the old key.

2. **Supabase DB password / pooler URL** (if `supabase/.temp/` was ever committed)  
   If `supabase/.temp/` (e.g. `pooler-url`, `project-ref`) was ever pushed: rotate the database password for the project and ensure no secrets remain in repo history. `.gitignore` now prevents future commits of `.temp/`.

---

## 5. Storage items that are still acceptable client-side

- **Safe UI prefs:** Role, checklist dismissed, client code (pre-fill), dismissals, exercise recent/favorites, program advanced mode, trainer preferences, checkin reviewed flags, crash log buffer (dev).
- **Operational / low sensitivity:** Pending invite/trainer in sessionStorage (short-lived), lead checkout pending in sessionStorage (cleared after use), coach/client notes and “marked paid” with caveat (see SECURITY_NOTES.md—prefer server for notes in production).
- **Admin/dev only:** Admin impersonation, coach focus override, fake session, demo mode (DEV-only paths).

All of the above are documented in **SECURITY_NOTES.md** with the rationale and, where relevant, the caveat to move notes to server-backed storage in production.
