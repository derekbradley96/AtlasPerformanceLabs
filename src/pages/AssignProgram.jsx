import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
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

  const [user, setUser] = useState(null);
  const [selectedClients, setSelectedClients] = useState([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklySchedule, setWeeklySchedule] = useState([1, 3, 5]); // Mon, Wed, Fri
  const [clientNotes, setClientNotes] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: profile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ user_id: user.id });
      return profiles[0];
    },
    enabled: !!user?.id
  });

  const { data: program } = useQuery({
    queryKey: ['program', programId],
    queryFn: async () => {
      const programs = await base44.entities.Program.filter({ id: programId });
      return programs[0];
    },
    enabled: !!programId
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', profile?.id],
    queryFn: () => base44.entities.ClientProfile.filter({ trainer_id: profile.id }),
    enabled: !!profile?.id
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: clients.length > 0
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      // For each selected client, duplicate program and assign
      for (const clientId of selectedClients) {
        // Duplicate program
        const newProgram = await base44.entities.Program.create({
          ...program,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          is_template: false,
          template_id: programId
        });

        // Duplicate weeks/days/exercises
        const weeks = await base44.entities.ProgramWeek.filter({ program_id: programId });
        for (const week of weeks) {
          const newWeek = await base44.entities.ProgramWeek.create({
            program_id: newProgram.id,
            week_number: week.week_number,
            notes: week.notes
          });

          const days = await base44.entities.ProgramDay.filter({ program_week_id: week.id });
          for (const day of days) {
            const newDay = await base44.entities.ProgramDay.create({
              program_week_id: newWeek.id,
              day_number: day.day_number,
              name: day.name,
              notes: day.notes
            });

            const exercises = await base44.entities.ProgramExercise.filter({ program_day_id: day.id });
            for (const exercise of exercises) {
              await base44.entities.ProgramExercise.create({
                program_day_id: newDay.id,
                exercise_id: exercise.exercise_id,
                exercise_name: exercise.exercise_name,
                order: exercise.order,
                sets: exercise.sets,
                reps: exercise.reps,
                load: exercise.load,
                rest_seconds: exercise.rest_seconds,
                rpe_target: exercise.rpe_target,
                notes: exercise.notes,
                progression_type: exercise.progression_type,
                progression_trigger: exercise.progression_trigger
              });
            }
          }
        }

        // Create assignment
        await base44.entities.ClientProgramAssignment.create({
          client_id: clientId,
          program_id: newProgram.id,
          start_date: startDate,
          weekly_schedule: weeklySchedule,
          notes: clientNotes,
          status: 'active'
        });

        // Update client current program
        await base44.entities.ClientProfile.update(clientId, {
          current_program_id: newProgram.id
        });
      }
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
            {clients.map(client => {
              const clientUser = allUsers.find(u => u.id === client.user_id);
              return (
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
                    <span className="text-white">{clientUser?.full_name || 'Client'}</span>
                  </div>
                </button>
              );
            })}
            {clients.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No clients yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}