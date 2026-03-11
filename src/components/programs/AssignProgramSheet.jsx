import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Search } from 'lucide-react';
import { getPrograms } from '@/lib/programsStore';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

async function mediumHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AssignProgramSheet({ clientId, clientName, onAssign, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);

  const programs = useMemo(() => getPrograms(), []);
  const filtered = useMemo(() => {
    if (!search.trim()) return programs;
    const q = search.trim().toLowerCase();
    return programs.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [programs, search]);

  const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
    return d.toISOString().slice(0, 10);
  };

  const handleSelectProgram = (prog) => {
    setSelectedProgram(prog);
    setEffectiveChoice(null);
  };

  const handleStartToday = async () => {
    await mediumHaptic();
    const today = new Date().toISOString().slice(0, 10);
    onAssign(selectedProgram.id, today);
    onClose();
  };

  const handleStartNextWeek = async () => {
    await mediumHaptic();
    onAssign(selectedProgram.id, getNextMonday());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <div style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="text-[17px] font-semibold" style={{ color: colors.text }}>Assign Program</h2>
        <button type="button" onClick={onClose} className="text-[15px] font-medium" style={{ color: colors.accent }}>Cancel</button>
      </div>
      {clientName && (
        <p className="text-[13px] px-4 pt-2" style={{ color: colors.muted }}>Assigning to {clientName}</p>
      )}
      {!selectedProgram ? (
        <>
          <div style={{ padding: spacing[12], paddingBottom: 0 }}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Search size={18} style={{ color: colors.muted }} />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search programs..."
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-[20px] focus:outline-none focus:ring-1"
                style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: spacing[16], paddingTop: spacing[8] }}>
            {filtered.length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>No programs found. Create one first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
                {filtered.map((prog) => (
                  <button
                    key={prog.id}
                    type="button"
                    onClick={() => handleSelectProgram(prog)}
                    className="text-left rounded-[20px] border transition-colors active:opacity-90"
                    style={{
                      padding: spacing[16],
                      background: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  >
                    <p className="text-[15px] font-semibold">{prog.name || 'Unnamed'}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: colors.muted }}>
                      v{prog.version ?? 1} · {(prog.goal || '').replace('_', ' ')} · {prog.duration_weeks} weeks · Updated {formatDate(prog.updated_date)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: spacing[16] }}>
          <Card style={{ marginBottom: spacing[16] }}>
            <p className="text-[13px]" style={{ color: colors.muted }}>Start date</p>
            <p className="text-[15px] font-semibold mt-1" style={{ color: colors.text }}>{selectedProgram.name}</p>
          </Card>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={handleStartToday}>Start today</Button>
            <Button variant="secondary" onClick={handleStartNextWeek}>Start next week</Button>
            <button type="button" onClick={() => setSelectedProgram(null)} className="text-sm font-medium" style={{ color: colors.muted, marginTop: spacing[8] }}>
              Choose another program
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
