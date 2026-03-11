# QA: Chat composer and messaging

Manual checks for the premium Instagram/WhatsApp-style chat composer and interactions.

## iOS

- [ ] **Keyboard**: Focus input → keyboard opens; composer sits **flush to the top of the keyboard** (no gap).
- [ ] **Accessory bar**: The iOS arrows + checkmark bar above the keyboard is **hidden** (Capacitor Keyboard plugin).
- [ ] **Safe area**: Composer respects bottom safe area (e.g. home indicator); no overlap.
- [ ] **Long-press**: Long-press on a message bubble opens the **custom action menu** (Copy, Reply, Delete). **No** iOS Copy/Look Up/Translate callout.
- [ ] **Blur**: Composer bar has subtle backdrop blur and top shadow.

## Android

- [ ] **Keyboard**: Focus input → keyboard opens; composer sits **flush to the top of the keyboard**.
- [ ] **Safe area**: Bottom padding / inset correct on devices with gesture nav.

## Web

- [ ] **visualViewport**: When keyboard opens (or devtools dock), composer moves up with **useKeyboardInset** / **useKeyboardBottomInset** (visualViewport fallback).
- [ ] **No extra bar**: No duplicate “checkmark” or accessory bar added by the app.

## Swipe delete (Messages list)

- [ ] **Swipe** a conversation row left → Delete (and Pin) actions appear.
- [ ] **Tap Delete** → Confirm dialog; after confirm, thread is removed. **Does not** navigate into the chat.
- [ ] **Tap Pin** → Toggles pin; **does not** open the thread.
- [ ] With swipe open, tapping the row content closes the swipe and **does not** open the thread.

## Voice notes

- [ ] **Tap mic** → Recording starts; timer (mm:ss) visible; **Tap Stop** (square) → Stops and sends as voice message bubble.
- [ ] **Press-and-hold mic** → Recording; release → sends; slide left → “Release to cancel”; slide up → lock (then Stop + Send).
- [ ] **Haptics**: Light haptic on start; medium on lock; heavy on cancel (native).
- [ ] **Playback**: Sent voice note shows as audio bubble; play/pause and progress work; persists after refresh (local store).

## Colors and roles

- [ ] **Accent**: Primary actions and “my” bubbles use **blue** (no teal/cyan).
- [ ] **Roles**: Chat UI behaves for coach, athlete, client; role gates only affect which actions are available, not composer layout.
