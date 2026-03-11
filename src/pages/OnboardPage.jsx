/**
 * Public onboarding funnel: /onboard/:trainerSlug
 * Captures: name, email, IG, goal (bulk/cut/maintenance), training age, gym name/equipment,
 * preferred consult time, notes. Inserts into leads with source=instagram or source=solo.
 */
import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { createLead } from '@/lib/leadsStore';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';

const inputClass = 'w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 mb-4';
const inputStyle = { background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text };

export default function OnboardPage() {
  const { trainerSlug } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') === 'solo' ? 'solo' : 'instagram';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState('');
  const [trainingAge, setTrainingAge] = useState('');
  const [gymName, setGymName] = useState('');
  const [gymEquipment, setGymEquipment] = useState('');
  const [preferredConsultTime, setPreferredConsultTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    createLead({
      trainerSlug: trainerSlug || '',
      trainerId: null,
      name: name.trim(),
      email: email.trim(),
      goal: goal.trim() || 'general',
      phase: phase.trim(),
      gymName: gymName.trim(),
      availability: preferredConsultTime.trim(),
      notes: [notes.trim(), instagram ? `IG: ${instagram}` : '', trainingAge ? `Training age: ${trainingAge}` : '', gymEquipment ? `Equipment: ${gymEquipment}` : ''].filter(Boolean).join(' · '),
      source,
    });
    setSubmitted(true);
    toast.success("We've received your info!");
  };

  if (!trainerSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.bg, color: colors.muted, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <p>Invalid link.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
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
      className="min-h-screen flex flex-col p-4 overflow-x-hidden"
      style={{ background: colors.bg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}
    >
      <div className="max-w-sm mx-auto w-full">
        <h1 className="text-xl font-bold text-center mb-1" style={{ color: colors.text }}>
          {source === 'solo' ? 'Request consultation' : 'Join the program'}
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: colors.muted }}>
          {source === 'solo' ? 'Tell us a bit about yourself and your goals.' : 'Enter your details and what to expect. The coach will get in touch.'}
        </p>

        <Card style={{ padding: spacing[20] }}>
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Instagram (optional)</label>
            <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Goal</label>
            <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Build muscle, lose fat" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Phase (optional)</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">Select</option>
              <option value="bulk">Bulk</option>
              <option value="cut">Cut</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Training age (optional)</label>
            <input type="text" value={trainingAge} onChange={(e) => setTrainingAge(e.target.value)} placeholder="e.g. 2 years" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Gym name (optional)</label>
            <input type="text" value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="e.g. City Fitness" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Gym equipment (optional)</label>
            <input type="text" value={gymEquipment} onChange={(e) => setGymEquipment(e.target.value)} placeholder="e.g. Full gym, home dumbbells" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Preferred consult time (optional)</label>
            <input type="text" value={preferredConsultTime} onChange={(e) => setPreferredConsultTime(e.target.value)} placeholder="e.g. Weekday evenings" className={inputClass} style={inputStyle} />
            <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else?" rows={3} className={`${inputClass} resize-none`} style={inputStyle} />
            <Button type="submit" variant="primary" style={{ width: '100%', marginTop: spacing[16] }}>Submit</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
