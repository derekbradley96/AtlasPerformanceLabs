# Invite code still failing – find the right project and fix the DB

If you've deployed the RPC, deployed the Edge Function, and still see "Invalid coach code", the live site is almost certainly talking to a Supabase project where **no coach has `referral_code = 'atlas-3034'`**. Follow this to fix it.

---

## Step 1: See which Supabase project the site is using

1. Open **https://atlasperformancelabs.co.uk** and go to the Client access / Coach code page.
2. Open **Developer Tools** (Right‑click → Inspect, or Cmd+Option+I) → **Network** tab.
3. Enter **ATLAS-3034** and click **Continue**.
4. In the Network list, click the request named **validateInviteCode** (or the URL containing `validateInviteCode`).
5. Open the **Response** (or **Preview**) tab for that request.

You should see JSON like:

```json
{ "valid": false, "_debug": { "project": "xxxxxxxxxx" } }
```

The **`_debug.project`** value is the Supabase project ref the site is using (e.g. `qujteojdjxoqrjdpaljs`).  
If you don’t see `_debug`, redeploy the Edge Function and try again.

---

## Step 2: Open that exact project in Supabase

1. Go to **https://supabase.com/dashboard**.
2. Open the project whose ref matches **`_debug.project`** (e.g. `qujteojdjxoqrjdpaljs`).

All of the following steps must be done in **this** project.

---

## Step 3: Test the RPC in that project

1. In that project, go to **SQL Editor**.
2. Run:

```sql
SELECT validate_invite_code('atlas-3034');
```

- If the result is **`{"valid": true, ...}`** → the DB and RPC are correct in this project. Then the site might be calling a different project (double‑check the request URL in Step 1: it should be `https://<that-project-ref>.supabase.co/functions/v1/validateInviteCode`).
- If the result is **`{"valid": false}`** → in **this** project no profile has `referral_code = 'atlas-3034'`. Go to Step 4.

---

## Step 4: Set the coach code in that project

In the **same** project → **SQL Editor**, run (in order):

**4a) List coaches and their codes**

```sql
SELECT id, display_name, role, referral_code, email
FROM public.profiles
WHERE role IN ('coach', 'trainer')
ORDER BY display_name;
```

**4b) Set one coach’s code to `atlas-3034`**

**Easiest (after running the migration that adds the helper):** run this in SQL Editor (replace with the coach’s email):

```sql
SELECT set_coach_invite_code('your-coach@example.com', 'atlas-3034');
```

If that returns `{"ok": true, ...}`, the code is set. If you don’t have the helper, use one of these:

By **profile id** (copy from 4a):

```sql
UPDATE public.profiles
SET referral_code = 'atlas-3034'
WHERE id = 'PASTE-COACH-UUID-HERE';
```

By **email**:

```sql
UPDATE public.profiles
SET referral_code = 'atlas-3034'
WHERE role IN ('coach', 'trainer')
  AND email ILIKE '%your-coach@example.com%';
```

**4c) Confirm**

```sql
SELECT validate_invite_code('atlas-3034');
```

This should return **`{"valid": true, ...}`**.

---

## Step 5: Make sure the site uses this project

The site gets the Supabase URL from **build‑time** env vars.

- If you deploy with **Vercel**:  
  **Vercel** → your project → **Settings** → **Environment Variables** → **Production**  
  Set **VITE_SUPABASE_URL** to:

  `https://<project-ref>.supabase.co`

  where `<project-ref>` is the same as **`_debug.project`** (e.g. `https://qujteojdjxoqrjdpaljs.supabase.co`).  
  Then trigger a **new production deploy** (e.g. redeploy from Vercel or push to the branch that deploys to production).

- If you deploy with **`npm run deploy:web`**:  
  Before running it, ensure **`.env.local`** has **VITE_SUPABASE_URL** set to that same URL. Then run `npm run deploy:web` again so the new build is used.

---

## Checklist

- [ ] Step 1: Read **`_debug.project`** from the validateInviteCode response.
- [ ] Step 2: Open that project in the Supabase dashboard.
- [ ] Step 3: Run `SELECT validate_invite_code('atlas-3034');` there; if `valid: false`, continue.
- [ ] Step 4: In that project, run the UPDATE so one coach has `referral_code = 'atlas-3034'`, then confirm with the SELECT again.
- [ ] Step 5: Set **VITE_SUPABASE_URL** (Vercel Production or `.env.local`) to that project’s URL and redeploy.

After that, try **ATLAS-3034** again on the live site.
