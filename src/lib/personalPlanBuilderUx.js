/**
 * Personal-only program planning copy: no coach/client/database jargon in user-facing strings.
 */

/** Intro under TopBar when editing an existing personal plan in the builder.
 *  Personal plans are built manually — no generate/draft framing. */
export function personalBuilderIntro({ hasBlock }) {
  if (hasBlock) {
    return 'Pick a week and day, add your exercises, then save. Your plan updates Today automatically.';
  }
  return 'Name your plan, save it, then add training days one at a time.';
}

export function personalBuilderLoadingMessage() {
  return 'Loading your plan…';
}

export function personalBuilderLoadingHint() {
  return 'Pulling your weeks and training days.';
}

export function personalNoCloudCopy() {
  return 'Connect your account to create and save a training plan. Nothing leaves your device until you’re online.';
}

export function personalSaveNameHint({ hasBlock }) {
  if (hasBlock) return '';
  return 'Add a plan name, then save to create your plan.';
}

export function personalCreateSuccessToast() {
  return 'Plan created';
}

export function personalSaveSuccessToast({ assignmentSyncOk }) {
  if (assignmentSyncOk === false) return 'Saved — open Today if the session looks stale';
  return 'Saved';
}

/** Empty week / no days yet in builder. */
export function personalEmptyWeekDescription(basic) {
  if (basic) {
    return 'Add your first training day, then pick exercises from the library or type your own.';
  }
  return 'Add a training day for this week, or duplicate a previous week. Each day holds your exercise list.';
}

export function personalHubEmptySubtitle() {
  return 'Shape your week here — it appears on Today when you train.';
}

/**
 * @param {{ enhanced?: boolean }} [opts]
 */
export function personalHubNoPlanBody(opts = {}) {
  if (opts.enhanced) {
    return 'Sketch a week from a template, or build manually in the planner. You can change everything later.';
  }
  return 'Build your own structure from scratch.';
}

/** @deprecated Personal tier removed — use personalHubNoPlanBody only. */
export function personalHubNoPlanEnhancedHint() {
  return '';
}

export function personalHubCloudSubtitle() {
  return 'This is the plan you train from. Edit anytime — Today stays in sync.';
}

export function personalHubLocalSubtitle() {
  return 'Saved on this device. Open the planner to adjust days and exercises.';
}

/** Basic vs Enhanced training tip on My Program hub (no “system” voice). */
export function personalTrainingTipBasic({ readinessBand10, proteinPct }) {
  if (readinessBand10 == null) {
    return 'Log readiness when you can — it helps you pick sensible intensity for the day.';
  }
  if (readinessBand10 >= 8) return 'Energy looks strong — aim to finish your main lifts with solid form.';
  if (readinessBand10 >= 6) return 'Moderate day — match last week’s reps before adding load.';
  return 'Lighter day — prioritize clean reps and stop a bit earlier if quality drops.';
}

export function personalTrainingTipEnhanced({ readinessBand10, sessionsLogged }) {
  const base = personalTrainingTipBasic({ readinessBand10, proteinPct: null });
  if (Number(sessionsLogged) >= 2 && readinessBand10 != null && readinessBand10 >= 8) {
    return `${base} If the last two sessions felt easy on your top set, a small bump next time is reasonable.`;
  }
  if (readinessBand10 != null && readinessBand10 < 6) {
    return `${base} Extra food and sleep usually pay off more than forcing volume today.`;
  }
  return base;
}
