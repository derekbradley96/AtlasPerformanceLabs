import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Users, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EnterInviteCode() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const trainerId = searchParams.get('trainerId');
  
  const [user, setUser] = useState(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const joinMutation = useMutation({
    mutationFn: async (inviteCode) => {
      // Validate code
      const result = await base44.functions.invoke('validateInviteCode', { code: inviteCode });
      if (!result.data.valid) {
        throw new Error(result.data.message || 'Invalid invite code');
      }

      const trainerProfileId = result.data.trainer_id;

      // Get or create client profile
      let clientProfiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      let clientProfile = clientProfiles[0];

      if (!clientProfile) {
        clientProfile = await base44.entities.ClientProfile.create({
          user_id: user.id,
          trainer_id: trainerProfileId,
          subscription_status: 'pending'
        });
      } else {
        await base44.entities.ClientProfile.update(clientProfile.id, {
          trainer_id: trainerProfileId
        });
      }

      // Update user role to client if needed
      if (user.user_type !== 'client') {
        await base44.auth.updateMe({ user_type: 'client' });
      }

      return clientProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['client-profile']);
      toast.success('Successfully joined trainer!');
      navigate(createPageUrl('MyProgram'));
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Please enter an invite code');
      return;
    }
    joinMutation.mutate(code.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-atlas-surfaceAlt via-atlas-primary to-atlas-surfaceAlt p-4 md:p-6 flex items-center justify-center pb-24">
      <div className="max-w-md w-full">
        <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-blue-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white text-center mb-2">Enter Invite Code</h1>
          <p className="text-slate-400 text-center mb-6">
            Join your trainer with their unique invite code
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="INVITE-XXXXX"
                className="bg-atlas-primary/50 border-atlas-border text-center text-lg font-mono"
                maxLength={20}
              />
              <p className="text-xs text-slate-500 mt-2 text-center">
                Get this code from your trainer
              </p>
            </div>

            <Button
              type="submit"
              disabled={joinMutation.isPending}
              className="w-full bg-atlas-accent hover:bg-atlas-accent/90"
            >
              {joinMutation.isPending ? (
                <>Joining...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Join Trainer</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(createPageUrl('FindTrainer'))}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Don't have a code? Find a trainer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}