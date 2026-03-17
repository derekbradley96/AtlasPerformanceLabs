# Invite code – apply changes and verify

Use this when client code entry still shows "Invalid coach code" so you can confirm everything is applied and find the cause.

**Still failing after deploy?** Usually the coach’s row in the DB has no `referral_code` or a different value. Do this:

1. **Vercel** → your project → **Settings** → **Environment Variables**. Ensure **Production** has `VITE_SUPABASE_URL` = `https://qujteojdjxoqrjdpaljs.supabase.co` (or your project URL). If it points to another project, the code is validated against a different database.
2. **Supabase** (that same project) → **SQL Editor**. Run the statements in **`docs/INVITE_CODE_FIX_ATLAS_3034.sql`**: list coaches (step 1), then run one of the UPDATEs (step 2) so a coach has `referral_code = 'atlas-3034'`, then confirm (step 4).

3. Validation now uses a **DB RPC** (`validate_invite_code`). After changing code, run **`npm run db:push`** (or `npx supabase db push --include-all`) to apply the migration that adds the RPC, then **`npm run deploy:validate-invite`** to deploy the Edge Function that calls it.

## 1. Apply all code and backend

```bash
# Install deps (if you pulled new code)
npm install

# Build so frontend uses latest normalizer + API calls
npm run build

# Deploy the Edge Function that validates the code (required)
npm run deploy:validate-invite
# or: npx supabase functions deploy validateInviteCode
# If your project is linked: npx supabase functions deploy validateInviteCode --project-ref YOUR_PROJECT_REF
```

Then deploy the **web app** so production uses the new build (e.g. Vercel):

```bash
# If you use Vercel CLI
vercel --prod
# or push to your main branch if CI deploys
```

For **mobile**, after building and deploying web, sync native so the app loads the new bundle:

```bash
npm run build
npx cap sync ios
# or npx cap sync android
```

---

## 2. Confirm the coach’s code in the database

The client must enter the **exact** code stored in `profiles.referral_code` (case doesn’t matter; the app normalizes to lowercase).

**In Supabase Dashboard:**

1. **Table Editor** → **profiles**
2. Find the coach’s row (e.g. by email or display name)
3. Check **referral_code** – it should look like `atlas-3034` (lowercase `atlas-` plus 4 hex characters). No spaces, no different prefix.

**Or run SQL (SQL Editor):**

```sql
-- List coaches and their invite codes
SELECT id, display_name, role, referral_code, email
FROM public.profiles
WHERE role IN ('coach', 'trainer')
ORDER BY created_at DESC;
```

If `referral_code` is **NULL** for your coach, set it:

```sql
-- Replace YOUR_COACH_PROFILE_ID with the coach’s profiles.id (UUID)
UPDATE public.profiles
SET referral_code = 'atlas-3034'   -- use the code you want, e.g. atlas-3034
WHERE id = 'YOUR_COACH_PROFILE_ID'
  AND referral_code IS NULL;

-- Ensure it’s unique
SELECT referral_code, COUNT(*) FROM public.profiles WHERE referral_code IS NOT NULL GROUP BY referral_code HAVING COUNT(*) > 1;
-- Should return no rows.
```

Codes are normally created by the `generate_referral_code()` trigger; if that didn’t run or was added later, the update above fixes it.

---

## 3. Confirm the app is calling the right backend

- **Web:** The site must use the same Supabase project as where you ran the SQL. Check **Vercel (or your host)** env: `VITE_SUPABASE_URL` = `https://<that-project>.supabase.co`.
- **Local:** In `.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for that same project.
- **Mobile:** Same as web: build is created with the same `VITE_*` vars, so the app talks to that Supabase project.

---

## 4. Check the request/response in the browser

1. Open the **Client access** (invite code) page.
2. Open **DevTools** → **Network**.
3. Enter the coach code (e.g. `ATLAS-3034`) and tap **Continue**.
4. Find the request to **validateInviteCode** (POST to `https://<project>.supabase.co/functions/v1/validateInviteCode`).

**Request:**  
- Body should be JSON: `{"code":"atlas-3034"}` (lowercase, because we normalize before sending).  
- If you still see uppercase or different spelling, the new frontend isn’t deployed or the build isn’t the one loading.

**Response:**  
- **200** with `{"valid":true,...}` → code is valid; if the UI still shows "Invalid coach code", the issue is in the client handling the response.  
- **200** with `{"valid":false}` → no row matched; confirm in the DB that this coach has that exact `referral_code` (e.g. `atlas-3034`).  
- **4xx/5xx** → check response body and Supabase Edge Function logs (Dashboard → Edge Functions → validateInviteCode → Logs).

---

## 5. Optional: dev console log

In development, the app logs invite-code requests and responses so you can confirm what’s sent and received. Run:

```bash
npm run dev
```

Open the **Client access** page, enter a code, submit, and check the **browser console** for lines like:

- `[Invite code] request: { code: "atlas-3034" }`
- `[Invite code] response: { valid: true, ... }` or `{ valid: false }`

That confirms normalization and the function result.

---

## Quick checklist

- [ ] `npm run build` and deploy web (e.g. Vercel) so production serves the latest build.
- [ ] `npx supabase functions deploy validateInviteCode` so the Edge Function uses the latest logic.
- [ ] In Supabase, the coach’s `profiles.referral_code` is set (e.g. `atlas-3034`) and matches what the client types (case doesn’t matter).
- [ ] `VITE_SUPABASE_URL` in the environment points to the same Supabase project where you checked/updated `referral_code`.
- [ ] Network tab: POST to `validateInviteCode` shows body `{"code":"atlas-3034"}` and you’ve checked the response and Edge Function logs if it’s still invalid.
