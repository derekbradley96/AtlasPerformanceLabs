# Hardening QA Checklist

Use this checklist after each reliability pass. Mark each item pass/fail and capture notes.

## 1) Manual Call Torture Test (15-20 mins)

- [ ] Coach and client both press join within 2 seconds (same browser family).
- [ ] Coach and client both press join within 2 seconds (different browser families).
- [ ] Client background tab receives incoming call; return to tab and join.
- [ ] Coach hangs up while client is in connecting state.
- [ ] Client declines after delayed ring (10+ seconds).
- [ ] Call ends on coach side and disappears from client side promptly.
- [ ] Call ends on client side and disappears from coach side promptly.
- [ ] Ring sound toggle OFF prevents ringtone/ringback playback.
- [ ] Ringback volume slider (low/mid/high) changes loudness while connecting.

Evidence to capture:
- Browser/device pair used
- Any stale banner/call tile behavior
- Approximate transition timing for ringing -> accepted -> in_progress -> completed/cancelled

## 2) Profile Field-by-Field Verification (Per Role)

Run once for coach, client, and personal roles.

Identity + account:
- [ ] `full_name`
- [ ] `display_name`
- [ ] `phone`
- [ ] `gender`
- [ ] `birthdate`
- [ ] `location`
- [ ] `avatar_url`

Body + units:
- [ ] Height unit and value
- [ ] Bodyweight unit and current value
- [ ] Target weight unit and value
- [ ] Load unit preference

Nutrition settings:
- [ ] Food quantity unit
- [ ] Sodium unit
- [ ] Water unit
- [ ] Nutrition label display mode

Notifications + sounds:
- [ ] Notification toggles persist after refresh
- [ ] Call sounds toggle persists after refresh
- [ ] Ringback volume persists after refresh

Pass criteria:
- Save succeeds
- Refresh preserves exact value
- Sign out/in preserves value

## 3) Community History + Pinned Reliability

- [ ] Initial room load shows newest messages without duplication.
- [ ] `Load older` fetches earlier messages in correct order.
- [ ] Pinned message outside initial window resolves with `Jump to message`.
- [ ] Deleted pinned message no longer shows as pinned.
- [ ] Rapid pin swap (pin A -> pin B -> unpin) settles to correct final state.

## 4) Program Builder/Assignments Unified Path

- [ ] Assignment page lists coach-owned programs by default.
- [ ] Optional client-only filter only shows that client's existing blocks.
- [ ] Assigning active program deactivates previous active assignment.
- [ ] Assigned program appears correctly in client program surface.
- [ ] No local reseed or ghost reappearance after delete/refresh.

## 5) Observability Tags

Verify logs include tagged recoverable errors for:
- [ ] `useWebRTC / setRemoteDescription`
- [ ] `CommunityRoomPage / postMessage`
- [ ] `CommunityRoomPage / deleteMessage`
- [ ] `CommunityRoomPage / pinMessage`
- [ ] `CommunityRoomPage / toggleMode`
- [ ] `CommunityRoomPage / activateCommunity`
- [ ] `CommunityRoomPage / toggleCommunityActive`
- [ ] `CommunityRoomPage / saveRules`
- [ ] `CommunityRoomPage / moderateMember`
- [ ] `CommunityRoomPage / loadOlderMessages`
- [ ] `CommunityRoomPage / jumpToPinned`
- [ ] `ProfileAccountPage / saveProfile`

