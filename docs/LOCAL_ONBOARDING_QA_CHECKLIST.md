# Local Onboarding QA Checklist

Run with local dev server:

```bash
npm run dev -- --host 0.0.0.0 --port 5174
```

## Coach flow (required)

1. Open `/admin-dev-panel`.
2. Click **Start as Trainer (sandbox)**.
3. Go to `/coach-onboarding-flow`.
4. Reach **Step 4 of 5** (`Client setup`).
5. Click **Add client** (should open `/inviteclient?onboarding=1`).
6. Tap **Go back**.
7. Confirm onboarding is still on **Step 4 of 5** (not Step 1).

Pass criteria:
- Add-client transition does not reset step progress.
- No auth redirect during in-flow back navigation.

## Client flow (required)

1. Open `/client-onboarding-flow`.
2. On Step 1, click Continue with empty code.
3. Verify message: `Enter your coach code`.
4. Enter invalid code and Continue.
5. Verify message: `Invalid coach code`.

Pass criteria:
- Step 1 validation messages show correctly.
- User remains on Step 1 on invalid code.

## Notes

- Direct URL reloads while using sandbox accounts can force `/auth` because they are not real Supabase sessions.
- Use in-app navigation for local sandbox QA continuity checks.
