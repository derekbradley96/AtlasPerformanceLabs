# Test Prompts 3 & 4 — What changed

## Prompt 3 — Posing submission + review

### Fixes (architecture)

- **Structured pose checks** (`pose_check_items`) were created on insert but the client only uploaded to legacy `pose_checks.photos`, so coaches often saw **empty mandatory poses**. The client flow now:
  1. **Continue** → `insertPoseCheck` → if template rows exist → **per-pose upload** screen; else legacy multi-photo upload.
  2. **Resume**: if the week row exists but any item is missing `photo_path`, the app opens the **per-pose** screen instead of a dead-end “submitted” state.

### `src/lib/poseChecks.js`

- `updatePoseCheckItem` accepts **`photo_path`** (and still coach fields) via explicit keys.
- **`getPoseCheckPriorToWeek(clientId, weekStart)`** — loads the previous `pose_check` for **compare** UI.

### Client — `PoseCheckSubmitPage.jsx`

- **“Weekly posing check”** hero — positions posing as a core weekly workflow.
- **Two-step flow** for prep: notes → **one photo per mandatory pose** with progress `X/Y`.
- **Thumbnails** for legacy multi-select.
- **Submitted** state shows **coach overall notes** + **per-pose ratings/notes** when present.

### Coach list — `PoseCheckReviewPage.jsx`

- Renamed framing to **Posing review** / **Weekly posing queue**.
- **Grouped by urgency**: **Review now** (submitted this week, not reviewed) → **Missing this week** → **Caught up**.
- **Peak / show hints** from `v_client_prep_header` (`Peak week`, `Nd to show`).
- Left **accent border** per group.

### Coach detail — `PoseCheckReviewDetailPage.jsx`

- **This week vs previous week** side-by-side images per pose (match on `pose_key`), with week label chip when prior exists.
- **Prep context & insights** collapsed into one **toggle** so mandatory poses stay above the fold.
- Conditioning tags + rating/notes layout cleaned up under a divider.

---

## Prompt 4 — Prep dashboard pressure (10+ clients)

### `CoachHomePage.jsx`

- **Attention fetch** limit **14** (was 5); **Needs Attention** list shows **10** rows for competition/integrated coaches (5 for transformation).
- **Check-ins / pose “new”** fetch limit **8** (was 5).
- **Merged attention sort**: **high risk** first, then `attention_priority`.
- **Pose “due”** client list uses **`coach_id` OR `trainer_id`** (aligned with rest of app).
- **Prep priorities** card (competition/integrated only): four **tap targets** — check-ins in queue, posing to review, peak week due count, clients missing weekly pose — plus **high churn risk** names (from retention alerts) linking to the client profile.
- **Health alerts** fetch **10**; when the attention queue is empty, up to **`attentionDisplayLimit`** health rows show (not only 2).

---

## How to re-test quickly

1. **Client** (prep + `division_key`): `/pose-check-submit` → Continue → upload each pose → confirm coach sees photos on `/review-center/pose-checks/:id`.
2. **Coach**: `/review-center/pose-checks` → confirm **Review now** section ordering.
3. **Coach**: open a check with history → **Previous** column + **Prep context** toggle.
4. **Coach home** (competition focus, many clients): **Prep priorities** counts and **Needs Attention** length.
