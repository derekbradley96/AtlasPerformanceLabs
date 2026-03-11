import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Search, User, Star, Users, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export default function Coaches() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ['all-trainers'],
    queryFn: async () => [],
  });

  if (!isAuthenticated || !user) {
    navigate('/', { replace: true });
    return <PageLoader />;
  }

  const filteredTrainers = (trainers || []).filter(t =>
    (t.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.niche && t.niche.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Find a Coach</h1>
        <p className="text-slate-400">Connect with certified fitness professionals</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or specialty..."
          className="pl-10 bg-slate-800/50 border-slate-700 h-12"
        />
      </div>

      {/* Coach List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800/50 rounded-2xl p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-slate-700 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-slate-700 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-slate-700/70 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredTrainers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No coaches found"
          description={search ? "Try a different search term" : "No coaches available at the moment"}
        />
      ) : (
        <div className="space-y-4">
          {filteredTrainers.map((trainer, i) => (
            <motion.div
              key={trainer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl flex items-center justify-center shrink-0">
                  {trainer.avatar_url ? (
                    <img src={trainer.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{trainer.display_name}</h3>
                      {trainer.niche && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mt-1">
                          {trainer.niche}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        £{((trainer.monthly_rate || 0) / 100).toFixed(0)}
                      </p>
                      <p className="text-xs text-slate-500">/month</p>
                    </div>
                  </div>
                  
                  {trainer.bio && (
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">{trainer.bio}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400" />
                        4.9
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {Math.floor(Math.random() * 20) + 5} clients
                      </span>
                    </div>
                    <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                      Connect <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}