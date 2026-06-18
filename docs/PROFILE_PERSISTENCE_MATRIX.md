# Profile Persistence Matrix

Canonical surface: `src/pages/ProfileAccountPage.jsx`  
Canonical save gateway: `updateProfile()` in `src/lib/AuthContext.jsx`

## Profile & Sign-in

- `full_name` -> save: `profiles.full_name` -> load: `AuthContext.profile.full_name`
- `display_name` -> save: `profiles.display_name` -> load: `AuthContext.profile.display_name`
- `email` -> save: `supabase.auth.updateUser({ email })` -> load: `auth user email`
- `password` -> save: `supabase.auth.updateUser({ password })` -> load: not rehydrated (write-only)

## Body Metrics

- `height_unit` -> save: `profiles.height_unit` -> load: `AuthContext.profile.height_unit`
- `bodyweight_unit` -> save: `profiles.bodyweight_unit` + local pref mirror -> load: profile first, local pref fallback
- `current_weight` -> save: `profiles.current_weight` (kg canonical) -> load: converted from profile kg value
- `target_weight` -> save: `profiles.target_weight` (kg canonical) -> load: converted from profile kg value

## Training

- `load_unit` -> save: `profiles.load_unit` -> load: `AuthContext.profile.load_unit`

## Nutrition Units

- `food_quantity_unit` -> save: `profiles.food_quantity_unit` -> load: `AuthContext.profile.food_quantity_unit`
- `nutrition_label_display` -> save: `profiles.nutrition_label_display` -> load: `AuthContext.profile.nutrition_label_display`
- `water_unit` -> save: `profiles.water_unit` -> load: `AuthContext.profile.water_unit`
- `sodium_unit` -> save: `profiles.sodium_unit` -> load: `AuthContext.profile.sodium_unit`

## Role-specific Fields

- Coach:
  - `coaching_focus` -> save: `profiles.coach_focus` -> load: `AuthContext.profile.coach_focus`
  - `coaching_style` -> save: `profiles.coaching_style` -> load: `AuthContext.profile.coaching_style`
  - `business_name` -> save: `profiles.business_name` -> load: `AuthContext.profile.business_name`
  - `avatar_url` -> save: `profiles.avatar_url` -> load: `AuthContext.profile.avatar_url`
  - `taking_clients` -> save: `profiles.taking_clients` -> load: `AuthContext.profile.taking_clients`
- Client:
  - `training_days` -> save: `clients.training_days_per_week` -> load: `clients` row by `user_id`
  - `injuries` -> save: `clients.injuries` -> load: `clients` row by `user_id`
- Personal:
  - `goal` (if personal-specific) -> save: `personal.primary_goal` upsert -> load: `personal` row by `user_id`

## Notifications

- Save: `updateNotificationPreferences(userId, notifications)`
- Load: `getNotificationPreferences(userId)`

## Reliability rule

When a field exists in `profiles`, UI must load from `AuthContext.profile` to avoid direct-select schema drift.
