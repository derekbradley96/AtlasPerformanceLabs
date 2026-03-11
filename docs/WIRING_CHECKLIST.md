# App wiring checklist

Use this when adding new routes or verifying that navigation, roles, and tabs stay consistent.

## 1. Routes (App.jsx)

- **Defined in:** `src/App.jsx` – `<Route path="..." element={...} />` inside `AppRoutes`.
- **Auth/role:** Use `RequireAuth`, `RequireAuthAndRole role="trainer"`, or `RequireCoachOwner` so access matches the route’s intent.
- **Lazy routes:** Heavy pages (e.g. ProgramBuilder, Earnings, CompPrepHome) use `React.lazy()` and are wrapped in `<Suspense fallback={<LazyRouteFallback />}>`.

When adding a new route:

1. Add the `<Route>` in `App.jsx` with the correct wrapper (auth/role).
2. Add the same path and roles to `src/lib/routeInventory.js` in `ROUTE_TABLE` (used by Navigation Audit and access checks).
3. If the route should have a custom header title, add it in `src/lib/routeMeta.js` in `ROUTE_TITLES` and/or the logic in `getRouteTitle()`.
4. If it’s a “pushed” (detail) route where the tab bar should hide, add a pattern to `PUSHED_ROUTE_PATTERNS` in `src/components/shell/AppShell.jsx` and to `isPushedRoute()` in `src/lib/routeMeta.js` if needed.
5. If it’s a new **tab root** (screen where the bottom tab bar should show), add the path to `TAB_ROUTES` in `src/components/shell/AppShell.jsx`.

## 2. Tab bar (bottom nav)

- **Config:** `src/lib/routeMeta.js` – `getTabRoutesForRole(role)` returns the 4 tab items (path, label, iconKey).
- **Visibility:** `src/components/shell/AppShell.jsx` – `TAB_ROUTES` is the `Set` of pathnames where the tab bar is shown. Pushed routes (e.g. client detail, chat thread) hide the tab bar.
- **Roles:** Trainer gets Home → `/home`, Clients → `/clients`, Messages, More. Client gets Home → `/client-dashboard`; Solo gets Home → `/solo-dashboard`. All see the same four tabs; `/clients` is trainer-only, so client/solo get Access Denied if they tap Clients (by design unless you change the tab set per role).

Check:

- [ ] `TAB_ROUTES` in AppShell includes every path used as “Home” for any role (e.g. `/home`, `/client-dashboard`, `/solo-dashboard`) so the tab bar appears on those screens.
- [ ] `getTabRoutesForRole` paths exist as routes in App.jsx and match role access.

## 3. Route inventory vs App.jsx

- **Source of truth for “what exists”:** `App.jsx` (actual routes).
- **Source of truth for “who can access”:** `routeInventory.js` – `ROUTE_TABLE` and `getDashboardPathForRole`, `isPathAllowedForRole`.

Keep `ROUTE_TABLE` in sync with App.jsx so:

- Navigation Audit (`/navigation-audit`, DEV only) shows correct paths and role access.
- Any code using `isPathAllowedForRole` or `getDashboardPathForRole` stays correct.

## 4. Navigation Audit (dev only)

- **Path:** `/navigation-audit` (only in DEV; redirects to `/` in prod).
- **Purpose:** Lists all routes from `routeInventory.js`, highlights routes forbidden for the current role, and shows the dashboard path for the current role.
- **Use:** After adding or changing routes, open `/navigation-audit` and confirm new paths appear and role highlighting matches expectations.

## 5. Deep links and redirects

- **Legacy path:** `/clientdetail?id=...` is handled by `RedirectClientDetail` and sends to `/clients/:id`.
- **HashRouter:** On Capacitor/native, the app uses `HashRouter` so deep links and reloads work with hash routes.

## 6. Quick verification checklist

- [ ] New route added in `App.jsx` with correct auth/role wrapper.
- [ ] Path and roles added to `src/lib/routeInventory.js` `ROUTE_TABLE`.
- [ ] Header title set in `src/lib/routeMeta.js` if needed.
- [ ] If it’s a tab root: path in `TAB_ROUTES` in `src/components/shell/AppShell.jsx`.
- [ ] If it’s a detail/pushed route: pattern in `PUSHED_ROUTE_PATTERNS` in AppShell (and `isPushedRoute` in routeMeta if used).
- [ ] Run app, hit the route as the right role, and confirm tab bar and header behavior.
- [ ] In DEV, open `/navigation-audit` and confirm the route and role access look correct.

## 7. Debug builds for runtime errors

If you see minified variable names in errors (e.g. “Cannot access 'kn' before initialization”), use a debug build to get readable names:

```bash
npm run build:debug
# then sync and run on device/simulator
```

See `docs/IOS_XCODE_NOTES.md` for more.
