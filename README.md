# Atlas Performance Labs

Atlas Performance Labs is a performance coaching platform built for strength coaches, bodybuilding prep coaches, and serious athletes.

The platform helps coaches manage clients, deliver training and nutrition plans, track progress, and monitor athlete health and retention from one unified dashboard.

Atlas is built by a coach, for coaches.

---

## Core Roles

### Coach

- Manage clients and roster
- Build training programs (blocks, weeks, days)
- Create and assign nutrition plans
- Monitor check-ins and compliance
- Track retention risk and client health
- Messaging, review queue, and referrals

### Client

- Receive training programs
- View nutrition plans
- Submit check-ins
- Track progress and metrics
- Message coach

### Personal

- Solo athlete mode
- Track workouts and body metrics
- Log nutrition
- Prepare for competition (peak week, etc.)

---

## Tech Stack

### Frontend

- **React** 18
- **Vite** 6
- **Tailwind CSS**
- React Router, TanStack Query, Framer Motion

### Mobile

- **Capacitor** (iOS + Android) — single codebase, native builds

### Backend

- **Supabase** (PostgreSQL, Auth, Row Level Security, Edge Functions)

### Payments

- **Stripe** (checkout, subscriptions, webhooks)

### Hosting

- **Vercel** (web)

---

## Development Setup

### Prerequisites

- Node.js 18+
- (iOS) Mac with Xcode
- (Android) Android Studio

### Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/atlas-performance-labs.git
cd atlas-performance-labs
npm install
```

---

## Environment Variables

Create a `.env.local` in the project root (do **not** commit real keys).

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes (for auth/data) | Supabase project URL, e.g. `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes (for auth/data) | Supabase anonymous (public) key |

Without these, the app falls back to local/demo mode and still runs.

Optional (for full functionality):

- Stripe keys and webhook secret (for payments) — typically configured in Supabase Edge Functions or deployment env.

---

## Running Locally

### Web

```bash
npm run dev
```

Open **http://localhost:5174** in the browser. Edits hot-reload.

### Production build (web)

```bash
npm run build
npm run preview
```

---

## Mobile Development

### One-time: add platforms

```bash
npx cap add ios
npx cap add android
```

### iOS (simulator or device)

1. **Terminal 1** — start dev server so the app can load from it:
   ```bash
   npm run dev:mobile
   ```
   (Runs Vite with `--host` on port 5174.)

2. **Terminal 2** — sync and open Xcode:
   ```bash
   npm run ios:live
   ```
   The app loads from the dev server and live-reloads.

3. **Physical iPhone** (same Wi‑Fi as Mac): use your Mac’s IP:
   ```bash
   CAPACITOR_SERVER_URL=http://YOUR_MAC_IP:5174 npx cap sync ios && npx cap open ios
   ```
   Keep `npm run dev:mobile` running.

### Android (emulator or device)

1. **Terminal 1:** `npm run dev:mobile`
2. **Terminal 2:** `npm run android:live`

For a **physical Android device** (same Wi‑Fi): use your machine’s IP in `CAPACITOR_SERVER_URL` as above, with `android` instead of `ios`.

### Production build (no live reload)

```bash
npm run build
npm run cap:sync
npm run ios
# or
npm run android
```

Then run from Xcode or Android Studio. The app serves from the built `dist/` folder.

---

## Supabase

- **Link project** (one-time): `npx supabase link --project-ref <PROJECT_REF>` (get `<PROJECT_REF>` from the dashboard URL).
- **Push migrations:** `npm run db:push` or `npx supabase db push --include-all`.
- Auth, profiles, clients, programs, check-ins, messages, and referrals are backed by Postgres and RLS.

---

## Key Features

- **Roles:** Coach, Client, Personal — with role-based routing and dashboards.
- **Coach:** Client list, program builder, program assignments, review center, messaging, nutrition plans, retention/health signals, referrals, marketplace profile.
- **Client:** Today’s workout, programs, check-ins, messaging, nutrition.
- **Personal:** Solo training, workouts, metrics, nutrition.
- **Auth:** Supabase Auth (email/password, OTP); session and profile loading.
- **Payments:** Stripe integration for coach subscriptions and lead checkout.
- **Mobile:** Capacitor with native splash, haptics, and push (when configured).

---

## Deployment

- **Web:** Build with `npm run build`; deploy the `dist/` folder to Vercel (or any static host). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the deployment environment.
- **iOS / Android:** Build and submit via Xcode and Android Studio (no `CAPACITOR_SERVER_URL`; app uses bundled `dist/`).

---

## Roadmap

- Continued refinement of coach onboarding and activation.
- Marketplace and discovery improvements.
- Deeper retention and health analytics.

---

## License

This project is private and proprietary. All rights reserved.
