import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Search, Star, CheckCircle2, ArrowRight, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';

export default function FindTrainer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ['trainer-marketplace'],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('trainer-marketplace-list', { accepting_clients: true });
      const profiles = Array.isArray(data) ? data : [];
      const now = new Date();
      const rankedTrainers = profiles.map(trainer => {
        const created = trainer.created_date || trainer.created_at;
        const daysActive = created ? Math.floor((now - new Date(created)) / (1000 * 60 * 60 * 24)) : 0;
        const isNewTrainer = daysActive <= 30;
        let score = 0;
        if (isNewTrainer) score += 50;
        if (trainer.stripe_connected) score += 20;
        if (trainer.bio) score += 10;
        if (trainer.specialties?.length > 0) score += 10;
        score += Math.random() * 15;
        return { ...trainer, score };
      });
      return rankedTrainers.sort((a, b) => b.score - a.score);
    }
  });

  if (!user) return <PageLoader />;

  const searchTerm = search.toLowerCase();
  const filteredTrainers = trainers.filter(trainer =>
    trainer.display_name?.toLowerCase().includes(searchTerm) ||
    trainer.headline?.toLowerCase().includes(searchTerm) ||
    (Array.isArray(trainer.specialties) && trainer.specialties.some(s => String(s).toLowerCase().includes(searchTerm)))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white mb-1">Find a Trainer</h1>
        <p className="text-slate-400">Connect with certified fitness professionals</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or specialty..."
            className="pl-10 bg-slate-800/50 border-slate-700"
          />
        </div>

        {/* Trainers List */}
        {isLoading ? (
          <PageLoader />
        ) : filteredTrainers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No trainers match your search' : 'No trainers available yet'}
            description="Be the first to join the platform as a trainer"
            action={
              <Button
                onClick={() => navigate(createPageUrl('BecomeATrainer'))}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Become a Trainer
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {filteredTrainers.map((trainer) => (
                <button
                  key={trainer.id}
                  onClick={() => navigate(createPageUrl('TrainerPublicProfile') + `?id=${trainer.id}`)}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl flex items-center justify-center shrink-0">
                      {trainer.avatar_url ? (
                        <img src={trainer.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <Users className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-white mb-1">{trainer.display_name}</h3>
                          {trainer.headline && (
                            <p className="text-sm text-slate-400 line-clamp-1">{trainer.headline}</p>
                          )}
                        </div>
                        {trainer.accepting_clients && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Accepting
                          </Badge>
                        )}
                      </div>

                      {trainer.specialties && trainer.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {trainer.specialties.slice(0, 3).map((spec, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-blue-500/10 text-blue-300 rounded-lg">
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          {trainer.monthly_rate && (
                            <span className="font-semibold text-white">
                              £{(trainer.monthly_rate / 100).toFixed(0)}/month
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span>5.0</span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-500" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}