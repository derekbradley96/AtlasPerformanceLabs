/**
 * Apple Health reads (iOS only): today's steps and last night's sleep, used to
 * pre-fill the workout readiness sheet.
 *
 * Written against the ACTUAL capacitor-healthkit@0.2.1 contract — the previous
 * wrapper probed exports (Health/HealthKit/default) and call shapes (query/
 * readData) that this plugin has never had, so every call silently no-oped.
 * The real contract (ios/Plugin/Plugin.swift + Plugin.m):
 *  - native plugin name "CapacitorHealthkit", reached via registerPlugin()
 *  - requestAuthorization({ all, read, write }) — ALL three keys required;
 *    vocabulary is steps|stairs|duration|activity|calories|distance|
 *    bloodGlucose ('activity' covers sleepAnalysis + workouts)
 *  - queryHKitSampleType({ sampleName, startDate, endDate, limit }) — limit 0
 *    means no limit; resolves { countReturn, resultData: [...] }
 *  - sleep rows: { duration (hours), sleepState: 'Asleep'|'InBed', ... }
 *  - there is NO body-mass type and NO write method in this plugin version,
 *    so the old writeWeightToHealth was unimplementable and has been removed.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

const isAvailable = () =>
  typeof Capacitor !== 'undefined'
  && Capacitor.isNativePlatform?.()
  && Capacitor.getPlatform?.() === 'ios';

let healthkitProxy = null;
function getHealthkit() {
  if (!isAvailable()) return null;
  if (!healthkitProxy) healthkitProxy = registerPlugin('CapacitorHealthkit');
  return healthkitProxy;
}

export async function requestHealthPermissions() {
  const Healthkit = getHealthkit();
  if (!Healthkit) return false;
  try {
    await Healthkit.requestAuthorization({
      all: [],
      read: ['steps', 'activity'],
      write: [],
    });
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[appleHealth] permission failed:', e);
    }
    return false;
  }
}

async function querySamples(sampleName, startDate, endDate) {
  const Healthkit = getHealthkit();
  if (!Healthkit) return [];
  const result = await Healthkit.queryHKitSampleType({
    sampleName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit: 0,
  });
  return Array.isArray(result?.resultData) ? result.resultData : [];
}

export async function getTodaySteps() {
  if (!isAvailable()) return null;
  try {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const rows = await querySamples('stepCount', start, now);
    const total = rows.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
    return total > 0 ? Math.round(total) : null;
  } catch {
    return null;
  }
}

export async function getLastNightSleepHours() {
  if (!isAvailable()) return null;
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0); // from 6pm yesterday
    const rows = await querySamples('sleepAnalysis', start, now);
    // Prefer actual asleep segments; some sources only record InBed.
    const asleep = rows.filter((r) => r?.sleepState === 'Asleep');
    const segments = asleep.length ? asleep : rows;
    const hours = segments.reduce((sum, r) => sum + (Number(r?.duration) || 0), 0);
    return hours > 0 ? Math.round(hours * 10) / 10 : null;
  } catch {
    return null;
  }
}
