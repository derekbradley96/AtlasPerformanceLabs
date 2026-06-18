# Atlas Performance Labs — Launch Runbook

**Generated:** 2026-06-13  
**Status:** Code complete, doctor ✓, assets generated, legal pages updated.  
This document covers every step from current state to live on App Store + Google Play.

---

## At a glance

| Step | Status | Who |
|------|--------|-----|
| Code + tests | ✅ Done | — |
| App icons (RGB, no alpha) | ✅ Done | — |
| Android/iOS splash screens | ✅ Done | — |
| Google Play feature graphic | ✅ Done → `public/store-assets/` | — |
| Privacy Policy | ✅ Done (fill in company reg) | You |
| Terms of Service | ✅ Done | — |
| Supabase project & API keys | ✅ Exists | — |
| Supabase migrations pushed | ⚠️ Needs confirmation | You |
| Supabase edge functions deployed | ⚠️ Needs confirmation | You |
| Supabase auth redirect URLs | ⚠️ Needs configuration | You |
| Stripe account | ❌ Not created | You |
| App Store screenshots (6.7") | ❌ Not generated | You |
| Google Play screenshots | ❌ Not generated | You |
| iOS build (Xcode) | ❌ Not built | You |
| Android build (Android Studio) | ❌ Not built | You |

---

## 1. Privacy Policy — fill in company details

Edit `src/pages/marketing/PrivacyPolicyPage.jsx` and replace the two placeholders:

```
[REGISTERED OFFICE ADDRESS — update before launch]
[COMPANY NUMBER — update before launch]
```

These are required for App Store approval and UK legal compliance.

---

## 2. Supabase migrations

Your Supabase project is at `db.qujteojdjxoqrjdpaljs.supabase.co`.

**Check if migrations have already been pushed:**
```bash
npx supabase db push --include-all --dry-run --yes
```
Review the dry-run output. If it shows pending migrations, push them:

```bash
npm run db:push
# or:
npx supabase db push --include-all --yes
```

> ⚠️ **Back up first.** In Supabase Dashboard → Settings → Database → Backups.
> The first migration (`canonical_schema`) may conflict if those tables already exist —
> all migrations use `CREATE TABLE IF NOT EXISTS` so they are idempotent.

**Verify the migration ran correctly** — open the Supabase Table Editor and confirm these tables exist:
- `profiles`, `clients`, `organisations`, `organisation_members`
- `message_threads`, `message_messages`
- `program_blocks`, `program_weeks`, `program_days`
- `coach_subscription_tiers`, `client_subscriptions`, `client_payments`
- `contest_preps`, `pose_check_items`, `peak_week_protocols`

---

## 3. Supabase edge functions — deploy all

```bash
# Deploy every edge function at once:
npx supabase functions deploy --project-ref qujteojdjxoqrjdpaljs

# Or deploy individually:
npx supabase functions deploy stripe-webhook --project-ref qujteojdjxoqrjdpaljs
npx supabase functions deploy validateInviteCode --project-ref qujteojdjxoqrjdpaljs
npx supabase functions deploy send-welcome-email --project-ref qujteojdjxoqrjdpaljs
# ... etc for all functions in supabase/functions/
```

**Set edge function environment variables** (Supabase Dashboard → Edge Functions → Manage secrets, or via CLI):

```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  RESEND_API_KEY="re_..." \
  CRON_SECRET="<random 32 chars>" \
  INTERNAL_WEBHOOK_SECRET="<random 32 chars>" \
  --project-ref qujteojdjxoqrjdpaljs
```

Generate random secrets: `openssl rand -base64 32`

---

## 4. Supabase auth configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| Site URL | `https://atlasperformancelabs.co.uk` |
| Redirect URLs | `https://atlasperformancelabs.co.uk/auth/callback` |
|               | `capacitor://localhost/auth/callback` |
|               | `com.atlasperformancelabs.app://auth/callback` |

The `capacitor://` scheme is required for email confirm links to open the native app on iOS.
The `com.atlasperformancelabs.app://` scheme is required for Android deep links.

---

## 5. Stripe setup

### 5a. Create account
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → Create account.
2. Complete business verification (UK business, required for payouts).

### 5b. Get API keys (Dashboard → Developers → API Keys)

| Key | Where to add |
|-----|-------------|
| Publishable key (`pk_live_...`) | `.env.local` → `VITE_STRIPE_PUBLISHABLE_KEY` |
| | Vercel Dashboard → Environment Variables → `VITE_STRIPE_PUBLISHABLE_KEY` |
| Secret key (`sk_live_...`) | Supabase edge function secrets → `STRIPE_SECRET_KEY` |
| | Vercel Dashboard → `STRIPE_SECRET_KEY` (for server-side API routes if used) |

### 5c. Webhook endpoint

1. Stripe Dashboard → Webhooks → Add endpoint.
2. **Endpoint URL:** `https://qujteojdjxoqrjdpaljs.supabase.co/functions/v1/stripe-webhook`
3. **Events to listen for:**
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `account.updated` (for Stripe Connect coach payouts)
4. After creating, copy the **Signing secret** (`whsec_...`).
5. Add it to Supabase edge function secrets: `STRIPE_WEBHOOK_SECRET=whsec_...`

### 5d. Stripe Connect (coach payouts)

Atlas uses Stripe Connect Express for coaches to receive payments from clients.

1. Stripe Dashboard → Connect → Settings → Enable Express accounts.
2. Set platform name to "Atlas Performance Labs".
3. Upload your business logo.
4. The `stripe-connect-link` edge function handles the OAuth flow — no extra code needed.

### 5e. Test before going live

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks locally for testing
stripe listen --forward-to https://qujteojdjxoqrjdpaljs.supabase.co/functions/v1/stripe-webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

---

## 6. Vercel environment variables

In [Vercel Dashboard](https://vercel.com) → Project → Settings → Environment Variables, ensure these are set for **Production**:

```
VITE_SUPABASE_URL          ✅ Already set
VITE_SUPABASE_ANON_KEY     ✅ Already set
VITE_STRIPE_PUBLISHABLE_KEY  ❌ Add: pk_live_...
VITE_GLITCHTIP_DSN          ✅ Already set
VITE_POSTHOG_KEY            (optional, add if you want analytics)
STRIPE_SECRET_KEY           ❌ Add: sk_live_...
STRIPE_WEBHOOK_SECRET       ❌ Add: whsec_...
SUPABASE_SERVICE_ROLE_KEY   ✅ Already set
```

Redeploy after adding: `npx vercel --prod` or push to git.

---

## 7. iOS build (Xcode)

### Prerequisites
- Mac with Xcode 15+ installed
- Apple Developer account ($99/year)
- App ID registered: `com.atlasperformancelabs.app`

### Steps

```bash
# 1. Build the web app and sync to iOS
npm run cap:sync:ios

# 2. Open in Xcode
open ios/App/App.xcodeproj
```

In Xcode:
1. Select your team (Signing & Capabilities → Team).
2. Set Bundle Identifier to `com.atlasperformancelabs.app`.
3. Set Version to `1.0.0`, Build to `1`.
4. **Product → Archive** to create a release build.
5. **Distribute App → App Store Connect**.

**Before archiving — check:**
- [ ] App icon shows correctly (no alpha, dark background ✅ done)
- [ ] Splash screen displays
- [ ] Build number incremented from any previous submission

**App Store Connect** ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)):
- Create a new app with bundle ID `com.atlasperformancelabs.app`
- Fill in the metadata from `docs/APP_STORE_LISTING.md`
- Upload screenshots (see section 9 below)
- Add Privacy Policy URL: `https://atlasperformancelabs.co.uk/privacy`
- Add Support URL: `https://atlasperformancelabs.co.uk`
- Submit for review

