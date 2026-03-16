import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';

export default function AssignProgram() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const programId = searchParams.get('id');
  const { user } = useAuth();

  const [selectedClients, setSelectedClients] = useState([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklySchedule, setWeeklySchedule] = useState([1, 3, 5]); // Mon, Wed, Fri
  const [clientNotes, setClientNotes] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('trainer-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : (data ? [data] : []);
      return list[0] ?? null;
    },
    enabled: !!user?.id
  });

  const { data: program } = useQuery({
    queryKey: ['program', programId],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('program-get', { id: programId });
      return data ?? null;
    },
    enabled: !!programId
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', profile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-list-by-trainer', { trainer_id: profile?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!profile?.id
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await invokeSupabaseFunction('program-assign', {
        program_id: programId,
        client_ids: selectedClients,
        start_date: startDate,
        weekly_schedule: weeklySchedule,
        notes: clientNotes,
        trainer_id: profile?.id
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
      toast.success(`Program assigned to ${selectedClients.length} client(s)!`);
      navigate(createPageUrl('Programs'));
    }
  });

  if (!program) {
    return <PageLoader />;
  }

  const toggleClient = (clientId) => {
    setSelectedClients(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const toggleDay = (day) => {
    setWeeklySchedule(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={selectedClients.length === 0 || assignMutation.isPending}
            className="bg-green-500 hover:bg-green-600"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Assign to {selectedClients.length} Client{selectedClients.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">{program.name}</h2>
          <p className="text-sm text-slate-400">{program.duration_weeks} weeks · {program.goal?.replace('_', ' ')}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Start Date</h3>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-900/50 border-slate-700"
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Weekly Schedule</h3>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <button
                key={index}
                onClick={() => toggleDay(index)}
                className={`p-3 rounded-xl text-sm font-medium transition-colors ${
                  weeklySchedule.includes(index)
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-900'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Client-Specific Notes (Optional)</h3>
          <Textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            placeholder="e.g., Focus on form, Deload week 3..."
            className="bg-slate-900/50 border-slate-700"
            rows={3}
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Select Clients</h3>
          <div className="space-y-2">
            {clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => toggleClient(client.id)}
                  className={`w-full p-4 rounded-xl border transition-colors text-left ${
                    selectedClients.includes(client.id)
                      ? 'bg-blue-500/20 border-blue-500/30'
                      : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedClients.includes(client.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-slate-600'
                    }`}>
                      {selectedClients.includes(client.id) && (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="text-white">{client?.name || client?.full_name || 'Client'}</span>
                  </div>
                </button>
              ))}
            {clients.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No clients yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}