import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { createLead } from '@/lib/leadsStore';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';

export default function JoinPage() {
  const { slug } = useParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState('');
  const [gymName, setGymName] = useState('');
  const [availability, setAvailability] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    createLead({
      trainerSlug: slug || '',
      trainerId: null,
      name: name.trim(),
      email: email.trim(),
      goal: goal.trim() || 'general',
      phase: phase.trim(),
      gymName: gymName.trim(),
      availability: availability.trim(),
      notes: notes.trim(),
      source: 'join_link',
    });
    setSubmitted(true);
    toast.success("We've received your info!");
  };

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Invalid link.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: colors.bg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Card style={{ padding: spacing[24], textAlign: 'center', maxWidth: 360 }}>
          <h1 className="text-xl font-bold mb-2" style={{ color: colors.text }}>You’re on the list</h1>
          <p className="text-sm" style={{ color: colors.muted }}>
            Thanks for your interest. The coach will reach out soon.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col p-4"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="max-w-sm mx-auto w-full">
        <h1 className="text-xl font-bold text-center mb-1" style={{ color: colors.text }}>
          Join the program
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
          Enter your details and the coach will get in touch.
        </p>

        <Card style={{ padding: spacing[20] }}>
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Build muscle, lose fat"
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
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
            >
              <option value="">Select</option>
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
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
            />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Availability (optional)</label>
            <input
              type="text"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g. Mornings, weekends"
              className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
            />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else?"
              rows={3}
              className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 resize-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />
            <Button type="submit" variant="primary" style={{ width: '100%', marginTop: spacing[16] }}>
              Submit
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
