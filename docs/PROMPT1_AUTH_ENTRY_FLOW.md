# PROMPT 1 — Auth entry flow (rebuild)

## Files changed

| File | Change |
|------|--------|
| `src/screens/AuthScreen.jsx` | Rebuilt: single screen with **Log in \| Sign up**, step-based signup, role-aware paths, client coach-code-before-signup, validation, loading/error UI, progress copy (Step N · label; “of M” only when total is known). |

Supporting behavior (unchanged in this prompt, but relied on):

- `src/pages/ClientCode.jsx` — `setPendingInvite` / `getPendingInvite` / `clearPendingInvite` for validated coach codes.
- `src/lib/AuthContext.jsx` — `signUp` with `role`; display name / coach defaults when metadata is minimal.
- `src/lib/supabaseApi.js` — `invokeSupabaseFunction`, `normalizeInviteCode` for `validateInviteCode`.

## Auth flow summary

### Entry

- One route/screen: **tabs** toggle **Log in** and **Sign up** (no separate clutter screens).
- Copy uses **Coach**, **Client** (via coach code), **Personal** — no “athlete” role wording.

### Log in

- Email + password.
- Errors surfaced clearly; loading while auth runs.
- Footer link **“New here with a coach code?”** switches to **Sign up** on the **Client** path (skips code step if a pending validated invite already exists in session).

### Sign up (step-based, mobile-first)

1. **Step 1 — Role**  
   User picks **Coach**, **Client**, or **Personal**.  
   Progress shows e.g. `Step 1 · Choose how you use Atlas` (no misleading “of 2” before role is chosen).

2. **Client only — Step 2 — Coach code**  
   Code is **normalized** and validated via **`validateInviteCode`** before signup is allowed.  
   On success, invite is stored (`setPendingInvite`) and user advances to account step.  
   Progress: `Step 2 of 3 · Coach code`.

3. **Account step**  
   **Coach / Personal:** `Step 2 of 2 · Your account`.  
   **Client:** `Step 3 of 3 · Your account` (only after code validated).  
   Fields: **email + password** only (no display name, goals, or coaching-focus picker on this screen — not required for day one).

### Guards

- **Client** cannot submit signup unless `getPendingInvite()` returns a validated pending invite (defense in depth on submit).
- Deep link: `/auth?mode=signup&account=client` opens **code** step first unless pending invite already exists → then **account** step.
- Optional coach referral: `?ref=` on signup is passed as `referral_code` when role is **Coach** (if supported by `signUp`).

### After auth

- Existing `useEffect` post-auth routing is preserved: complete profile → home; client with pending onboarding → `/clientonboarding`; etc. (no new redirect loops introduced by this screen).

## Verification

- `npm run build` — passes.
