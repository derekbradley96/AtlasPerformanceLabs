import React, { useState } from 'react';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const CARD_BG = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';

const CATEGORIES = ['Travel', 'Software', 'Equipment', 'Other'];

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function AddReceiptModal({ onClose, onAdded }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    const a = parseFloat(amount);
    if (!amount || isNaN(a) || a <= 0) return;
    const receipt = {
      id: `rec-${Date.now()}`,
      amount: a,
      date,
      category,
      note: note.trim() || '',
    };
    onAdded?.(receipt);
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
          <p className="text-[17px] font-semibold mb-3" style={{ color: colors.text }}>Add receipt</p>
          <div className="mb-3">
            <label className="block text-[12px] mb-1" style={{ color: colors.muted }}>Amount (£)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) setAmount(val);
              }}
              className="w-full rounded-xl px-4 py-3 text-[15px] border"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: BORDER, color: colors.text }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-[12px] mb-1" style={{ color: colors.muted }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-[15px] border"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: BORDER, color: colors.text }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-[12px] mb-1" style={{ color: colors.muted }}>Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium border-none"
                  style={{
                    background: category === c ? colors.accent : 'rgba(255,255,255,0.08)',
                    color: category === c ? '#fff' : colors.muted,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[12px] mb-1" style={{ color: colors.muted }}>Note (optional)</label>
            <input
              type="text"
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-[15px] border"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: BORDER, color: colors.text }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} style={{ flex: 1 }}>Add receipt</Button>
          </div>
        </div>
      </div>
    </>
  );
}
