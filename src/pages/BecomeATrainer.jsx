import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function BecomeATrainer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    display_name: '',
    headline: '',
    specialties: [],
    monthly_rate: '',
    bio: '',
    whats_included: ['Custom Programs', 'Weekly Check-ins', '1:1 Coaching'],
    experience: '',
    accepting_clients: true
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, display_name: user.full_name || user.name || '' }));
    }
  }, [user]);

  const createProfileMutation = useMutation({
    mutationFn: async (data) => {
      const { data: codeResult } = await invokeSupabaseFunction('generateInviteCode', {});
      const code = codeResult?.code ?? `FITX-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const { data: profile } = await invokeSupabaseFunction('trainer-profile-create', {
        user_id: user?.id,
        display_name: data.display_name,
        headline: data.headline,
        specialties: data.specialties.filter(s => s.trim()),
        monthly_rate: parseFloat(data.monthly_rate) * 100,
        bio: data.bio,
        whats_included: data.whats_included.filter(i => i.trim()),
        experience: data.experience,
        accepting_clients: data.accepting_clients,
        invite_code: code,
        stripe_connected: false
      });
      await invokeSupabaseFunction('user-update-role', { user_type: 'trainer' });
      return profile ?? { invite_code: code };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['trainer-profile']);
      toast.success('Trainer profile created!');
      navigate(createPageUrl('Home'));
    }
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.display_name || !formData.headline || !formData.monthly_rate) {
        toast.error('Please fill in all required fields');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = () => {
    createProfileMutation.mutate(formData);
  };

  const specialtyOptions = [
    'Fat Loss', 'Muscle Gain', 'Strength Training', 'Powerlifting',
    'Olympic Lifting', 'Bodybuilding', 'CrossFit', 'Nutrition',
    'Mobility', 'Injury Rehab', 'Sports Performance', 'Online Coaching'
  ];

  const toggleSpecialty = (specialty) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Become a Trainer</h1>
          <p className="text-slate-400">Step {step} of 3</p>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Progress */}
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full ${
                  s <= step ? 'bg-blue-500' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Basics */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Basic Information</h2>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Display Name *</label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="John Smith"
                    className="bg-slate-900/50 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Headline *</label>
                  <Input
                    value={formData.headline}
                    onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                    placeholder="e.g., Online Strength Coach"
                    className="bg-slate-900/50 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Monthly Price (£) *</label>
                  <Input
                    type="number"
                    value={formData.monthly_rate}
                    onChange={(e) => setFormData({ ...formData, monthly_rate: e.target.value })}
                    placeholder="99"
                    className="bg-slate-900/50 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">Specialties</label>
                  <div className="flex flex-wrap gap-2">
                    {specialtyOptions.map(spec => (
                      <button
                        key={spec}
                        onClick={() => toggleSpecialty(spec)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          formData.specialties.includes(spec)
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Profile Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Profile Details</h2>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Bio</label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell clients about your experience, coaching philosophy, and approach..."
                    className="bg-slate-900/50 border-slate-700"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Experience</label>
                  <Textarea
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    placeholder="Certifications, years of experience, achievements..."
                    className="bg-slate-900/50 border-slate-700"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">What's Included</label>
                  <p className="text-xs text-slate-500 mb-2">One item per line</p>
                  <Textarea
                    value={formData.whats_included.join('\n')}
                    onChange={(e) => setFormData({ ...formData, whats_included: e.target.value.split('\n') })}
                    className="bg-slate-900/50 border-slate-700"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Setup */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Final Setup</h2>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Accepting New Clients</p>
                    <p className="text-sm text-slate-400">Show in marketplace</p>
                  </div>
                  <Switch
                    checked={formData.accepting_clients}
                    onCheckedChange={(checked) => setFormData({ ...formData, accepting_clients: checked })}
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-sm text-blue-300 mb-2">
                    <CheckCircle2 className="w-4 h-4 inline mr-1" />
                    Your invite code will be generated automatically
                  </p>
                  <p className="text-xs text-slate-400">
                    Share this code with clients to invite them
                  </p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                  <p className="text-sm text-orange-300 mb-2">
                    ⚠️ Stripe Connection Required
                  </p>
                  <p className="text-xs text-slate-400">
                    Connect Stripe before inviting clients. You can do this later from your dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 1 && (
              <Button
                onClick={() => setStep(step - 1)}
                variant="outline"
                className="border-slate-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createProfileMutation.isPending}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                {createProfileMutation.isPending ? 'Creating...' : 'Complete Setup'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}