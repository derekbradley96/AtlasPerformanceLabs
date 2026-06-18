import { Capacitor } from '@capacitor/core';

const isAvailable = () =>
  typeof Capacitor !== 'undefined'
  && Capacitor.isNativePlatform?.()
  && Capacitor.getPlatform?.() === 'ios';

async function getHealthPlugin() {
  const mod = await import('capacitor-healthkit');
  return mod?.Health || mod?.HealthKit || mod?.default || null;
}

async function requestAuth(Health, payload) {
  if (!Health) return false;
  if (typeof Health.requestAuthorization === 'function') {
    await Health.requestAuthorization(payload);
    return true;
  }
  if (typeof Health.requestPermissions === 'function') {
    await Health.requestPermissions(payload);
    return true;
  }
  return false;
}

async function runQuery(Health, payload) {
  if (!Health) return null;
  if (typeof Health.query === 'function') return Health.query(payload);
  if (typeof Health.readData === 'function') return Health.readData(payload);
  return null;
}

async function runStore(Health, payload) {
  if (!Health) return null;
  if (typeof Health.store === 'function') return Health.store(payload);
  if (typeof Health.saveData === 'function') return Health.saveData(payload);
  return null;
}

function toItems(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.samples)) return result.samples;
  return [];
}

export async function requestHealthPermissions() {
  if (!isAvailable()) return false;
  try {
    const Health = await getHealthPlugin();
    await requestAuth(Health, {
      read: ['steps', 'sleep', 'weight', 'height'],
      write: ['weight'],
    });
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[appleHealth] permission failed:', e);
    }
    return false;
  }
}

export async function getTodaySteps() {
  if (!isAvailable()) return null;
  try {
    const Health = await getHealthPlugin();
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);

    const result = await runQuery(Health, {
      startDate: start.toISOString(),
      endDate: today.toISOString(),
      dataType: 'steps',
    });

    const total = toItems(result).reduce(
      (sum, item) => sum + (Number(item?.value) || 0), 0
    );
    return Math.round(total);
  } catch {
    return null;
  }
}

export async function getLastNightSleepHours() {
  if (!isAvailable()) return null;
  try {
    const Health = await getHealthPlugin();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0); // 6pm yesterday

    const result = await runQuery(Health, {
      startDate: yesterday.toISOString(),
      endDate: new Date().toISOString(),
      dataType: 'sleep',
    });

    // Sum sleep minutes and convert to hours
    const minutes = toItems(result).reduce(
      (sum, item) => sum + (Number(item?.value) || 0), 0
    );
    return minutes > 0 ? Math.round((minutes / 60) * 10) / 10 : null;
  } catch {
    return null;
  }
}

export async function writeWeightToHealth(weightKg) {
  if (!isAvailable()) return;
  try {
    const Health = await getHealthPlugin();
    await runStore(Health, {
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      dataType: 'weight',
      value: weightKg,
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[appleHealth] weight write failed:', e);
    }
  }
}
