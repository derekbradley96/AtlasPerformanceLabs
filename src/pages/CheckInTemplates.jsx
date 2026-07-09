import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import FeatureHelpButton from '@/components/ui/FeatureHelpButton';
import { useAuth } from '@/lib/AuthContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Plus, FileText, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton, EmptyState } from '@/components/ui/LoadingState';
import { rememberLastCheckinTemplateForCoach } from '@/lib/checkinTemplatePrefs';
import NotAuthorized from '@/components/NotAuthorized';
import { getSupabase } from '@/lib/supabaseClient';
import { isCoach } from '@/lib/roles';
import { colors } from '@/ui/tokens';
import { toast } from 'sonner';

export default function CheckInTemplates() {
  const navigate = useNavigate();
  const { setHeaderRight } = useOutletContext() || {};
  const { user, profile } = useAuth();

  // AJB tester feedback #7: Learn-more affordance on creation screens.
  useEffect(() => {
    if (typeof setHeaderRight !== 'function') return undefined;
    setHeaderRight(<FeatureHelpButton feature="checkin-templates" />);
    return () => setHeaderRight(null);
  }, [setHeaderRight]);
  const supabase = getSupabase();
  const [assigningTemplateId, setAssigningTemplateId] = useState(null);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checkin-templates', profile?.id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !profile?.id) return [];
      const { data, error } = await supabase
        .from('checkin_templates')
        .select(`
          id, name, frequency, is_active,
          include_bodyweight, include_photos,
          include_energy, include_mood, include_sleep,
          questions, created_at
        `)
        .or(`trainer_id.eq.${profile.id},coach_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[CheckInTemplates]:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.id
  });

  const { data: coachClients = [] } = useQuery({
    queryKey: ['coach-clients-for-assign', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return [];

      // Step 1: get client rows
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, user_id, coach_id, trainer_id')
        .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`);

      if (error) {
        console.error('[CheckInTemplates] clients:', error);
        return [];
      }
      if (!clients?.length) return [];

      // Step 2: get display names in the same queryFn
      const userIds = clients
        .map(c => c.user_id)
        .filter(Boolean);

      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds)
        : { data: [] };

      // Step 3: merge - names are ready at the same time
      return clients.map(c => ({
        ...c,
        display_name:
          profiles?.find(p => p.id === c.user_id)
            ?.display_name ?? 'Client',
        avatar_url:
          profiles?.find(p => p.id === c.user_id)
            ?.avatar_url ?? null,
      }));
    },
    enabled: !!user?.id && !!supabase,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ templateId, clientIds }) => {
      const supabase = getSupabase();
      if (!supabase || !clientIds.length) return;
      const { error } = await supabase
        .from('clients')
        .update({ checkin_template_id: templateId })
        .in('id', clientIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template assigned to clients');
      setAssigningTemplateId(null);
      setSelectedClientIds([]);
    },
    onError: () => toast.error('Failed to assign template'),
  });

  const handleAssignTemplate = (templateId) => {
    setAssigningTemplateId(templateId);
    setSelectedClientIds([]);
  };

  if (user && !isCoach(profile?.role)) {
    return <NotAuthorized />;
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <CardSkeleton count={2} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Check-in templates</h1>
            <p className="text-slate-400">Create templates for client check-ins</p>
          </div>
          <Button 
            onClick={() => navigate(createPageUrl('EditCheckInTemplate'))}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Template
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Create your first check-in template to start tracking client progress."
            action={
              <Button 
                onClick={() => navigate(createPageUrl('EditCheckInTemplate'))}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" /> Create Template
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      <Badge className={
                        template.is_active 
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 capitalize">{template.frequency} check-ins</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      rememberLastCheckinTemplateForCoach(user?.id, template.id);
                      navigate(createPageUrl('EditCheckInTemplate') + `?id=${template.id}`);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => handleAssignTemplate(template.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1px solid ${colors.primary}`,
                      background: colors.primarySubtle,
                      color: colors.primary,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    Assign to clients
                  </button>
                </div>

                <div className="text-sm text-slate-400">
                  <p>{template.questions?.length || 0} custom questions</p>
                  <div className="flex gap-2 mt-2">
                    {template.include_bodyweight && <Badge variant="outline" className="text-xs">Weight</Badge>}
                    {template.include_photos && <Badge variant="outline" className="text-xs">Photos</Badge>}
                    {template.include_energy && <Badge variant="outline" className="text-xs">Energy</Badge>}
                    {template.include_mood && <Badge variant="outline" className="text-xs">Mood</Badge>}
                    {template.include_sleep && <Badge variant="outline" className="text-xs">Sleep</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assigningTemplateId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => e.target === e.currentTarget &&
            setAssigningTemplateId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center' }}>
          <div style={{
            width: '100%', maxWidth: 480,
            background: colors.surface,
            borderRadius: '16px 16px 0 0',
            padding: 20,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            maxHeight: '70vh', overflowY: 'auto',
          }}>
            <p style={{ fontSize: 16, fontWeight: 600,
              color: colors.text, marginBottom: 4 }}>
              Assign to clients
            </p>
            <p style={{ fontSize: 13, color: colors.muted,
              marginBottom: 16 }}>
              Select which clients should use this template.
            </p>
            {coachClients.length === 0 && (
              <p style={{ color: colors.muted, fontSize: 13 }}>
                No clients yet.
              </p>
            )}
            {coachClients.map(client => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientIds(prev =>
                  prev.includes(client.id)
                    ? prev.filter(id => id !== client.id)
                    : [...prev, client.id]
                )}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 14px', marginBottom: 8,
                  borderRadius: 12,
                  border: `1px solid ${
                    selectedClientIds.includes(client.id)
                      ? colors.primary : colors.border}`,
                  background: selectedClientIds.includes(client.id)
                    ? colors.primarySubtle : colors.surface1,
                  color: colors.text, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${selectedClientIds.includes(client.id) ? colors.primary : colors.border}`,
                  background: selectedClientIds.includes(client.id) ? colors.primary : 'transparent',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 14 }}>
                  {client.display_name}
                </span>
              </button>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button"
                onClick={() => setAssigningTemplateId(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12,
                  border: `1px solid ${colors.border}`, background: 'transparent',
                  color: colors.muted, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => assignMutation.mutate({
                  templateId: assigningTemplateId,
                  clientIds: selectedClientIds,
                })}
                disabled={selectedClientIds.length === 0}
                style={{ flex: 1, padding: '12px', borderRadius: 12,
                  border: 'none',
                  background: selectedClientIds.length === 0
                    ? colors.border : colors.primary,
                  color: '#fff', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600 }}>
                Assign to {selectedClientIds.length} client
                {selectedClientIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}