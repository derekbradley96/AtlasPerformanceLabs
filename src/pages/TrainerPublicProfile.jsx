import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Users, CheckCircle2, Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';

function RequestCoachingButton({ trainerId, trainer }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    goal: 'general_fitness',
    message: ''
  });

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
      setFormData(prev => ({ ...prev, name: u.full_name || '' }));
    };
    loadUser();
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Lead.create({
        trainer_id: trainerId,
        user_id: user.id,
        name: data.name,
        email: user.email,
        goal: data.goal,
        message: data.message
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      toast.success('Request sent! ' + trainer.display_name + ' will be in touch soon.');
      setShowForm(false);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate(formData);
  };

  if (!showForm) {
    return (
      <Button
        onClick={() => setShowForm(true)}
        className="w-full bg-blue-500 hover:bg-blue-600"
      >
        <Send className="w-4 h-4 mr-2" />
        Request Coaching
      </Button>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
      <h3 className="font-semibold text-white mb-4">Request Coaching</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-2">Name</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="bg-slate-900/50 border-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Goal</label>
          <Select value={formData.goal} onValueChange={(v) => setFormData({ ...formData, goal: v })}>
            <SelectTrigger className="bg-slate-900/50 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fat_loss">Fat Loss</SelectItem>
              <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
              <SelectItem value="strength">Strength</SelectItem>
              <SelectItem value="general_fitness">General Fitness</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Message (Optional)</label>
          <Textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Tell the trainer about yourself..."
            className="bg-slate-900/50 border-slate-700"
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitMutation.isPending} className="flex-1 bg-blue-500 hover:bg-blue-600">
            {submitMutation.isPending ? 'Sending...' : 'Send Request'}
          </Button>
          <Button type="button" onClick={() => setShowForm(false)} variant="outline" className="border-slate-700">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function TrainerPublicProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trainerId = searchParams.get('id');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: trainer } = useQuery({
    queryKey: ['trainer-profile', trainerId],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ id: trainerId });
      return profiles[0];
    },
    enabled: !!trainerId
  });

  const { data: trainerUser } = useQuery({
    queryKey: ['trainer-user', trainer?.user_id],
    queryFn: async () => {
      const users = await base44.entities.User.filter({ id: trainer.user_id });
      return users[0];
    },
    enabled: !!trainer?.user_id
  });

  const { data: clientProfile } = useQuery({
    queryKey: ['my-client-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      return profiles[0];
    },
    enabled: !!user?.id
  });

  if (!trainer) return <PageLoader />;

  const hasTrainer = clientProfile?.trainer_id;
  const isThisTrainer = clientProfile?.trainer_id === trainerId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Cover */}
      {trainer.cover_image_url && (
        <div className="h-48 bg-gradient-to-br from-blue-600 to-blue-500">
          <img src={trainer.cover_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 md:p-6 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center -mt-16 relative">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-400 rounded-2xl flex items-center justify-center border-4 border-slate-950 mb-4">
            {trainer.avatar_url ? (
              <img src={trainer.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <Users className="w-16 h-16 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{trainer.display_name}</h1>
          {trainer.headline && (
            <p className="text-slate-400 mb-3">{trainer.headline}</p>
          )}
          <div className="flex items-center gap-2">
            {trainer.accepting_clients && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Accepting Clients
              </Badge>
            )}
            <div className="flex items-center gap-1 text-slate-400">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">5.0</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {trainer.bio && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">About</h2>
            <p className="text-slate-300 leading-relaxed">{trainer.bio}</p>
          </div>
        )}

        {/* Specialties */}
        {trainer.specialties && trainer.specialties.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {trainer.specialties.map((spec, i) => (
                <span key={i} className="px-3 py-1.5 bg-blue-500/10 text-blue-300 rounded-lg text-sm">
                  {spec}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* What's Included */}
        {trainer.whats_included && trainer.whats_included.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">What's Included</h2>
            <ul className="space-y-2">
              {trainer.whats_included.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pricing */}
        {trainer.monthly_rate && (
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/20 border border-blue-500/30 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Pricing</h2>
            <p className="text-3xl font-bold text-white mb-1">
              £{(trainer.monthly_rate / 100).toFixed(0)}
              <span className="text-lg text-slate-400 font-normal">/month</span>
            </p>
            <p className="text-sm text-slate-400">Cancel anytime</p>
          </div>
        )}

        {/* CTA */}
        <div className="space-y-3">
        {isThisTrainer ? (
          <Button disabled className="w-full bg-green-500/20 text-green-300 border border-green-500/30">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Your Current Trainer
          </Button>
        ) : hasTrainer ? (
          <Button disabled className="w-full" variant="outline">
            Switch Trainer (Coming Soon)
          </Button>
        ) : (
          <>
            <RequestCoachingButton trainerId={trainerId} trainer={trainer} />
            <Button
              onClick={() => navigate(createPageUrl('EnterInviteCode') + `?trainerId=${trainerId}`)}
              variant="outline"
              className="w-full border-slate-700"
            >
              Have an Invite Code?
            </Button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}