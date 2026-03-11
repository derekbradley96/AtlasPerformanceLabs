import React, { useState } from 'react';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const CARD_BG = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';

export default function AddTaskModal({ onClose, onAdd }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('med');

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, subtitle: note.trim(), priority });
    onClose();
  };

  return (
    <>
      <div role="presentation" className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div
        className="fixed left-4 right-4 z-50 rounded-2xl overflow-hidden border"
        style={{ top: '50%', transform: 'translateY(-50%)', background: CARD_BG, borderColor: BORDER }}
      >
        <div style={{ padding: spacing[16] }}>
          <p className="text-[17px] font-semibold mb-3" style={{ color: colors.text }}>Add task</p>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] mb-2 border"
            style={{ background: 'rgba(255,255,255,0.08)', borderColor: BORDER, color: colors.text }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] mb-3 border"
            style={{ background: 'rgba(255,255,255,0.08)', borderColor: BORDER, color: colors.text }}
          />
          <div className="flex gap-2 mb-4">
            {['low', 'med', 'high'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className="rounded-lg px-3 py-2 text-[13px] font-medium border-none"
                style={{
                  background: priority === p ? colors.accent : 'rgba(255,255,255,0.08)',
                  color: priority === p ? '#fff' : colors.muted,
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} style={{ flex: 1 }}>Add</Button>
          </div>
        </div>
      </div>
    </>
  );
}
