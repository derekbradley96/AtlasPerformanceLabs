# PROMPT 6 — Onboarding data storage

Ensures coach, client, and personal onboarding fields map to existing tables only (no duplicate tables).

## Files changed

| Area | File |
|------|------|
| Schema | `supabase/migrations/20260328120000_clients_selected_service_id.sql` |
| Edge (shared) | `supabase/functions/_shared/clientSelectedService.ts` |
| Edge | `supabase/functions/client-profile-create/index.ts` |
| Edge | `supabase/functions/client-profile-update/index.ts` |
| UI | `src/pages/CoachOnboardingFlow.jsx` |
| UI | `src/pages/ClientOnboardingFlow.jsx` |
| Doc | `docs/PROMPT6_ONBOARDING_DATA.md` |

## Data mapping summary

### Coach (`CoachOnboardingFlow` → Supabase)

| Concept | Storage | Notes |
|--------|---------|--------|
| Coach focus / “type” | `profiles.coach_focus` + `profiles.coach_type` | `coach_type` is legacy enum (`prep` / `fitness` / `hybrid`); kept in sync via `coachFocusToCoachType()`. |
| Plans / packages | `atlas_services` | Upserted via `stripeServiceUpsert` (existing flow). |
| Profile | `profiles.display_name`, `profiles.coaching_style`, `profiles.niche_tags` | Step 2 save. |
| Done | `profiles.onboarding_complete` | Final step. |

### Client (`ClientOnboardingFlow` → Edge + DB)

| Concept | Storage | Notes |
|--------|---------|--------|
| Coach link | `clients.coach_id`, `clients.trainer_id` | `client-profile-create` resolves `trainer_id` → `"Coaches".id`. |
| Selected plan | `clients.selected_service_id` → `atlas_services.id` | Validated in Edge: service must be **active** and owned by coach’s `atlas_coaches` row. Aliases: `selected_service_id`, `service_id`. |
| Goals | `clients.goals` | Single string label from onboarding options. |
| Experience | `clients.previous_experience` | String label. |
| Profile name | `profiles.display_name` | Via `updateProfile` before Edge call. |
| Optional stats | `clients.baseline_weight`, `clients.onboarding_notes` | Height stored in `onboarding_notes` text for day-one use. |
| Role | `profiles.role` | Set to `client` by `client-profile-create`. |
| Done | `profiles.onboarding_complete` | `handleFinish` + clears pending invite / plan session keys. |

### Personal (`PersonalOnboardingFlow` → Supabase)

| Concept | Storage | Notes |
|--------|---------|--------|
| Goals | `personal.primary_goal` + `auth.users.raw_user_meta_data.personal_goal` | Same labels synced to metadata. |
| Experience | `personal.experience_level` + `personal_experience` in user metadata | |
| Stats | `personal.baseline_weight_kg`, `personal.height_cm` | Optional. |
| Target note | `personal.target_note` + `personal_target` in metadata | Optional. |
| Done | `profiles.onboarding_complete` | After `personal` upsert. |

## Deploy notes

1. Apply migration: `supabase db push` (or your pipeline).
2. Redeploy Edge Functions: `client-profile-create`, `client-profile-update` (new shared module + column).
