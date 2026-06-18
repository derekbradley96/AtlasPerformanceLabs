# OAuth Provider Setup (Google & Apple)

Atlas uses Supabase Auth `signInWithOAuth` with redirect URLs from `getAuthCallbackUrl()` in `src/lib/authRedirect.js`:

- **Web:** `https://<your-app-origin>/auth/callback`
- **Capacitor (iOS/Android):** `capacitor://localhost/auth/callback`

Add the same redirect URLs in each provider’s console and in the Supabase Dashboard under **Authentication → URL Configuration** (redirect allow list).

---

## Google

1. Supabase Dashboard → **Authentication** → **Providers** → **Google**
2. Enable the Google provider
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/) (OAuth 2.0 Client IDs)
4. **Authorised redirect URIs** (Google):
   - `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
5. Paste **Client ID** and **Client Secret** into Supabase
6. For native iOS app flows, also register your app’s custom scheme if required by your OAuth client type (e.g. `com.atlasperformancelabs.app://` paths as documented for your Capacitor / iOS setup)

---

## Apple

1. Supabase Dashboard → **Authentication** → **Providers** → **Apple**
2. Enable the Apple provider
3. In [Apple Developer](https://developer.apple.com/): create a **Services ID**, **Sign in with Apple** key (Key ID + private key), and note your **Team ID**
4. Configure domains and return URLs per Apple’s Sign in with Apple rules; Supabase expects:
   - **Return URL:** `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
5. Add your web domains (e.g. `atlasperformancelabs.co.uk` and production app host) where Apple requires them for the Services ID

---

## After configuration

1. Run the app and use **Continue with Google** / **Continue with Apple** on the login screen
2. After provider consent, the user should land on `/auth/callback` and `AuthCallback` will exchange the session (PKCE `code` or hash tokens) and route to home or onboarding

See `src/screens/AuthCallback.jsx` and `src/lib/AuthContext.jsx` (`signInWithProvider`).
