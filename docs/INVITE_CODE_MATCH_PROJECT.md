# Invite code: site and SQL must use the same Supabase project

You ran `set_coach_invite_code('derek@comp.co.uk', 'atlas-3034')` in Supabase and got **ok: true** — so that project now has a coach with `referral_code = 'atlas-3034'`.

The live site (atlasperformancelabs.co.uk) still shows "Invalid coach code" when it is **calling a different Supabase project** that does not have that code set.

## Fix in 3 steps

### 1. See which project the site uses

After deploying the latest app, open the Coach code page. At the bottom you should see:

**"This site uses Supabase project: xxxxxxxxxx"**

That is the project ref the site is using (baked in at build time from `VITE_SUPABASE_URL`).

### 2. See which project you ran the SQL in

In Supabase dashboard, open the project where you ran `set_coach_invite_code` and it returned ok. Look at the URL:

`https://supabase.com/dashboard/project/XXXXXXXXXX/...`

The **XXXXXXXXXX** part is that project’s ref. It must be the **same** as the one shown on the Coach code page.

### 3. Point the site at that project and redeploy

- Go to **Vercel** → your project (e.g. atlas-performance-labs-tuzn) → **Settings** → **Environment Variables**.
- For **Production**, set **VITE_SUPABASE_URL** to:
  `https://XXXXXXXXXX.supabase.co`
  where **XXXXXXXXXX** is the project ref from step 2 (the one where the SQL succeeded).
- Trigger a **new production deploy** (e.g. **Deployments** → … → Redeploy, or push to main).  
  The site only picks up env vars when it **builds**, so a redeploy is required.

After the new deploy, the Coach code page will use that project and **ATLAS-3034** should validate.

---

**Note:** The manual `UPDATE ... WHERE id = '5babfee1-...'` returning "No rows returned" usually means that UPDATE was run in a **different** project (one that doesn’t have that profile id). You don’t need that UPDATE if `set_coach_invite_code` already returned ok in the project you want the site to use.
