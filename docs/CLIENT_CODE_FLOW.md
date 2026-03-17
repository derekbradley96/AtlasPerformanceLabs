# Client invite code flow (web + app)

The same flow runs on **web** (atlasperformancelabs.co.uk) and **native app** (Capacitor iOS/Android). One codebase:

- **ClientCode** (`/client-code`) – enter coach code, validate via Edge Function, then navigate to auth.
- **AuthScreen** (`/auth?mode=signup&account=client`) – client-only UI: “Complete your details”, no Trainer/Personal, “Your details”, “Continue”. After signup → client onboarding.

After pushing and deploying:

- **Web:** Vercel (or your host) serves the new build automatically.
- **App:** Rebuild and sync so the native app gets the same bundle: `npm run cap:sync` (or `npm run build && npx cap sync`).

No separate “app side” implementation; both use the same routes and components.
