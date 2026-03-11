/**
 * Energy logs persistence (localStorage). Swap to API later.
 */
import type { EnergyLog } from './energyTypes';

const KEY = 'atlas_energy_logs';
const MAX_LOGS_PER_CLIENT = 90;

function safeGet(): EnergyLog[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeSet(list: EnergyLog[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(list));
    }
  } catch {}
}

export function addLog(log: Omit<EnergyLog, 'id'>): EnergyLog {
  const list = safeGet();
  const entry: EnergyLog = {
    ...log,
    id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
  const existing = list.findIndex(
    (e) => e.clientId === log.clientId && e.date === log.date
  );
  if (existing >= 0) list[existing] = entry;
  else list.push(entry);
  list.sort((a, b) => b.date.localeCompare(a.date));
  const byClient = new Map<string, EnergyLog[]>();
  list.forEach((e) => {
    const arr = byClient.get(e.clientId) ?? [];
    arr.push(e);
    byClient.set(e.clientId, arr);
  });
  const trimmed: EnergyLog[] = [];
  byClient.forEach((arr) => {
    trimmed.push(...arr.slice(0, MAX_LOGS_PER_CLIENT));
  });
  trimmed.sort((a, b) => b.date.localeCompare(a.date));
  safeSet(trimmed);
  return entry;
}

export function listLogs(clientId: string, windowDays: number): EnergyLog[] {
  const list = safeGet().filter((e) => e.clientId === clientId);
  if (windowDays <= 0) return list;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return list.filter((e) => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));
}

export function getRollingAverage(
  clientId: string,
  days: number
): { energyAvg: number; sleepAvg: number | null; count: number } {
  const logs = listLogs(clientId, days);
  if (logs.length === 0) return { energyAvg: 0, sleepAvg: null, count: 0 };
  const energySum = logs.reduce((s, e) => s + e.energy, 0);
  const sleepEntries = logs.filter((e) => e.sleepHours != null && e.sleepHours >= 0);
  const sleepSum = sleepEntries.reduce((s, e) => s + (e.sleepHours ?? 0), 0);
  return {
    energyAvg: Math.round((energySum / logs.length) * 10) / 10,
    sleepAvg: sleepEntries.length > 0 ? Math.round((sleepSum / sleepEntries.length) * 10) / 10 : null,
    count: logs.length,
  };
}
