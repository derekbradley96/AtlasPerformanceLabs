## Messaging audit — 2026-05-21

### Bugs fixed

1. **Reply linkage not persisted for voice replies**
   - **What was wrong:** Voice sends did not pass `replyToId` through the data chain, so `reply_to_id` was missing for voice replies.
   - **What was changed:** Added optional `replyToId` support to voice send path and persisted `reply_to_id` on voice message insert.
   - **Files modified:** `src/pages/ChatThread.jsx`, `src/data/useData.ts`, `src/data/messagingService.js`, `src/lib/messaging/supabaseMessaging.js`

2. **Messages list avatar always initials**
   - **What was wrong:** Conversation rows always rendered initials even when avatar URL existed.
   - **What was changed:** Added avatar image rendering with fallback initials in `Messages` row UI.
   - **Files modified:** `src/pages/Messages.jsx`

3. **Unread badge shape incorrect**
   - **What was wrong:** Badge sizing could render inconsistently without explicit minimum width.
   - **What was changed:** Normalized unread badge to a single rounded node with explicit `minWidth`.
   - **Files modified:** `src/pages/Messages.jsx`

4. **No explicit day separator helper in thread map**
   - **What was wrong:** Day-group headers existed but were not implemented via an explicit separator helper requested for consistent messaging behavior.
   - **What was changed:** Added `getDaySeparatorLabel()` and `DateSeparator` component; used separator whenever day boundary changes.
   - **Files modified:** `src/pages/ChatThread.jsx`

5. **Read receipt style inconsistent**
   - **What was wrong:** Read state used text labels rather than single/double tick style and did not match requested visual system.
   - **What was changed:** Switched to `✓`/`✓✓` receipt with blue read and grey delivered styling.
   - **Files modified:** `src/pages/ChatThread.jsx`

6. **Composer visuals not aligned to Atlas tokens**
   - **What was wrong:** Composer bars used translucent backgrounds/blur and attachment/mic did not match tokenized surfaces and states.
   - **What was changed:** Applied tokenized surfaces/borders/safe-area padding and updated mic/attachment/send visual states.
   - **Files modified:** `src/components/messages/VoiceNoteComposer.jsx`, `src/pages/chat-thread/ChatThreadComposerDock.jsx`, `src/pages/ChatThread.jsx`

7. **Thread header visual hierarchy weak**
   - **What was wrong:** Header title did not present requested avatar+name emphasis.
   - **What was changed:** Upgraded header title node to include 36px avatar fallback + 17px/600 name styling via shell header API.
   - **Files modified:** `src/pages/ChatThread.jsx`

8. **Thread empty state generic**
   - **What was wrong:** Empty conversation used generic text.
   - **What was changed:** Added contextual coach/client empty state copy and visuals.
   - **Files modified:** `src/pages/ChatThread.jsx`

9. **Audio bubble loading state looked broken**
   - **What was wrong:** While resolving `path:` media URLs, bubble showed generic loading text rather than playable structure.
   - **What was changed:** Loading state now renders a play-control shell with `0:00 / duration` display; duration fallback remains `--:--` for unknown totals.
   - **Files modified:** `src/components/messages/AudioBubble.jsx`

10. **Inbox Messages tab data source/read model insufficient**
    - **What was wrong:** Message lane depended on pre-shaped thread data and could miss unread derivation details.
    - **What was changed:** Added direct `message_threads` query + per-thread unread derivation from `message_messages`; updated rendering to show client name, preview, time, unread badge.
    - **Files modified:** `src/pages/InboxPage.jsx`

### Visual changes

- **Section 6 (Composer):**
  - **Before:** translucent composer bars, attachment/mic colors not token-accurate, weak input focus affordance.
  - **After:** `surface1` composer bar with token border, safe-area bottom spacing, `surface2` controls, tokenized focused border, primary send state.

