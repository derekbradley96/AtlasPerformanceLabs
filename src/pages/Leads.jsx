import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, MessageSquare, Send, UserPlus, Calendar, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';
import { toast } from 'sonner';
import { safeDate } from '@/lib/format';
import { getLeadsForTrainer, updateLeadStatus, updateLead } from '@/lib/leadsStore';
import { createClientStub } from '@/lib/clientStubStore';
import { logAuditEvent } from '@/lib/auditLogStore';
import { impactLight } from '@/lib/haptics';

export default function Leads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser, isDemoMode, coachFocus } = useAuth();
  const displayUser = authUser;

  const [newClientType, setNewClientType] = useState('general');

  const { data: profile } = useQuery({
    queryKey: ['trainer-profile', displayUser?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('trainer-profile-list', { user_id: displayUser?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] ?? null;
    },
    enabled: !!displayUser?.id && (displayUser?.user_type === 'coach' || displayUser?.user_type === 'trainer' || displayUser?.role === 'coach' || displayUser?.role === 'trainer') && !isDemoMode
  });

  const [demoLeadsRefresh, setDemoLeadsRefresh] = useState(0);
  const trainerId = isDemoMode ? 'demo-trainer' : (profile?.id ?? displayUser?.id);
  const demoLeads = useMemo(() => {
    const byDemo = getLeadsForTrainer('demo-trainer');
    const byTrainer1 = getLeadsForTrainer('trainer-1');
    const bySlugDemo = getLeadsForTrainer('demo');
    const all = [...byDemo, ...byTrainer1, ...bySlugDemo];
    return all.filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i).sort((a, b) => {
      const tA = new Date(a.created_date || a.createdAt || 0).getTime();
      const tB = new Date(b.created_date || b.createdAt || 0).getTime();
      return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
    });
  }, [demoLeadsRefresh]);
  const { data: leadsData = [], isLoading } = useQuery({
    queryKey: ['trainer-leads', profile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('lead-list', { trainer_id: profile?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!profile?.id && !isDemoMode
  });
  const leads = isDemoMode ? demoLeads : leadsData;

  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, data }) => {
      await invokeSupabaseFunction('lead-update', { lead_id: leadId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['trainer-leads']);
      toast.success('Lead updated');
    }
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (lead) => {
      const { data: convData } = await invokeSupabaseFunction('conversation-list', { trainer_id: profile?.id, client_id: lead.user_id });
      const conversations = Array.isArray(convData) ? convData : [];
      let conversation = conversations[0];
      if (!conversation) {
        const { data: created } = await invokeSupabaseFunction('conversation-create', { trainer_id: profile?.id, client_id: lead.user_id });
        conversation = created ?? { id: `conv-${Date.now()}` };
      }
      const message = `Hi ${lead.name}! 👋\n\nThanks for your interest in my coaching. I'd love to work with you!\n\nHere's your invite code: ${profile?.invite_code ?? 'N/A'}\n\nUse this code to join and we'll get started on your ${(lead.goal || '').replace('_', ' ')} journey!`;
      await invokeSupabaseFunction('message-create', { conversation_id: conversation.id, sender_type: 'trainer', sender_id: profile?.id, text: message });
      await invokeSupabaseFunction('conversation-update', { id: conversation.id, last_message_at: new Date().toISOString(), last_message_preview: message.substring(0, 50) });
      await invokeSupabaseFunction('lead-update', { lead_id: lead.id, status: 'contacted', contacted_at: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['trainer-leads']);
      toast.success('Invite sent!');
    }
  });

  if (displayUser && displayUser.user_type !== 'coach' && displayUser.user_type !== 'trainer' && displayUser?.role !== 'coach' && displayUser?.role !== 'trainer') {
    return <NotAuthorized />;
  }

  if (!isDemoMode && isLoading) return <PageLoader />;

  const newLeads = leads.filter(l => l.status === 'new' || !l.status);
  const contactedLeads = leads.filter(l => l.status === 'contacted');
  const convertedLeads = leads.filter(l => l.status === 'converted');
  const archivedLeads = leads.filter(l => l.status === 'archived');
  const activeLeads = leads.filter(l => l.status !== 'converted');

  const statusColors = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    booked_call: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    converted: 'bg-green-500/20 text-green-400 border-green-500/30',
    archived: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    declined: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const actorId = displayUser?.id ?? 'demo-trainer';
  const ownerId = trainerId;

  const handleMarkContacted = (lead) => {
    impactLight();
    updateLeadStatus(lead.id, 'contacted');
    logAuditEvent({ actorUserId: actorId, ownerTrainerUserId: ownerId, entityType: 'lead', entityId: lead.id, action: 'lead_status_changed', after: { status: 'contacted' } });
    if (isDemoMode) setDemoLeadsRefresh((n) => n + 1);
    else queryClient.invalidateQueries(['trainer-leads']);
    toast.success('Marked as contacted');
  };

  const handleBookCall = (lead) => {
    impactLight();
    updateLeadStatus(lead.id, 'booked_call');
    logAuditEvent({ actorUserId: actorId, ownerTrainerUserId: ownerId, entityType: 'lead', entityId: lead.id, action: 'lead_status_changed', after: { status: 'booked_call' } });
    if (isDemoMode) setDemoLeadsRefresh((n) => n + 1);
    else queryClient.invalidateQueries(['trainer-leads']);
    toast.success('Marked as booked call');
  };

  const handleArchive = (lead) => {
    impactLight();
    updateLeadStatus(lead.id, 'archived');
    logAuditEvent({ actorUserId: actorId, ownerTrainerUserId: ownerId, entityType: 'lead', entityId: lead.id, action: 'lead_status_changed', after: { status: 'archived' } });
    if (isDemoMode) setDemoLeadsRefresh((n) => n + 1);
    else queryClient.invalidateQueries(['trainer-leads']);
    toast.success('Archived');
  };

  const handleConvertToClient = (lead) => {
    impactLight();
    const trainerIdForStub = lead.trainerUserId || lead.trainerId || trainerId;
    const stub = createClientStub({
      leadId: lead.id,
      trainerId: trainerIdForStub,
      fullName: lead.applicantName || lead.name || 'New client',
      email: lead.email || '',
      client_type: coachFocus === 'integrated' ? newClientType : 'general',
    });
    updateLead(lead.id, { status: 'converted', clientId: stub.id });
    logAuditEvent({ actorUserId: actorId, ownerTrainerUserId: ownerId, entityType: 'lead', entityId: lead.id, action: 'lead_converted', after: { clientId: stub.id } });
    if (isDemoMode) setDemoLeadsRefresh((n) => n + 1);
    else queryClient.invalidateQueries(['trainer-leads']);
    toast.success('Converted to client');
    navigate(`/clients/${stub.id}`);
  };

  const handleMarkPaid = (lead) => {
    impactLight();
    const trainerIdForStub = lead.trainerUserId || lead.trainerId || trainerId;
    updateLead(lead.id, { paymentStatus: 'paid' });
    const stub = createClientStub({
      leadId: lead.id,
      trainerId: trainerIdForStub,
      fullName: lead.applicantName || lead.name || 'New client',
      email: lead.email || '',
      client_type: coachFocus === 'integrated' ? newClientType : 'general',
    });
    updateLead(lead.id, { status: 'converted', clientId: stub.id, paymentStatus: 'paid' });
    logAuditEvent({ actorUserId: actorId, ownerTrainerUserId: ownerId, entityType: 'lead', entityId: lead.id, action: 'lead_converted', after: { clientId: stub.id, paymentStatus: 'paid' } });
    if (isDemoMode) setDemoLeadsRefresh((n) => n + 1);
    else queryClient.invalidateQueries(['trainer-leads']);
    toast.success('Marked paid · Client created');
    navigate(`/clients/${stub.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white mb-1">Leads</h1>
        <p className="text-slate-400">
          {newLeads.length} new · {contactedLeads.length} contacted · {convertedLeads.length} converted · {archivedLeads.length} archived
        </p>
        {coachFocus === 'integrated' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-slate-400">New client type:</span>
            <select
              value={newClientType}
              onChange={(e) => setNewClientType(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 text-white"
            >
              <option value="general">General</option>
              <option value="prep">Prep</option>
            </select>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
        {activeLeads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads yet"
            description="When someone requests coaching from your profile, they'll appear here"
          />
        ) : (
          <div className="space-y-4">
            {activeLeads.map((lead) => (
              <div
                key={lead.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white mb-1">{lead.applicantName || lead.name || '—'}</h3>
                    <p className="text-sm text-slate-400">{lead.email || '—'}</p>
                  </div>
                  <Badge className={statusColors[lead.status] ?? statusColors.new}>
                    {lead.status}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Goal:</span>
                    <span className="text-white">{(lead.goal || '').slice(0, 80)}{(lead.goal || '').length > 80 ? '…' : ''}</span>
                  </div>
                  {lead.serviceSnapshot && (
                    <div className="text-sm text-slate-400">
                      Service: {lead.serviceSnapshot.name}
                      {lead.serviceSnapshot.priceMonthly != null && ` · £${(lead.serviceSnapshot.priceMonthly / 100).toFixed(0)}/mo`}
                    </div>
                  )}
                  {lead.message && (
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-sm text-slate-300">{lead.message}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Submitted {(safeDate(lead.created_date || lead.createdAt)?.toLocaleDateString?.('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) ?? '—')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(lead.status === 'new' || !lead.status) && !isDemoMode && (
                    <Button
                      onClick={() => sendInviteMutation.mutate(lead)}
                      disabled={sendInviteMutation.isPending}
                      className="flex-1 bg-blue-500 hover:bg-blue-600"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Invite
                    </Button>
                  )}
                  {(lead.status === 'new' || !lead.status || lead.status === 'contacted') && (
                    <Button
                      onClick={() => handleMarkContacted(lead)}
                      variant="outline"
                      className="border-slate-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Mark contacted
                    </Button>
                  )}
                  {(lead.status === 'new' || !lead.status || lead.status === 'contacted') && (
                    <Button
                      onClick={() => handleBookCall(lead)}
                      variant="outline"
                      className="border-slate-700"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book call
                    </Button>
                  )}
                  <Button
                    onClick={() => navigate('/messages')}
                    variant="outline"
                    className="flex-1 border-slate-700"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                  {(lead.status === 'contacted' || lead.status === 'new' || lead.status === 'booked_call' || !lead.status) && lead.status !== 'converted' && (
                    <>
                      <Button
                        onClick={() => handleMarkPaid(lead)}
                        variant="outline"
                        className="border-emerald-700"
                      >
                        <Banknote className="w-4 h-4 mr-2" />
                        Mark paid
                      </Button>
                      <Button
                        onClick={() => handleConvertToClient(lead)}
                        variant="outline"
                        className="border-green-700"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Convert to client
                      </Button>
                    </>
                  )}
                  {lead.status !== 'archived' && (
                    <Button
                      onClick={() => handleArchive(lead)}
                      variant="outline"
                      className="border-slate-700"
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}