# Security notes – Atlas Performance Labs

Quick reference for secrets, env, and device storage. See also **SECURITY_AUDIT.md** for RLS and Edge Function hardening.

---

## 1. Env and secrets

- **Client (Vite):** Only `VITE_*` vars are inlined at build time. Use **only**:
  - `VITE_SUPABASE_URL` – Supabase project URL (public).
  - `VITE_SUPABASE_ANON_KEY` – Supabase anon (public) key; RLS and Edge Function auth protect data.
- **Never** in client code: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FCM_SERVER_KEY`, or any other secret.
- **Server / Edge Functions:** Secrets are provided via Supabase secrets or env (e.g. `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`). Never commit `.env`, `.env.local`, or real keys; use `.env.example` as template.

---

## 2. Data intentionally stored on device

Auth is handled by **Supabase Auth**: session and tokens live in Supabase’s persisted session (e.g. localStorage under keys Supabase controls). We do **not** manually persist auth tokens; we only clear our own keys on logout.

Below: what **we** store in **localStorage**, **sessionStorage**, or **Capacitor Preferences**, and why.

### 2.1 Safe UI / preferences (acceptable client-side)

| Key / store | What | Why |
|-------------|------|-----|
| `atlas_role`, `atlas_solo` | Last selected role (coach/personal) for UX | Restore tab after reload; canonical roles only. |
| `client_checklist_dismissed` | Boolean: onboarding checklist dismissed | Avoid re-showing. |
| `atlas_client_code` | Last entered invite code (trimmed) | Pre-fill on client signup flow. |
| `atlas_*_dismissed`, `*_understood` | Dismissals / “got it” flags for UI | No PII. |
| Exercise picker recent/favorites, program advanced mode, trainer preferences | UI state and non-sensitive preferences | Better UX; no secrets. |
| `checkin_reviewed_*`, `checkin_reviewed_at_*` | Which check-ins were marked reviewed (client UI) | Operational; not PII. |
| Crash log buffer (`atlas_crash_log`) | Last error message/stack for dev overlay | Dev/demo only; cleared on reset. |

### 2.2 Operational, low sensitivity (acceptable with caveats)

| Key / store | What | Why | Caveat |
|-------------|------|-----|--------|
| `atlas_client_notes_*`, `atlas_coach_notes_*` | Per-client quick notes and coach notes | Offline/cache before sync. | **Semi-sensitive.** Prefer moving to server (e.g. `client_notes` table) and syncing; if kept local, document that they are not encrypted. |
| `atlas_client_paid_*` | “Marked paid” override (demo/mock) | Display only. | Only affects UI; not payment source of truth. |
| `atlas_pending_invite_code`, `atlas_pending_trainer_id` | sessionStorage: invite code + trainer id between screens | Short-lived; cleared after auth. | sessionStorage cleared when tab closes; acceptable. |
| `lead_checkout_pending` | sessionStorage: uid, name, email for checkout success | One-screen handoff. | PII but short-lived; cleared in LeadCheckoutSuccess. |
| Demo/sandbox: seed clients, fake session, plan tier, Stripe Connect “connected” | Demo and dev only | Local demo without backend. | Only when not using real Supabase; cleared on logout. |

### 2.3 Admin / dev only (never in production for normal users)

| Key / store | What | Why |
|-------------|------|-----|
| `atlas_admin_impersonate`, `atlas_admin_coach_focus_override` | Admin role/focus override for testing | Only for configured admin email; dev panel. |
| `atlas_fake_session`, `atlas_demo_mode` | Fake session for local demo | DEV-only paths; not used in production auth flow. |

### 2.4 What we do **not** store on device

- **Auth tokens:** Supabase Auth stores its own session; we do not copy access/refresh tokens into our keys.
- **Service role key or Stripe secret:** Never in client.
- **Passwords:** Never stored; Supabase Auth handles sign-in.

---

## 3. Storage adapters

- **Web:** `localStorage` and `sessionStorage` (same-origin).
- **Native (Capacitor):** `@/lib/persistence/storage.js` uses **Capacitor Preferences** on native and localStorage on web. Same keys as above; used for role, fake session, and clear-on-logout keys so native and web behave consistently.
- **Clear on logout:** `clearAuthStorage()` and `clearAuthStoragePreferences()` in `AuthContext.jsx` remove role, fake session, demo mode, admin impersonation, and related keys from both localStorage and Preferences.

---

## 4. If you add new client-side storage

- Prefer **server-backed** data for anything that is PII or coaching content (e.g. notes, messages).
- If it must be local: use a key prefixed with `atlas_` and document it in this file under 2.1 or 2.2.
- Do **not** store secrets, tokens, or unencrypted sensitive PII in localStorage/sessionStorage/Preferences unless strictly necessary and documented.