- **Section 7 (Header):**
  - **Before:** plain text title in shell header.
  - **After:** avatar + emphasized 17px name styling in header title content (fallback initials when avatar missing).

- **Section 8 (Empty state):**
  - **Before:** generic "No messages yet".
  - **After:** role-aware empty states with targeted headline/body copy and message icon affordance.

### Manual QA required

1. **Reply persistence (text + voice)**
   - **Steps:** Open a thread, swipe-reply to a message, send text, then send a voice reply.
   - **Expected:** New rows in `message_messages` have `reply_to_id` populated for both text and voice replies.
   - **Pass/Fail:** [ ]

2. **Supabase DB verification**
   - **Steps:** Supabase Dashboard -> Table Editor -> `message_messages`; inspect most recent sent reply rows.
   - **Expected:** `reply_to_id` equals replied message UUID.
   - **Pass/Fail:** [ ]

3. **Messages list avatar**
   - **Steps:** In `Messages`, view a thread whose client has `avatar_url`.
   - **Expected:** Avatar image renders; if broken/missing, initials fallback appears.
   - **Pass/Fail:** [ ]

4. **Unread badge shape**
   - **Steps:** Ensure a thread has unread > 0.
   - **Expected:** Badge appears circular (not square), shows `9+` cap.
   - **Pass/Fail:** [ ]

5. **Date separators**
   - **Steps:** Open thread with messages across multiple days.
   - **Expected:** Separator labels show `Today`, `Yesterday`, weekday, or date format as appropriate.
   - **Pass/Fail:** [ ]

6. **Read receipts**
   - **Steps:** Send coach message; have client read it.
   - **Expected:** Single grey tick when delivered, double blue tick when read.
   - **Pass/Fail:** [ ]

7. **Composer theme + interactions**
   - **Steps:** Focus input, type/clear, tap attach, hold mic, record.
   - **Expected:** Correct tokenized surfaces/borders/states; mic enters danger+ring style while recording.
   - **Pass/Fail:** [ ]

8. **Thread empty state**
   - **Steps:** Open brand-new thread with zero messages as coach and as client.
   - **Expected:** Coach sees "Start the conversation"; client sees "Message your coach".
   - **Pass/Fail:** [ ]

9. **Audio bubble for `path:` media**
   - **Steps:** Open thread with voice message using `media_url` prefixed by `path:`.
   - **Expected:** Loading UI shows playable shell (not broken state), then playback works once signed URL resolves.
   - **Pass/Fail:** [ ]

10. **Inbox messages segment**
    - **Steps:** Open `Inbox` -> `Messages` segment with unread thread(s).
    - **Expected:** Rows show client name, 1-line preview, short time, unread badge; only unread threads displayed in message lane.
    - **Pass/Fail:** [ ]

### Release gate result

