import React, { useState, useCallback } from 'react';
import { addLog, listLogs, getRollingAverage } from '@/lib/energy/energyRepo';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Lightweight daily energy (1–10) + optional sleep. Fast input UX.
 */
export default function DailyEnergyInput({ clientId }) {
  const [energy, setEnergy] = useState(() => {
    if (!clientId) return 5;
    const logs = listLogs(clientId, 1);
    const todayStr = today();
    const todayLog = logs.find((l) => l.date === todayStr);
    return todayLog?.energy ?? 5;
  });
  const [sleepHours, setSleepHours] = useState(() => {
    if (!clientId) return '';
    const logs = listLogs(clientId, 1);
    const todayStr = today();
    const todayLog = logs.find((l) => l.date === todayStr);
    const h = todayLog?.sleepHours;
    return h != null && h >= 0 ? String(h) : '';
  });
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    if (!clientId) return;
    addLog({
      clientId,
      date: today(),
      energy: Math.min(10, Math.max(1, Number(energy) || 5)),
      sleepHours: sleepHours === '' ? undefined : Math.min(24, Math.max(0, Number(sleepHours))),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [clientId, energy, sleepHours]);

  if (!clientId) return null;

  const { energyAvg: avg7, count } = getRollingAverage(clientId, 7);

  return (
    <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-xl p-4">
      <p className="text-sm text-slate-400 mb-2">Today&apos;s energy</p>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="range"
          min={1}
          max={10}
          value={energy}
          onChange={(e) => setEnergy(Number(e.target.value))}
          className="flex-1 min-w-[120px] h-2 rounded-full accent-blue-500"
        />
        <span className="text-white font-medium w-6">{energy}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-slate-500">Sleep (h):</label>
        <input
          type="number"
          min={0}
          max={24}
          step={0.5}
          placeholder="Optional"
          value={sleepHours}
          onChange={(e) => setSleepHours(e.target.value)}
          className="w-16 rounded bg-atlas-surface border border-atlas-border px-2 py-1 text-sm text-white"
        />
        <button
          type="button"
          onClick={handleSave}
          className="ml-auto text-sm font-medium px-3 py-1 rounded-lg bg-atlas-accent text-white hover:opacity-90"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {count > 0 && (
        <p className="text-xs text-slate-500 mt-2">7-day avg: {avg7.toFixed(1)}</p>
      )}
    </div>
  );
}
