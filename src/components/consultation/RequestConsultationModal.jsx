import React, { useState } from 'react';
import { createConsultationRequest } from '@/lib/consultationStore';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import BottomSheet from '@/components/ui/BottomSheet';

export default function RequestConsultationModal({ onClose, userId, userName, userEmail }) {
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState('');
  const [gymName, setGymName] = useState('');
  const [availability, setAvailability] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    createConsultationRequest({
      userId: userId || 'solo-user',
      userName: userName || 'Personal',
      userEmail: userEmail || '',
      goal,
      phase,
      gymName,
      availability,
      notes,
    });
    toast.success('Request sent! A trainer will reach out soon.');
    onClose?.();
  };

  return (
    /* Parent mounts this conditionally, so `open` is constant here. */
    <BottomSheet open onClose={() => onClose?.()} title="Request consultation" maxWidth={448} padded={false}>
      <form onSubmit={handleSubmit} style={{ padding: spacing[16], paddingTop: 0 }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Goal</label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Build muscle, lose fat, get stronger"
            className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Phase (optional)</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          >
            <option value="">Select phase</option>
            <option value="Cut">Cut</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Lean Bulk">Lean Bulk</option>
            <option value="Bulk">Bulk</option>
            <option value="Recomp">Recomp</option>
          </select>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Gym (optional)</label>
          <input
            type="text"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="e.g. City Fitness"
            className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Availability</label>
          <input
            type="text"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="e.g. Mornings, weekends"
            className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else you'd like to share..."
            rows={3}
            className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 resize-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          />
          <div className="flex gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" variant="primary" style={{ flex: 1 }}>Send request</Button>
          </div>
      </form>
    </BottomSheet>
  );
}
