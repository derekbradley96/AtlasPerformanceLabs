import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { safeDate } from '@/lib/format';
import {
  Calendar, AlertCircle, Clock, CheckCircle2, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';

export default function CheckIns() {
  const navigate = useNavigate();
  const { user: authUser, isDemoMode } = useAuth();
  const [user, setUser] = useState(null);
  const displayUser = isDemoMode ? authUser : user;

  useEffect(() => {
    if (isDemoMode) return;
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, [isDemoMode]);

  const { data: profile } = useQuery({
    queryKey: ['trainer-profile', displayUser?.id],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ user_id: displayUser.id });
      return profiles[0] || null;
    },
    enabled: !!displayUser?.id && displayUser?.user_type === 'trainer' && !isDemoMode
  });

  const { data: checkinsData = [], isLoading } = useQuery({
    queryKey: ['trainer-checkins-queue', profile?.id],
    queryFn: () => base44.entities.CheckIn.filter({ trainer_id: profile?.id }, '-created_date', 50),
    enabled: !!profile?.id && !isDemoMode
  });
  const checkins = Array.isArray(isDemoMode ? [] : checkinsData) ? (isDemoMode ? [] : checkinsData) : [];

  const { data: clients = [] } = useQuery({
    queryKey: ['trainer-clients-checkins', profile?.id],
    queryFn: () => base44.entities.ClientProfile.filter({ trainer_id: profile?.id }),
    enabled: !!profile?.id && !isDemoMode
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-checkins'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!profile?.id && !isDemoMode
  });

  if (displayUser && displayUser.user_type !== 'trainer') {
    return <NotAuthorized />;
  }

  if (!isDemoMode && isLoading) {
    return <PageLoader />;
  }

  // Sort check-ins: overdue first, then submitted (newest first), then pending
  const sortedCheckins = [...checkins].sort((a, b) => {
    const now = new Date();
    const aDue = safeDate(a?.due_date);
    const bDue = safeDate(b?.due_date);
    const aOverdue = aDue && aDue < now && a?.status === 'pending';
    const bOverdue = bDue && bDue < now && b?.status === 'pending';

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    if (a?.status === 'submitted' && b?.status !== 'submitted') return -1;
    if (a?.status !== 'submitted' && b?.status === 'submitted') return 1;

    const ta = safeDate(b?.created_date ?? b?.created_at)?.getTime() ?? 0;
    const tb = safeDate(a?.created_date ?? a?.created_at)?.getTime() ?? 0;
    return ta - tb;
  });

  const pendingCount = checkins.filter(c => c?.status === 'pending' || c?.status === 'submitted').length;
  const overdueCount = checkins.filter(c => {
    const dueDate = safeDate(c?.due_date);
    return dueDate && dueDate < new Date() && c?.status === 'pending';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Check-Ins</h1>
            <p className="text-slate-400">
              {pendingCount} pending · {overdueCount} overdue
            </p>
          </div>
          <Button 
            onClick={() => navigate(createPageUrl('CheckInTemplates'))}
            variant="outline"
            className="border-slate-700"
          >
            Manage Templates
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {sortedCheckins.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No check-ins yet"
            description="Client check-ins will appear here when submitted."
            action={
              <Button 
                onClick={() => navigate(createPageUrl('CheckInTemplates'))}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Set Up Templates
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {sortedCheckins.map((checkin, index) => {
              if (checkin == null) return null;
              const client = Array.isArray(clients) ? clients.find(c => c?.id === checkin?.client_id) : null;
              const clientUser = Array.isArray(allUsers) ? allUsers.find(u => u?.id === client?.user_id) : null;
              const dueDate = safeDate(checkin?.due_date);
              const isOverdue = dueDate && dueDate < new Date() && checkin?.status === 'pending';
              const isSubmitted = checkin?.status === 'submitted';

              let statusColor = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
              let statusLabel = 'Pending';
              let statusIcon = Clock;

              if (isOverdue) {
                statusColor = 'bg-red-500/20 text-red-400 border-red-500/30';
                statusLabel = 'Overdue';
                statusIcon = AlertCircle;
              } else if (isSubmitted) {
                statusColor = 'bg-green-500/20 text-green-400 border-green-500/30';
                statusLabel = 'Submitted';
                statusIcon = CheckCircle2;
              } else if (checkin.status === 'reviewed') {
                statusColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                statusLabel = 'Reviewed';
                statusIcon = CheckCircle2;
              }

              const StatusIcon = statusIcon;

              return (
                <button
                  key={checkin?.id ?? `checkin-${index}`}
                  onClick={() => navigate(createPageUrl('ReviewCheckIn') + `?id=${checkin.id}`)}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{clientUser?.full_name || 'Client'}</h3>
                        <p className="text-sm text-slate-400">
                          Due: {dueDate ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColor}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusLabel}
                    </Badge>
                  </div>

                  {isSubmitted && checkin?.submitted_at && (() => {
                    const d = safeDate(checkin.submitted_at);
                    if (!d) return null;
                    return (
                      <p className="text-xs text-slate-500">
                        Submitted {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}