---

## 8. Android build (Android Studio)

### Prerequisites
- Android Studio installed
- Google Play Console account ($25 one-time)

```bash
npm run cap:sync:android
# Then: open Android Studio
# android/ directory is the Android project
```

In Android Studio:
1. **Build → Generate Signed Bundle/APK → Android App Bundle (.aab)**.
2. Create or use existing signing keystore — **save the keystore file and passwords safely, you cannot recover them**.
3. Select **release** build variant.
4. Upload the `.aab` to Google Play Console → Create new app → Production.

**Google Play Console:**
- App name: Atlas Performance Labs
- Category: Health & Fitness
- Content rating: complete the questionnaire (suitable for 13+)
- Privacy Policy URL: `https://atlasperformancelabs.co.uk/privacy`
- Feature graphic: `public/store-assets/google-play-feature-graphic.png` ✅ done
- Icon: `public/store-assets/google-play-icon-512.png` ✅ done
- Short description and full description from `docs/APP_STORE_LISTING.md`

---

## 9. Screenshots (both stores)

Screenshots must be taken from a real device or simulator with real data. The app must be fully configured (Supabase connected) to show real content.

### iOS — required sizes
| Size | Device | Dimensions |
|------|--------|-----------|
| 6.7" (required) | iPhone 15 Pro Max | 1290 × 2796px |
| 6.5" (required) | iPhone 14 Plus | 1242 × 2688px |
| 12.9" iPad (required if tablet support) | iPad Pro | 2048 × 2732px |