```text

> atlas-performance-labs-app@1.0.0 release:gate:ci
> npm run lint && npm run typecheck && npm run build && npm run test -- --run


> atlas-performance-labs-app@1.0.0 lint
> eslint . --quiet


> atlas-performance-labs-app@1.0.0 typecheck
> tsc -p ./jsconfig.json


> atlas-performance-labs-app@1.0.0 build
> node scripts/generate-marketing-sitemap.mjs && node scripts/generate-og-image.js && vite build

Wrote public/sitemap.xml (13 URLs, core lastmod 2026-05-21)
Wrote public/og-image.svg
Wrote public/og-image.png (1200×630)

> atlas-performance-labs-app@1.0.0 test
> vitest run --run


 RUN  v3.2.4 /Users/derekbradley/Dev/Atlas-Performance-labs-app_

 ✓ src/lib/reviewQueue/buildQueue.test.ts (6 tests) 3ms
 ✓ src/lib/atlasMigrationPhases.test.js (48 tests) 8ms
 ✓ src/lib/messaging/supabaseMessaging.test.js (16 tests) 12ms
 ✓ src/lib/clientPendingPaymentAccess.test.js (4 tests) 2ms
 ✓ src/lib/auth/postAuthNavigation.test.js (10 tests) 6ms
stderr | src/lib/autoProgramBuilder.test.js > autoProgramBuilder > does not auto-generate starter program for Personal Basic
[autoProgramBuilder] Personal Basic: auto starter program is disabled (Enhanced only).

 ✓ src/lib/autoProgramBuilder.test.js (3 tests) 8ms
 ✓ src/data/supabaseClientsRepo.test.ts (7 tests) 11ms
 ✓ src/lib/coachOnboardingRoutes.test.js (4 tests) 2ms
 ✓ src/lib/onboardingPlanSurfaceGuards.test.js (6 tests) 4ms
stderr | src/lib/roles.test.js > displayRoleLabel > unknown raw role normalizes to personal label
[roles] Unknown role arrived: unknown → defaulting to personal
[roles] Unknown role arrived: unknown → defaulting to personal

 ✓ src/lib/roles.test.js (12 tests) 4ms
 ✓ src/lib/prepPrecisionAccess.test.js (7 tests) 6ms
stdout | src/lib/inviteCode.test.js
[Supabase] VITE_SUPABASE_URL: https://qujteojdjxoqrjdpaljs.supabase.co
[Supabase] functions base URL: https://qujteojdjxoqrjdpaljs.supabase.co/functions/v1

 ✓ src/lib/inviteCode.test.js (6 tests) 13ms
 ✓ src/lib/personalAdaptationLayer.test.js (5 tests) 5ms
 ✓ src/lib/messaging/messagingService.test.js (5 tests) 2ms
 ✓ src/lib/checkinTemplateAnswers.test.js (4 tests) 3ms
 ✓ src/lib/clientCoachCommerce.test.js (5 tests) 3ms
 ✓ src/lib/postOnboardingRoutes.test.js (2 tests) 4ms
 ✓ src/lib/internalAccess.test.js (2 tests) 5ms
 ✓ src/lib/coachBridge.test.js (6 tests) 3ms
 ✓ src/lib/nutritionInterpretation.test.js (4 tests) 5ms
 ✓ src/lib/personalMacroSplit.test.js (8 tests) 5ms
 ✓ src/lib/routeMeta.test.js (8 tests) 2ms
 ✓ src/lib/offlineWorkoutQueue.test.js (2 tests) 3ms
 ✓ src/lib/exerciseTaxonomy.test.js (5 tests) 4ms
 ✓ src/lib/coachProfileCompletion.test.js (3 tests) 6ms
 ✓ src/data/messagingService.test.js (4 tests) 2ms
 ✓ src/lib/personalScreenMatrix.test.js (3 tests) 5ms
 ✓ src/lib/nutritionUnits.test.js (6 tests) 6ms
 ✓ src/lib/exerciseScoringEngine.test.js (2 tests) 3ms
 ✓ src/lib/nutritionLayers.test.js (1 test) 4ms
 ✓ src/lib/notificationRoutes.test.js (8 tests) 10ms
 ✓ src/lib/sessionMode.test.js (4 tests) 3ms
 ✓ src/lib/coachReviewRoutes.test.js (4 tests) 3ms
 ✓ src/lib/prepDashboardEngine.test.js (4 tests) 2ms
 ✓ src/lib/atlasScreenState.test.js (2 tests) 2ms
 ✓ src/config/resolvePersonalPlanTier.test.js (3 tests) 2ms

 Test Files  36 passed (36)
      Tests  229 passed (229)
   Start at  15:10:07
   Duration  2.79s (transform 826ms, setup 0ms, collect 3.11s, tests 169ms, environment 8ms, prepare 2.81s)
```

### Known remaining issues

- **Supabase dashboard confirmation is pending manual execution** in this environment (reply row validation cannot be completed from local code-only workflow).
- **Shell-owned header controls** (global back button hit area, shell header border/background implementation details) may still depend on upstream app-shell header components not edited in this session.
