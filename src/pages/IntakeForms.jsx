import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Copy, FileText, CheckCircle2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function IntakeForms() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const { data: trainerProfile } = useQuery({
    queryKey: ['trainer-profile', displayUser?.id],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ user_id: displayUser.id });
      return profiles[0] || null;
    },
    enabled: !!displayUser?.id && displayUser?.user_type === 'trainer' && !isDemoMode
  });

  const { data: templatesData = [], isLoading } = useQuery({
    queryKey: ['intake-templates', trainerProfile?.id],
    queryFn: () => base44.entities.IntakeFormTemplate.filter({ trainer_id: trainerProfile.id }),
    enabled: !!trainerProfile?.id && !isDemoMode
  });
  const templates = isDemoMode ? [] : templatesData;

  const { data: responses = [] } = useQuery({
    queryKey: ['intake-responses', trainerProfile?.id],
    queryFn: () => base44.entities.IntakeFormResponse.filter({ trainer_id: trainerProfile.id }),
    enabled: !!trainerProfile?.id && !isDemoMode
  });

  const duplicateMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find(t => t.id === templateId);
      await base44.entities.IntakeFormTemplate.create({
        ...template,
        id: undefined,
        name: `${template.name} (Copy)`,
        created_date: undefined,
        updated_date: undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['intake-templates']);
      toast.success('Template duplicated');
    }
  });

  const createDefaultTemplates = async () => {
    const defaults = [
      {
        name: 'General Intake',
        description: 'Standard client onboarding questionnaire',
        questions: [
          { id: '1', text: 'What are your primary fitness goals?', type: 'multiline', required: true },
          { id: '2', text: 'Do you have any injuries or medical conditions?', type: 'multiline', required: true },
          { id: '3', text: 'How many days per week can you train?', type: 'choice', options: ['2-3 days', '4-5 days', '6-7 days'], required: true },
          { id: '4', text: 'What equipment do you have access to?', type: 'multiline', required: true },
          { id: '5', text: 'Previous training experience?', type: 'choice', options: ['Beginner', 'Intermediate', 'Advanced'], required: true }
        ]
      },
      {
        name: 'PAR-Q Medical Screening',
        description: 'Physical Activity Readiness Questionnaire',
        questions: [
          { id: '1', text: 'Has your doctor ever said you have a heart condition?', type: 'choice', options: ['Yes', 'No'], required: true },
          { id: '2', text: 'Do you feel pain in your chest during physical activity?', type: 'choice', options: ['Yes', 'No'], required: true },
          { id: '3', text: 'Do you lose balance or consciousness?', type: 'choice', options: ['Yes', 'No'], required: true },
          { id: '4', text: 'Do you have bone or joint problems?', type: 'choice', options: ['Yes', 'No'], required: true },
          { id: '5', text: 'Are you currently taking any medication?', type: 'multiline', required: false }
        ]
      },
      {
        name: 'Goals & Lifestyle',
        description: 'Understand client motivation and lifestyle',
        questions: [
          { id: '1', text: 'What motivates you to train?', type: 'multiline', required: true },
          { id: '2', text: 'What does a typical day look like for you?', type: 'multiline', required: true },
          { id: '3', text: 'How would you rate your stress levels (1-10)?', type: 'number', required: true },
          { id: '4', text: 'How many hours of sleep do you get per night?', type: 'number', required: true },
          { id: '5', text: 'What are your biggest obstacles to training?', type: 'multiline', required: true }
        ]
      }
    ];

    for (const template of defaults) {
      await base44.entities.IntakeFormTemplate.create({
        trainer_id: trainerProfile.id,
        ...template
      });
    }

    queryClient.invalidateQueries(['intake-templates']);
    toast.success('Default templates created');
  };

  if (!displayUser) return <PageLoader />;
  if (displayUser.user_type !== 'trainer') return <NotAuthorized />;
  if (!isDemoMode && isLoading) return <PageLoader />;

  const getCompletionCount = (templateId) => {
    return responses.filter(r => r.template_id === templateId).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Intake Forms</h1>
            <p className="text-slate-400">{templates.length} templates · {responses.length} responses</p>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button 
                onClick={createDefaultTemplates}
                variant="outline"
                className="border-slate-700"
              >
                Load Defaults
              </Button>
            )}
            <Button 
              onClick={() => navigate(createPageUrl('EditIntakeForm'))}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Form
            </Button>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="p-4 md:p-6">
        {templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No intake forms yet"
            description="Create custom intake forms to gather client information during onboarding."
            action={
              <div className="flex gap-2">
                <Button 
                  onClick={createDefaultTemplates}
                  variant="outline"
                  className="border-slate-700"
                >
                  Load Defaults
                </Button>
                <Button 
                  onClick={() => navigate(createPageUrl('EditIntakeForm'))}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Form
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      {template.is_active && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{template.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{template.questions?.length || 0} questions</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {getCompletionCount(template.id)} completed
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(createPageUrl('EditIntakeForm') + `?id=${template.id}`)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-slate-700"
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button
                    onClick={() => duplicateMutation.mutate(template.id)}
                    variant="outline"
                    size="sm"
                    className="border-slate-700"
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}