**Screens to capture (from `docs/APP_STORE_LISTING.md`):**
1. Coach home — "Your daily coaching command centre"
2. Workout player — "Per-set targets, your actuals beside them"
3. Barcode scanner — "Scan any barcode — free, always"
4. Nutrition ring — "Interpreted macros — not raw numbers"
5. Pose library — "Competition prep built in"
6. Progress photos — "Before/after comparison"

**On iOS simulator:**
```bash
# Boot iPhone 15 Pro Max simulator
xcrun simctl boot "iPhone 15 Pro Max"
# Take screenshots: Cmd+S in Simulator, or use simctl
xcrun simctl io booted screenshot screenshot.png
```

### Android — required sizes
Minimum 2 screenshots, 16:9 or 9:16, at least 320px on shortest side.
1080 × 1920px works for all phones.

---

## 10. Run doctor before every release

```bash
node scripts/doctor.js
```

Must output **All checks passed** before submitting to either store.

---

## 11. Stripe test checklist (before going live)

- [ ] Create a test coach account → click "Set up payouts" → Stripe Connect flow completes
- [ ] Create a test client → assign coaching plan → checkout session opens in Stripe
- [ ] Complete checkout with Stripe test card `4242 4242 4242 4242`
- [ ] Webhook fires → `client_subscriptions` row appears in Supabase
- [ ] Coach dashboard shows revenue updated
- [ ] Test failed payment: card `4000 0000 0000 0002` → overdue status shows in coach billing view

---

## 12. Pre-launch checklist

### Code
- [ ] `node scripts/doctor.js` passes (Lint, TypeScript, 259 tests, Build, grep scan)
- [ ] Grep for `TODO`, `FIXME`, `placeholder` in src: `grep -r "TODO\|FIXME\|placeholder" src/`
- [ ] No `console.log` leaks in production build

### Legal
- [ ] Privacy Policy: company registration number and address filled in
- [ ] Privacy Policy URL live: `https://atlasperformancelabs.co.uk/privacy`
- [ ] Terms URL live: `https://atlasperformancelabs.co.uk/terms`

### Accounts / backend
- [ ] Supabase migrations pushed (`npx supabase db push --include-all --yes`)
- [ ] All edge functions deployed
- [ ] Edge function secrets set (Stripe, Resend, CRON_SECRET, INTERNAL_WEBHOOK_SECRET)
- [ ] Auth redirect URLs configured (atlasperformancelabs.co.uk + capacitor://)
- [ ] Stripe live keys in Vercel + Supabase secrets
- [ ] Stripe webhook endpoint active
- [ ] Stripe Connect enabled

### iOS App Store
- [ ] Bundle ID `com.atlasperformancelabs.app` registered in Apple Developer
- [ ] App icon: no alpha ✅ done
- [ ] All screenshot sizes uploaded (6.7" required)
- [ ] Metadata complete (from `docs/APP_STORE_LISTING.md`)
- [ ] Privacy Policy URL added in App Store Connect
- [ ] Build archived and uploaded via Xcode

### Google Play
- [ ] Signing keystore created and backed up securely
- [ ] Feature graphic uploaded ✅ `public/store-assets/google-play-feature-graphic.png`
- [ ] App icon uploaded ✅ `public/store-assets/google-play-icon-512.png`
- [ ] Content rating completed
- [ ] 2+ screenshots uploaded
- [ ] Privacy Policy URL added

---

## Quick reference: useful commands

```bash
# Run all health checks
node scripts/doctor.js

# Push DB migrations (dry-run first)
npx supabase db push --include-all --dry-run --yes
npx supabase db push --include-all --yes

# Deploy all edge functions
npx supabase functions deploy --project-ref qujteojdjxoqrjdpaljs

# Set Supabase edge function secrets
npx supabase secrets set STRIPE_SECRET_KEY="sk_live_..." STRIPE_WEBHOOK_SECRET="whsec_..." --project-ref qujteojdjxoqrjdpaljs

# Build + sync iOS
npm run cap:sync:ios && open ios/App/App.xcodeproj

# Build + sync Android
npm run cap:sync:android

# Deploy web to Vercel
npm run deploy:web

# Generate random secret
openssl rand -base64 32
```
