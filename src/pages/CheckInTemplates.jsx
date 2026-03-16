import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Plus, FileText, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton, EmptyState } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';

export default function CheckInTemplates() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('trainer-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : (data ? [data] : []);
      return list[0] ?? null;
    },
    enabled: !!user?.id
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checkin-templates', profile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('checkin-template-list', { trainer_id: profile?.id });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!profile?.id
  });

  if (user && user.user_type !== 'coach' && user.user_type !== 'trainer') {
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
            <h1 className="text-2xl font-bold text-white">Check-In Templates</h1>
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
                    onClick={() => navigate(createPageUrl('EditCheckInTemplate') + `?id=${template.id}`)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
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
    </div>
  );
}