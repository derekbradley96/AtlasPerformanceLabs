import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';

export default function AdminTrainersSection({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ['admin-trainers'],
    queryFn: () => base44.entities.TrainerProfile.list('-created_date'),
    enabled: isAdmin,
  });

  const logAction = async (action, targetId, oldValue, newValue) => {
    await base44.entities.AdminAuditLog.create({
      admin_email: adminEmail,
      action_type: action,
      target_type: 'TrainerProfile',
      target_id: targetId,
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      timestamp: new Date().toISOString()
    });
  };

  const updateTrainerMutation = useMutation({
    mutationFn: async ({ trainerId, data, oldData }) => {
      await base44.entities.TrainerProfile.update(trainerId, data);
      await logAction('trainer_updated', trainerId, oldData, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trainers'] });
      toast.success('Trainer updated');
    }
  });

  const filteredTrainers = trainers.filter(t =>
    t.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.headline?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={3} />;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trainers..."
          className="pl-10 bg-slate-800 border-slate-700"
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl divide-y divide-slate-700/50">
        {filteredTrainers.map((trainer) => (
          <div key={trainer.id} className="p-4 hover:bg-slate-800/70 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-medium text-white">{trainer.display_name}</p>
                  {trainer.is_founder && (
                    <Badge className="bg-yellow-500/20 text-yellow-400">⭐ Founder</Badge>
                  )}
                  {trainer.is_pro && (
                    <Badge className="bg-purple-500/20 text-purple-400">Pro</Badge>
                  )}
                </div>
                {trainer.headline && (
                  <p className="text-sm text-slate-400 mb-2">{trainer.headline}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Founder:</span>
                    <Switch
                      checked={trainer.is_founder || false}
                      onCheckedChange={(checked) => {
                        updateTrainerMutation.mutate({
                          trainerId: trainer.id,
                          data: { is_founder: checked },
                          oldData: { is_founder: trainer.is_founder }
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Early Access:</span>
                    <Switch
                      checked={trainer.early_access_fee || false}
                      onCheckedChange={(checked) => {
                        updateTrainerMutation.mutate({
                          trainerId: trainer.id,
                          data: { early_access_fee: checked },
                          oldData: { early_access_fee: trainer.early_access_fee }
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Accepting Clients:</span>
                    <Switch
                      checked={trainer.accepting_clients ?? true}
                      onCheckedChange={(checked) => {
                        updateTrainerMutation.mutate({
                          trainerId: trainer.id,
                          data: { accepting_clients: checked },
                          oldData: { accepting_clients: trainer.accepting_clients }
                        });
                      }}
                    />
                  </div>
                </div>
                {trainer.monthly_rate && (
                  <p className="text-xs text-slate-500 mt-2">
                    Rate: £{(trainer.monthly_rate / 100).toFixed(0)}/month
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTrainers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No trainers found</p>
        </div>
      )}
    </div>
  );
}