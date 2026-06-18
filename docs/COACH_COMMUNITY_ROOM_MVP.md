# Coach community room — MVP design & implementation

Structured, coach-owned group layer (not a generic chat clone). **One room per coach**; members derived from the live roster.

## 1. Schema / migration plan

**Migration:** `supabase/migrations/20260412150000_coach_community_rooms.sql`

| Table | Purpose |
|-------|---------|
| `group_rooms` | One row per `coach_id` (unique). Fields: `name`, `room_mode` (`community` \| `coach_led`), `pinned_message_id`, `room_muted`, `is_active`, timestamps. |
| `group_room_members` | Materialized membership: `coach` + `client` rows; `member_status` `active` \| `removed`; `last_read_at` for unread; `is_muted` for per-user mute (MVP UI partial). |
| `group_messages` | Posts: `message_type` enum (text, image, video, meal_share, workout_share, win_share, announcement), `body`, `media_url`, `metadata_json` (Atlas refs, never auto-filled from private check-ins), `reply_to_id`, soft delete. |

**Membership sync:** `atlas_sync_community_members(p_coach_id uuid)` (SECURITY DEFINER) upserts the coach, inserts/updates clients where `clients.coach_id` matches, `user_id` is set, and `billing_status` is not `pending_payment`. Removes stale client members when no longer eligible.

**Trigger:** `clients` INSERT/UPDATE/DELETE → `atlas_sync_community_members` for affected coach(s).

**Coach-led rule:** Trigger `atlas_group_messages_enforce_coach_led` — in `coach_led` mode, clients cannot insert top-level `text` / `image` / `video` without `reply_to_id` (must reply or use structured `meal_share` / `workout_share` / `win_share`).

**Backfill (ops):** After deploy, run for each active coach (example pattern):

```sql
SELECT public.atlas_sync_community_members(p.id)
FROM public.profiles p
WHERE p.role = 'coach';
```

(Adjust if your coach list source differs.)

## 2. Route / screen plan

| Route | Screen | Roles |
|-------|--------|-------|
| `/community` | `CommunityRoomPage` | Coach, Client (same shell gates as messaging) |

**Entry points (MVP):**

- **Messages** (`Messages.jsx`): primary card above thread list (and when list empty).
- **Post-workout** (`PostWorkoutCompletion.jsx`, client only): “Share to coach community” → `/community?shareType=workout`.

**Query helpers:** `?shareType=workout|meal|win` — prefills composer only; **no** automatic pull from private check-in media.

## 3. Permissions / RLS plan

- **SELECT** `group_rooms` / `group_room_members` / `group_messages`: coach owner OR active member of that room.
- **INSERT** `group_messages`: authenticated sender matches member role; message types restricted by role (RLS + app).
- **UPDATE** `group_messages`: coach only → soft delete / moderation.
- **UPDATE** `group_rooms`: coach only → mode, pin, mute flags.
- **UPDATE** `group_room_members`: user may update own row (mute + `last_read_at`).
- **No** direct INSERT to `group_room_members` from clients — sync function only.

**Storage (follow-up):** MVP uses optional `media_url` (paste URL). Private bucket + signed URLs for uploads can mirror `message` voice media patterns.

## 4. MVP component list

| Piece | Location |
|-------|----------|
| Data / RPC | `src/data/communityRoomRepo.js` |
| Tier gate stub | `src/lib/communityFeatureGate.js` (currently allows all tiers; flip for Pro/Elite before GA) |
| Page | `src/pages/CommunityRoomPage.jsx` |
| Messages promo | `src/pages/Messages.jsx` |
| Workout share CTA | `src/components/workout/PostWorkoutCompletion.jsx` |

## 5. Coach / client UX flow

1. **Coach** opens **Messages** → **Client community** → room loads, `sync` runs, feed + composer (announcement, text, media URL).
2. **Coach** toggles **Mode** → switches `community` vs `coach_led` (copy explains behavior).
3. **Coach** **Pin** / **Remove** on any post (moderation).
4. **Client** opens same entry → sees feed, posts allowed types; in **coach_led**, free text at top-level blocked by DB unless replying or using structured share types.
5. **Share from workout** (client): lands in community with workout share intent prefilled — user confirms post (nothing private auto-shared).

## 6. Risks / follow-up items

| Risk / gap | Mitigation |
|------------|------------|
| **Notifications** | MVP: no push fan-out; add server trigger or Edge Function for announcements only + user mute prefs. |
| **Media upload** | URL-only MVP; add `community-media` bucket + signed upload + size limits. |
| **Unread badge** | `last_read_at` exists; wire badge on Messages tab + poll/realtime. |
| **Tier billing** | `communityFeatureGate.js` + `resolveAtlasAccess.coachPlanTier` when enabling Basic lockout. |
| **Scale / abuse** | Rate limits, report post, coach “room muted” already on `group_rooms.room_muted` — expose in UI. |
| **RLS testing** | QA with third account must not SELECT room/messages. |
| **Pin FK** | `pinned_message_id` nullable; if pinned message deleted, set pin null in app or ON DELETE SET NULL on pin column (already SET NULL on message delete). |

---

**Atlas rulebook:** Single shared engine (DB + RLS + one repo); coach vs client is **presentation + allowed post types**, not duplicate backends. Website vs app: same route; shell uses existing `AppShell` pushed stack for `/community`.
