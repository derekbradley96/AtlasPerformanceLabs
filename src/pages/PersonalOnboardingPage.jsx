/**
 * Personal (solo) onboarding: set up profile (name, weight, goals) then mark complete and go to dashboard.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, User, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function PersonalOnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState((profile?.display_name || user?.display_name || user?.email?.split('@')[0] || '').trim());
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  const handleComplete = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const patch = { onboarding_complete: true };
      if (displayName.trim()) patch.display_name = displayName.trim();
      await updateProfile(patch);
      toast.success("You're all set!");
      navigate('/home', { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Set up your profile</h1>
        <p className="text-slate-400 mb-8">A few details so we can personalise your experience.</p>

        <form onSubmit={handleComplete} className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <User className="w-4 h-4" /> Display name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="bg-slate-900 border-slate-700 text-white h-12"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Target className="w-4 h-4" /> Weight (optional)
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 75 kg"
              className="bg-slate-900 border-slate-700 text-white h-12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Goal (optional)</label>
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Build muscle, lose fat"
              className="bg-slate-900 border-slate-700 text-white h-12"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue to dashboard'}
          </Button>
        </form>
      </div>
    </div>
  );
}
