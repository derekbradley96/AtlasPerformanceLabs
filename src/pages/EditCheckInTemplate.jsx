import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/LoadingState';
import NotAuthorized from '@/components/NotAuthorized';
import { toast } from 'sonner';

export default function EditCheckInTemplate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    frequency: 'weekly',
    questions: [],
    include_bodyweight: true,
    include_photos: true,
    include_energy: true,
    include_mood: true,
    include_sleep: true,
    is_active: true,
    response_templates: [
      "Great job this week! Keep up the momentum.",
      "Let's adjust your calories slightly based on this data.",
      "Consider reducing volume next week to recover.",
      "Perfect execution - no changes needed."
    ]
  });

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
      return profiles[0] || null;
    },
    enabled: !!user?.id
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const templates = await base44.entities.CheckInTemplate.filter({ id: templateId });
      const t = templates[0];
      if (t) setFormData(t);
      return t;
    },
    enabled: !!templateId
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (templateId) {
        return await base44.entities.CheckInTemplate.update(templateId, data);
      } else {
        return await base44.entities.CheckInTemplate.create({ ...data, trainer_id: profile.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['checkin-templates']);
      toast.success('Template saved!');
      navigate(createPageUrl('CheckInTemplates'));
    }
  });

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Please enter a template name');
      return;
    }
    setSaving(true);
    await saveMutation.mutateAsync(formData);
    setSaving(false);
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          id: Date.now().toString(),
          text: '',
          type: 'text',
          required: false
        }
      ]
    });
  };

  const updateQuestion = (index, updates) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index)
    });
  };

  if (user && user.user_type !== 'trainer') {
    return <NotAuthorized />;
  }

  if (isLoading && templateId) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white">
          {templateId ? 'Edit Template' : 'Create Template'}
        </h1>
        <p className="text-slate-400">Configure your check-in template</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Basic Info */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Basic Info</h2>
          
          <div>
            <label className="block text-sm text-slate-400 mb-2">Template Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Weekly Progress Check"
              className="bg-slate-900/50 border-slate-700"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Frequency</label>
            <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Active</span>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </div>

        {/* Standard Fields */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Standard Fields</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Bodyweight</span>
              <Switch
                checked={formData.include_bodyweight}
                onCheckedChange={(checked) => setFormData({ ...formData, include_bodyweight: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Progress Photos</span>
              <Switch
                checked={formData.include_photos}
                onCheckedChange={(checked) => setFormData({ ...formData, include_photos: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Energy Level (1-10)</span>
              <Switch
                checked={formData.include_energy}
                onCheckedChange={(checked) => setFormData({ ...formData, include_energy: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Mood Level (1-10)</span>
              <Switch
                checked={formData.include_mood}
                onCheckedChange={(checked) => setFormData({ ...formData, include_mood: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Sleep Quality (1-10)</span>
              <Switch
                checked={formData.include_sleep}
                onCheckedChange={(checked) => setFormData({ ...formData, include_sleep: checked })}
              />
            </div>
          </div>
        </div>

        {/* Custom Questions */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Custom Questions</h2>
            <Button onClick={addQuestion} size="sm" variant="outline" className="border-slate-700">
              <Plus className="w-4 h-4 mr-2" /> Add Question
            </Button>
          </div>

          <div className="space-y-3">
            {formData.questions.map((q, i) => (
              <div key={q.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={q.text}
                    onChange={(e) => updateQuestion(i, { text: e.target.value })}
                    placeholder="Question text"
                    className="flex-1 bg-slate-800 border-slate-600"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeQuestion(i)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Select value={q.type} onValueChange={(value) => updateQuestion(i, { type: value })}>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="scale">Scale (1-10)</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Required</span>
                    <Switch
                      checked={q.required}
                      onCheckedChange={(checked) => updateQuestion(i, { required: checked })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl('CheckInTemplates'))}
            variant="outline"
            className="flex-1 border-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}