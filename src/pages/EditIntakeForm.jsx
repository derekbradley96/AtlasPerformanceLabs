import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { PageLoader } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EditIntakeForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');
  
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    questions: [],
    is_active: true
  });

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: trainerProfile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.TrainerProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id && (user?.user_type === 'coach' || user?.user_type === 'trainer')
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ['intake-template', templateId],
    queryFn: async () => {
      const t = await base44.entities.IntakeFormTemplate.get(templateId);
      setForm({
        name: t.name,
        description: t.description || '',
        questions: t.questions || [],
        is_active: t.is_active ?? true
      });
      return t;
    },
    enabled: !!templateId
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...form,
        trainer_id: trainerProfile.id
      };
      
      if (templateId) {
        await base44.entities.IntakeFormTemplate.update(templateId, data);
      } else {
        await base44.entities.IntakeFormTemplate.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['intake-templates']);
      toast.success('Form saved');
      navigate(createPageUrl('IntakeForms'));
    }
  });

  if (!user) return <PageLoader />;
  if (user.user_type !== 'coach' && user.user_type !== 'trainer') return <NotAuthorized />;
  if (templateId && isLoading) return <PageLoader />;

  const addQuestion = () => {
    setForm({
      ...form,
      questions: [
        ...form.questions,
        {
          id: Date.now().toString(),
          text: '',
          type: 'text',
          required: false,
          options: []
        }
      ]
    });
  };

  const updateQuestion = (index, updates) => {
    const newQuestions = [...form.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setForm({ ...form, questions: newQuestions });
  };

  const deleteQuestion = (index) => {
    setForm({ ...form, questions: form.questions.filter((_, i) => i !== index) });
  };

  const moveQuestion = (index, direction) => {
    const newQuestions = [...form.questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setForm({ ...form, questions: newQuestions });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            {templateId ? 'Edit' : 'Create'} Intake Form
          </h1>
          <p className="text-slate-400 text-sm">Build a custom form to gather client information</p>
        </div>

        {/* Form Details */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Form Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Client Intake Form"
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this form for?"
                className="bg-slate-900 border-slate-700"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Active</p>
                <p className="text-xs text-slate-500">Show to new clients</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Questions</h2>
            <Button onClick={addQuestion} size="sm" className="bg-blue-500 hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-2" /> Add Question
            </Button>
          </div>

          <div className="space-y-3">
            {form.questions.map((question, index) => (
              <div key={question.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-4">
                  <button className="mt-2 text-slate-500 hover:text-white cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <div className="flex-1 space-y-3">
                    <Input
                      value={question.text}
                      onChange={(e) => updateQuestion(index, { text: e.target.value })}
                      placeholder="Question text"
                      className="bg-slate-900 border-slate-700"
                    />
                    <div className="flex gap-3">
                      <Select
                        value={question.type}
                        onValueChange={(value) => updateQuestion(index, { type: value })}
                      >
                        <SelectTrigger className="w-40 bg-slate-900 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Short text</SelectItem>
                          <SelectItem value="multiline">Long text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="choice">Multiple choice</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={question.required}
                          onCheckedChange={(checked) => updateQuestion(index, { required: checked })}
                        />
                        <span className="text-xs text-slate-500">Required</span>
                      </div>
                    </div>
                    {question.type === 'choice' && (
                      <Textarea
                        value={question.options?.join('\n') || ''}
                        onChange={(e) => updateQuestion(index, { options: e.target.value.split('\n').filter(Boolean) })}
                        placeholder="One option per line"
                        className="bg-slate-900 border-slate-700"
                        rows={3}
                      />
                    )}
                  </div>
                  <Button
                    onClick={() => deleteQuestion(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {form.questions.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No questions yet. Click "Add Question" to get started.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl('IntakeForms'))}
            variant="outline"
            className="flex-1 border-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name || form.questions.length === 0}
            className="flex-1 bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Form'}
          </Button>
        </div>
      </div>
    </div>
  );
}