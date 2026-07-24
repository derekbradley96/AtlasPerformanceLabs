import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseClient';
import { isCoach } from '@/lib/roles';
import { colors } from '@/ui/tokens';

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div>
        <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>{label}</p>
        {hint ? (
          <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>{hint}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function EditCheckInTemplate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    focus_type: 'transformation',
    frequency: 'weekly',
    is_active: true,
    schedule_day_of_week: 6,
    schedule_time: '12:00',
    reminder_advance_minutes: 60,

    // Standard — always shown
    include_bodyweight: true,
    include_photos: true,
    include_wins: true,
    include_struggles: true,
    include_coach_questions_field: true,

    // Wellbeing
    include_energy: true,
    include_mood: true,
    include_sleep: true,
    include_stress: false,
    include_libido: false,

    // Nutrition
    include_water: false,
    include_hunger: false,
    include_digestion: false,
    include_supplements: false,

    // Training
    include_cardio: false,
    include_steps: false,
    include_strength_feeling: false,
    include_pump: false,
    include_recovery: false,

    // Body measurements
    include_measurements: false,
    include_waist: false,

    // Competition-specific (hidden unless focus_type = competition)
    include_posing: false,
    include_stage_condition: false,
    include_symmetry: false,
    include_peak_week_metrics: false,

    questions: [],
    response_templates: [
      "Great week — keep doing what you're doing.",
      "Let's adjust your calories based on this week's data.",
      "Consider reducing training volume to improve recovery.",
      'Perfect execution — no changes needed this week.',
    ],
  });

  const { isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !templateId) return null;
      const { data } = await supabase
        .from('checkin_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();
      if (data) {
        setFormData((prev) => ({ ...prev, ...data }));
      }
      return data;
    },
    enabled: !!templateId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const supabase = getSupabase();
      if (!supabase || !profile?.id) throw new Error('Not authenticated');

      const payload = {
        ...data,
        trainer_id: profile.id,
        coach_id: profile.id,
        updated_at: new Date().toISOString(),
      };

      if (templateId) {
        const { error } = await supabase
          .from('checkin_templates')
          .update(payload)
          .eq('id', templateId);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from('checkin_templates')
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['checkin-templates']);
      toast.success('Template saved!');
      navigate(createPageUrl('CheckInTemplates'));
    },
  });

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Please enter a template name');
      return;
    }
    setSaving(true);
    try {
      await saveMutation.mutateAsync(formData);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        { id: Date.now().toString(), text: '', type: 'text', required: false },
      ],
    });
  };

  const updateQuestion = (index, updates) => {
    const next = [...formData.questions];
    next[index] = { ...next[index], ...updates };
    setFormData({ ...formData, questions: next });
  };

  const removeQuestion = (index) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index),
    });
  };

  if (user && !isCoach(profile?.role)) {
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
            <Select
              value={formData.frequency}
              onValueChange={(value) => setFormData({ ...formData, frequency: value })}
            >
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

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 8 }}>
            Client goal type
          </label>
          <p style={{ fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 1.5 }}>
            This shows the right fields for this client&apos;s goal.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { value: 'transformation', label: '🏋️ Transformation' },
              { value: 'competition', label: '🏆 Competition prep' },
              { value: 'glp1', label: '💊 GLP-1 support' },
              { value: 'general', label: '💪 General fitness' },
              { value: 'integrated', label: '⚡ Integrated' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    focus_type: opt.value,
                    include_posing: opt.value === 'competition',
                    include_stage_condition: opt.value === 'competition',
                    include_symmetry: opt.value === 'competition',
                    include_peak_week_metrics: opt.value === 'competition',
                    include_cardio: opt.value === 'competition' ? true : formData.include_cardio,
                    // GLP-1 preset: strength- and lean-mass-first progress, with
                    // appetite/digestion visibility. Coaching-side only — no
                    // medication fields anywhere. Toggles are additive (never
                    // switch a section off the coach turned on) and the seeded
                    // questions only apply while the template has none yet.
                    ...(opt.value === 'glp1'
                      ? {
                          include_measurements: true,
                          include_waist: true,
                          include_hunger: true,
                          include_digestion: true,
                          include_water: true,
                          include_strength_feeling: true,
                          include_recovery: true,
                          include_stress: true,
                          questions: formData.questions.length ? formData.questions : [
                            { id: `glp1-protein-${Date.now()}`, text: 'Did you hit your protein target most days this week?', type: 'flag', required: true },
                            { id: `glp1-nausea-${Date.now() + 1}`, text: 'Any nausea or stomach discomfort this week?', type: 'flag', required: true },
                            { id: `glp1-fatigue-${Date.now() + 2}`, text: 'Any unusual fatigue or dizziness?', type: 'flag', required: true },
                            { id: `glp1-appetite-${Date.now() + 3}`, text: 'Appetite this week (1 = none, 10 = normal)', type: 'scale', required: false },
                            { id: `glp1-strength-${Date.now() + 4}`, text: 'How did your key lifts feel compared to last week?', type: 'text', required: false },
                          ],
                        }
                      : {}),
                  })
                }
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: `1px solid ${formData.focus_type === opt.value ? colors.primary : colors.border}`,
                  background: formData.focus_type === opt.value ? colors.primarySubtle : 'transparent',
                  color: formData.focus_type === opt.value ? colors.primary : colors.muted,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-2">Body & Weight</h2>
          <ToggleRow label="Bodyweight" checked={formData.include_bodyweight} onChange={(checked) => setFormData({ ...formData, include_bodyweight: checked })} />
          <ToggleRow label="Progress photos" checked={formData.include_photos} onChange={(checked) => setFormData({ ...formData, include_photos: checked })} />
          <ToggleRow label="Measurements (waist/chest/hip/thigh/arm)" checked={formData.include_measurements} onChange={(checked) => setFormData({ ...formData, include_measurements: checked })} />
          <ToggleRow label="Waist quick-check" checked={formData.include_waist} onChange={(checked) => setFormData({ ...formData, include_waist: checked })} />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-2">Nutrition & Hydration</h2>
          <ToggleRow label="Water intake" checked={formData.include_water} onChange={(checked) => setFormData({ ...formData, include_water: checked })} />
          <ToggleRow label="Nutrition adherence (always collected)" checked={true} onChange={() => {}} />
          <ToggleRow label="Hunger level" checked={formData.include_hunger} onChange={(checked) => setFormData({ ...formData, include_hunger: checked })} />
          <ToggleRow label="Digestion score" checked={formData.include_digestion} onChange={(checked) => setFormData({ ...formData, include_digestion: checked })} />
          <ToggleRow label="Supplement adherence" checked={formData.include_supplements} onChange={(checked) => setFormData({ ...formData, include_supplements: checked })} />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-2">Training</h2>
          <ToggleRow label="Training completion (always collected)" checked={true} onChange={() => {}} />
          <ToggleRow label="Cardio completion" checked={formData.include_cardio} onChange={(checked) => setFormData({ ...formData, include_cardio: checked })} />
          <ToggleRow label="Steps average" checked={formData.include_steps} onChange={(checked) => setFormData({ ...formData, include_steps: checked })} />
          <ToggleRow label="Strength feeling" checked={formData.include_strength_feeling} onChange={(checked) => setFormData({ ...formData, include_strength_feeling: checked })} />
          <ToggleRow label="Pump quality" checked={formData.include_pump} onChange={(checked) => setFormData({ ...formData, include_pump: checked })} />
          <ToggleRow label="Recovery score" checked={formData.include_recovery} onChange={(checked) => setFormData({ ...formData, include_recovery: checked })} />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-2">Wellbeing</h2>
          <ToggleRow label="Energy" checked={formData.include_energy} onChange={(checked) => setFormData({ ...formData, include_energy: checked })} />
          <ToggleRow label="Sleep quality" checked={formData.include_sleep} onChange={(checked) => setFormData({ ...formData, include_sleep: checked })} />
          <ToggleRow label="Mood" checked={formData.include_mood} onChange={(checked) => setFormData({ ...formData, include_mood: checked })} />
          <ToggleRow label="Stress" checked={formData.include_stress} onChange={(checked) => setFormData({ ...formData, include_stress: checked })} />
          <ToggleRow label="Libido" checked={formData.include_libido} onChange={(checked) => setFormData({ ...formData, include_libido: checked })} />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-2">Qualitative</h2>
          <ToggleRow label="Wins" checked={formData.include_wins} onChange={(checked) => setFormData({ ...formData, include_wins: checked })} />
          <ToggleRow label="Struggles" checked={formData.include_struggles} onChange={(checked) => setFormData({ ...formData, include_struggles: checked })} />
          <ToggleRow label="Coach questions field" checked={formData.include_coach_questions_field} onChange={(checked) => setFormData({ ...formData, include_coach_questions_field: checked })} />
        </div>

        {formData.focus_type === 'competition' ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-2">Competition</h2>
            <ToggleRow label="Posing minutes" checked={formData.include_posing} onChange={(checked) => setFormData({ ...formData, include_posing: checked })} />
            <ToggleRow label="Stage condition" checked={formData.include_stage_condition} onChange={(checked) => setFormData({ ...formData, include_stage_condition: checked })} />
            <ToggleRow label="Symmetry notes" checked={formData.include_symmetry} onChange={(checked) => setFormData({ ...formData, include_symmetry: checked })} />
            <ToggleRow label="Peak week metrics" checked={formData.include_peak_week_metrics} onChange={(checked) => setFormData({ ...formData, include_peak_week_metrics: checked })} />
          </div>
        ) : null}

        <div style={{ background: colors.surface1, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 16 }}>Schedule</h2>
          <p style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 1.5 }}>
            Clients will be prompted at this time each week. They&apos;ll get a reminder 1 hour before.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 8 }}>Check-in day</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }].map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, schedule_day_of_week: day.value })}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: `1px solid ${formData.schedule_day_of_week === day.value ? colors.primary : colors.border}`,
                    background: formData.schedule_day_of_week === day.value ? colors.primarySubtle : 'transparent',
                    color: formData.schedule_day_of_week === day.value ? colors.primary : colors.muted,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 8 }}>Check-in time</label>
            <input
              type="time"
              value={String(formData.schedule_time || '').slice(0, 5)}
              onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
              style={{
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: '10px 14px',
                color: colors.text,
                fontSize: 15,
                width: '100%',
                maxWidth: 200,
              }}
            />
            <p style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              Clients receive a reminder 1 hour before this time.
            </p>
          </div>
        </div>

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
                      <SelectItem value="flag">Yes / No</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Required</span>
                    <Switch checked={q.required} onCheckedChange={(checked) => updateQuestion(i, { required: checked })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

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
