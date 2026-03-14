# Security headers and delivery (Vite + Vercel + Capacitor)

Secure HTTP headers and navigation rules for the web app and native shells.

---

## 1. Headers (Vercel – web delivery only)

Set in **`vercel.json`** and applied to all responses when the app is **served from Vercel** (browser). They do **not** apply to the Capacitor native app, which loads from `capacitor://localhost` or a dev server; native security is governed by `allowNavigation` and the packaged content.

| Header | Value | Purpose |
|--------|--------|--------|
| **Content-Security-Policy** | See below | Restrict script, style, connect, frame sources. |
| **X-Frame-Options** | `DENY` | Prevent the app from being embedded in iframes (clickjacking). |
| **X-Content-Type-Options** | `nosniff` | Disable MIME sniffing. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Limit referrer sent to other origins. |
| **Permissions-Policy** | `camera=(self), microphone=(), geolocation=(), payment=(self)` | Restrict camera to same origin; disable mic/geolocation; payment to self. |

### CSP (final policy)

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://*.atlasperformancelabs.com;
frame-src https://www.youtube.com https://youtube.com https://youtu.be;
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

### Allowed for a reason

- **style-src 'unsafe-inline'** – Many components and `index.html` use inline styles. Removing this would require moving styles to stylesheets or nonces.
- **img-src https:** – Supabase storage and other external images (e.g. avatars, exercise media) load from HTTPS URLs.
- **connect-src** – Supabase API and Realtime (`*.supabase.co`), and our own deployments (`*.vercel.app`, `*.atlasperformancelabs.com`).
- **frame-src** – YouTube embeds only (exercise demo modal). Stripe Checkout is a **top-level redirect**, not an iframe, so Stripe is not in `frame-src`.

### Not included (by design)

- **Stripe in CSP** – Checkout uses `window.location.href` to `https://checkout.stripe.com`. That is top-level navigation, not a fetch or frame, so no Stripe entries in `connect-src` or `frame-src` on the web app. Native: see Capacitor `allowNavigation` below.
- **upgrade-insecure-requests** – Omitted to avoid breaking local or mixed-content scenarios. Enable only if the app is always served over HTTPS and you have verified no mixed content.

---

## 2. Report-only CSP (optional)

To test a stricter CSP without enforcing it, you can add a **report-only** policy in `vercel.json` (separate from the enforcing one):

```json
{ "key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; report-uri https://your-csp-report-endpoint.example.com/csp" }
```

Use a reporting endpoint (e.g. report-uri.com or your own) and fix any violations before tightening or replacing the live CSP. Remove report-only once you are satisfied.

---

## 3. Capacitor (native)

### allowNavigation

In **`capacitor.config.ts`** the WebView is allowed to navigate only to:

| Pattern | Reason |
|--------|--------|
| `capacitor://localhost` | App’s own origin (packaged content). |
| `https://*.supabase.co` | Supabase auth and API. |
| `https://*.vercel.app` | Web deployment (e.g. live reload or fallback). |
| `https://*.atlasperformancelabs.com` | Production app domain. |
| `https://checkout.stripe.com` | Stripe Checkout redirect (lead/plan payment). |
| `https://*.stripe.com` | Other Stripe pages (e.g. Connect onboarding return). |

No other remote origins are trusted. Adding a new origin (e.g. a new payment or auth provider) should be explicit and documented here.

### Server config

- **Production:** No `server.url`; app is served from `webDir` (dist) on device; `hostname: 'localhost'` for the embedded WebView.
- **Live reload:** When `CAPACITOR_SERVER_URL` is set, the app loads from that URL with `cleartext: true` for local dev only.

### Deep link / auth

- Auth (Supabase) and Stripe flows use **browser or in-app redirects** to Supabase and Stripe, then back to the app. Success/cancel URLs point to our domain (or `capacitor://localhost` if you configure it); those domains are in `allowNavigation`.
- Ensure success/cancel URLs for Stripe and any OAuth callbacks use allowlisted origins (see Stripe and auth docs). No arbitrary remote origins are allowed for navigation.

---

## 4. Known exceptions summary

| Exception | Where | Reason |
|-----------|--------|--------|
| `style-src 'unsafe-inline'` | CSP | Inline styles in HTML and components. |
| `img-src https:` | CSP | Supabase storage and external images. |
| `frame-src` YouTube | CSP | Exercise demo modal embeds. |
| Stripe in Capacitor `allowNavigation` | capacitor.config.ts | Checkout and Connect redirects. |
| No `upgrade-insecure-requests` | CSP | Avoid breaking local/mixed content. |

---

## 5. Adding a new origin

- **CSP (web):** If the app loads scripts, styles, or frames from a new domain, add it to the right directive (`script-src`, `style-src`, `frame-src`, `connect-src`, etc.) in `vercel.json` and document it in this file.
- **Capacitor:** If the app or auth/payment flow navigates to a new domain, add a pattern to `allowNavigation` in `capacitor.config.ts` and document it above.
