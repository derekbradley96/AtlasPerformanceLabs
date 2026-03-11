import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

export default function RequestCoaching() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const trainerId = searchParams.get('trainer_id');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    goal: 'fat_loss',
    message: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.full_name || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  const { data: trainer = null, isLoading: trainerLoading } = useQuery({
    queryKey: ['trainer-profile', trainerId],
    queryFn: async () => null,
    enabled: !!trainerId
  });

  const submitRequestMutation = useMutation({
    mutationFn: async () => ({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Request sent! The trainer will respond soon.');
      setTimeout(() => navigate(createPageUrl('Home')), 2000);
    }
  });

  if (!user) return <PageLoader />;
  if (trainerId && !trainerLoading && !trainer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <p className="text-slate-400">Trainer not found.</p>
      </div>
    );
  }
  if (trainerId && trainerLoading) return <PageLoader />;

  const displayName = trainer?.display_name ?? 'Your trainer';

  const handleSubmit = (e) => {
    e.preventDefault();
    submitRequestMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white mb-1">Request Coaching</h1>
        <p className="text-slate-400">Tell {displayName} about your goals</p>
      </div>

      <div className="p-4 md:p-6 max-w-2xl">
        {/* Trainer Info */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center overflow-hidden">
              {trainer?.avatar_url ? (
                <img src={trainer.avatar_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">{(displayName || 'T')[0]}</span>
              )}
            </div>
            <div>
              <h2 className="font-bold text-white text-lg">{displayName}</h2>
              {trainer?.headline && <p className="text-sm text-slate-400">{trainer.headline}</p>}
              {trainer?.monthly_rate && (
                <p className="text-blue-400 font-semibold mt-1">
                  £{(trainer.monthly_rate / 100).toFixed(0)}/month
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Request Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Your Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">Primary Goal</label>
            <select
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="fat_loss">Fat Loss</option>
              <option value="muscle_gain">Muscle Gain</option>
              <option value="strength">Strength</option>
              <option value="general_fitness">General Fitness</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">Tell the trainer about yourself</label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Share your fitness history, current situation, and what you're hoping to achieve..."
              className="bg-slate-800 border-slate-700 h-32"
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-white mb-1">What happens next?</p>
                <ul className="space-y-1 text-slate-400">
                  <li>• {displayName} will review your request</li>
                  <li>• If accepted, you'll be added as a client</li>
                  <li>• Payment starts only after acceptance</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitRequestMutation.isPending}
            className="w-full bg-blue-500 hover:bg-blue-600 h-12 text-base"
          >
            {submitRequestMutation.isPending ? 'Sending...' : 'Send Request'}
          </Button>
        </form>
      </div>
    </div>
  );
}