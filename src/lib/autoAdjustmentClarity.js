import { useCallback, useEffect, useState } from 'react';

/** Shown wherever automatic training/nutrition nudges are explained. */
export const AUTO_ADJUSTMENT_EXPLANATION =
  'Adjustments are based on your goal, check-ins, and progress trends.';

/** Reduces “mystery AI” confusion; keeps copy short for mobile. */
export const AUTO_ADJUSTMENT_NOT_AI_NOTE =
  'Not generative AI — simple rules based on what you log.';

const STORAGE_KEY = 'atlas_personal_auto_adjustments_enabled_v1';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Default ON so existing behavior is unchanged until the user opts out. */
export function getPersonalAutoAdjustmentsEnabled(userId) {
  if (!userId) return true;
  const map = readMap();
  if (map[userId] === undefined) return true;
  return Boolean(map[userId]);
}

export function setPersonalAutoAdjustmentsEnabled(userId, enabled) {
  if (!userId) return;
  const map = readMap();
  map[userId] = Boolean(enabled);
  writeMap(map);
}

/**
 * Plain-language "why" for readiness-driven training recommendations (rules engine, not generative AI).
 * @param {Record<string, any> | null | undefined} recommendation
 * @returns {string}
 */
export function getTrainingAdjustmentWhySentence(recommendation) {
  if (!recommendation) return '';
  const desc = String(recommendation.description || '').trim();
  if (desc) return desc;
  const type = String(recommendation.recommendation_type || '').toLowerCase();
  if (type === 'reduce_volume') {
    return 'Volume is reduced because your readiness and recovery signals suggest less workload today.';
  }
  if (type === 'reduce_intensity') {
    return 'Intensity is eased slightly because recent check-ins suggest mild fatigue or a small dip in readiness.';
  }
  if (type === 'recovery_session') {
    return 'A recovery-style session is suggested because readiness was very low together with poor sleep and high stress.';
  }
  if (type === 'deload_recommendation') {
    return 'A deload is suggested because readiness has been low across several recent check-ins.';
  }
  return '';
}

export function usePersonalAutoAdjustmentsToggle(userId) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!userId) {
      setEnabled(true);
      return;
    }
    setEnabled(getPersonalAutoAdjustmentsEnabled(userId));
  }, [userId]);

  const setEnabledPersist = useCallback(
    (next) => {
      if (!userId) return;
      const v = Boolean(next);
      setPersonalAutoAdjustmentsEnabled(userId, v);
      setEnabled(v);
    },
    [userId]
  );

  const toggle = useCallback(() => {
    setEnabledPersist(!enabled);
  }, [enabled, setEnabledPersist]);

  return { enabled, setEnabled: setEnabledPersist, toggle };
}
