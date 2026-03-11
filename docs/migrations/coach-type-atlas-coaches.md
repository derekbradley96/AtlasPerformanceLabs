# Coach Type – Database Migration

## Overview

Coach type onboarding stores `coach_type` on the coach profile. For production, persist in `atlas_coaches` and sync via `get-coach` / set-coach-type API.

## Migration (Supabase / PostgreSQL)

Run once when deploying coach type support:

```sql
-- Add coach_type to atlas_coaches (if table exists)
ALTER TABLE atlas_coaches
ADD COLUMN IF NOT EXISTS coach_type text
CHECK (coach_type IN ('general', 'prep', 'both'))
DEFAULT 'general';
```

## Backend / Edge Functions

1. **get-coach**  
   Include `coach_type` in the response so the app can hydrate AuthContext and use it for UI/health score.

   Example response shape:
   ```json
   {
     "coach": { "id": "...", "coach_type": "general" },
     "connected": true
   }
   ```

2. **set-coach-type** (or update-coach)  
   Called from Coach Type onboarding to persist the selection:
   - Input: `user_id`, `coach_type` (`'general' | 'prep' | 'both'`)
   - Update `atlas_coaches.coach_type` for that coach.

## Where coach_type is stored and accessed

| Location | Purpose |
|----------|--------|
| **atlas_coaches.coach_type** | DB (production); source of truth when using API |
| **CoachProfile (coachProfileRepo)** | localStorage; `coach_type` on profile; used when API not configured |
| **AuthContext** | `coachType` state + `setCoachType`; synced from profile / get-coach on load |
| **CoachTypeOnboarding** | Sets profile + context on selection; then redirects to /setup |
| **EntryRoute (App.jsx)** | Redirects trainer to /coach-type when `!hasCoachTypeSet(trainerId)` |
| **More.jsx** | Hides "Competition Prep" row when `coachType === 'general'` |
| **TrainerDashboard.jsx** | Hides "Peak week due" in briefing when `coachType === 'general'` |
| **RequireCompPrepAccess** | Redirects /comp-prep* to /home when `coachType === 'general'` |
| **getHealthScoreConfigForCoachType** | Returns different weights/thresholds for general vs prep |
| **healthScoreService** | Passes `coachType` into computeHealthScore for config |
| **Leads.jsx** | When `coachType === 'both'`, shows "New client type: General / Prep" and passes to createClientStub |
| **clientStubStore** | `client_type` on stub; used when coach_type is 'both' for per-client behavior |
