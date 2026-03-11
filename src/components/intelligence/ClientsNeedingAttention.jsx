import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/lib/emptyApi';
import { AlertTriangle } from 'lucide-react';
import ClientAttentionCard from './ClientAttentionCard';
import { PageLoader } from '@/components/ui/LoadingState';

export default function ClientsNeedingAttention({ trainerId }) {
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['client-attention', trainerId],
    queryFn: async () => {
      // Get latest week snapshots for this trainer
      const allSnapshots = await base44.entities.ClientPerformanceSnapshot.filter({
        trainer_id: trainerId,
        needs_trainer_review: true
      }, '-review_priority');
      
      return allSnapshots;
    },
    enabled: !!trainerId
  });

  const { data: clients } = useQuery({
    queryKey: ['trainer-clients', trainerId],
    queryFn: () => base44.entities.ClientProfile.filter({ trainer_id: trainerId }),
    enabled: !!trainerId
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!clients
  });

  if (isLoading) return <PageLoader />;
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
        <p className="text-green-400 font-medium">🎉 All clients are progressing well!</p>
        <p className="text-sm text-slate-400 mt-1">No attention needed right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        <h3 className="font-semibold text-white">Clients Needing Attention</h3>
        <span className="ml-auto bg-orange-500/20 text-orange-400 text-xs font-semibold px-2 py-1 rounded-full">
          {snapshots.length}
        </span>
      </div>

      <div className="space-y-3">
        {snapshots.map((snapshot) => {
          const client = clients?.find(c => c.id === snapshot.client_id);
          const user = users?.find(u => u.id === client?.user_id);
          
          return (
            <ClientAttentionCard
              key={snapshot.id}
              snapshot={snapshot}
              clientName={user?.full_name || 'Unknown Client'}
              clientId={client?.id}
            />
          );
        })}
      </div>
    </div>
  );
}