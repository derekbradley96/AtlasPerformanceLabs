import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction, normalizeInviteCode } from '@/lib/supabaseApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { trackPersonalConvertedToClient } from '@/services/analyticsService';
import { Users, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EnterInviteCode() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const trainerId = searchParams.get('trainerId');
  const [code, setCode] = useState('');

  const joinMutation = useMutation({
    mutationFn: async (inviteCode) => {
      if (!user?.id) throw new Error('Please sign in first');
      const result = await invokeSupabaseFunction('validateInviteCode', { code: normalizeInviteCode(inviteCode) });
      if (result.error || !result.data?.valid) {
        throw new Error(result.data?.message || result.error || 'Invalid invite code');
      }
      const coachProfileId = result.data.trainer_id ?? result.data.coach_id;
      const { data: profileList } = await invokeSupabaseFunction('client-profile-list', { user_id: user.id });
      const list = Array.isArray(profileList) ? profileList : [];
      let clientProfile = list[0];
      if (!clientProfile) {
        const { data: created } = await invokeSupabaseFunction('client-profile-create', {
          user_id: user.id,
          coach_id: coachProfileId,
          trainer_id: coachProfileId,
          subscription_status: 'pending'
        });
        clientProfile = created ?? null;
      } else {
        await invokeSupabaseFunction('client-profile-update', {
          id: clientProfile.id,
          coach_id: coachProfileId,
          trainer_id: coachProfileId
        });
      }
      if (user.user_type !== 'client') {
        await invokeSupabaseFunction('user-update-role', { user_type: 'client' });
      }
      const wasPersonal = (user.user_type === 'personal' || user.user_type === 'solo');
      return { clientProfile, coach_id: coachProfileId, was_personal: wasPersonal };
    },
    onSuccess: (result) => {
      if (result?.was_personal && result?.coach_id) {
        trackPersonalConvertedToClient({ coach_id: result.coach_id }).catch(() => {});
      }
      queryClient.invalidateQueries(['client-profile']);
      toast.success('Successfully joined coach!');
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
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Join Coach</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(createPageUrl('FindTrainer'))}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Don't have a code? Find a coach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}