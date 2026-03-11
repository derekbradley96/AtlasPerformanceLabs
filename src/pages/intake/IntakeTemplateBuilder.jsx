import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
} from 'lucide-react';
import { getTemplate, updateTemplate, createOnboardingToken } from '@/lib/intake/intakeTemplateRepo';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { getAppOrigin } from '@/lib/appOrigin';

const QUESTION_TYPES = [
  { value: 'shortText', label: 'Short text' },
  { value: 'longText', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'yesNo', label: 'Yes / No' },
  { value: 'singleSelect', label: 'Single choice' },
  { value: 'multiSelect', label: 'Multiple choice' },
  { value: 'date', label: 'Date' },
];

function newSectionId() {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
function newQuestionId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function IntakeTemplateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState('coaching');
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    if (!id) return;
    const t = getTemplate(id);
    if (!t || t.trainerId !== trainerId) {
      toast.error('Template not found');
      navigate('/intake-templates');
      return;
    }
    setTemplate(t);
    setName(t.name || '');
    setServiceType(t.serviceType || 'coaching');
    setSections(Array.isArray(t.sections) ? t.sections : []);
  }, [id, trainerId, navigate]);

  const save = useCallback(() => {
    if (!template?.id || !trainerId) return;
    setSaving(true);
    updateTemplate(template.id, { name, serviceType, sections });
    setSaving(false);
    toast.success('Saved');
    impactLight();
  }, [template?.id, trainerId, name, serviceType, sections]);

  const addSection = useCallback(() => {
    impactLight();
    setSections((prev) => [
      ...prev,
      { id: newSectionId(), title: 'New section', order: prev.length, questions: [] },
    ]);
  }, []);

  const updateSection = useCallback((sectionId, patch) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s))
    );
  }, []);

  const removeSection = useCallback((sectionId) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }, []);

  const moveSection = useCallback((sectionId, dir) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const addQuestion = useCallback((sectionId) => {
    impactLight();
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const questions = s.questions ?? [];
        const q = {
          id: newQuestionId(),
          type: 'shortText',
          label: 'New question',
          required: false,
          order: questions.length,
        };
        return { ...s, questions: [...questions, q] };
      })
    );
  }, []);

  const updateQuestion = useCallback((sectionId, questionId, patch) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const questions = (s.questions ?? []).map((q) =>
          q.id === questionId ? { ...q, ...patch } : q
        );
        return { ...s, questions };
      })
    );
  }, []);

  const removeQuestion = useCallback((sectionId, questionId) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, questions: (s.questions ?? []).filter((q) => q.id !== questionId) }
          : s
      )
    );
  }, []);

  const moveQuestion = useCallback((sectionId, questionId, dir) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const questions = [...(s.questions ?? [])];
        const idx = questions.findIndex((q) => q.id === questionId);
        if (idx < 0) return s;
        const next = idx + dir;
        if (next < 0 || next >= questions.length) return s;
        [questions[idx], questions[next]] = [questions[next], questions[idx]];
        return { ...s, questions: questions.map((q, i) => ({ ...q, order: i })) };
      })
    );
  }, []);

  const copyOnboardingLink = useCallback(() => {
    if (!template?.id || !trainerId) return;
    impactLight();
    const token = createOnboardingToken(trainerId, template.id);
    const url = `${getAppOrigin()}/onboarding/${token}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  }, [template?.id, trainerId]);

  if (!template) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))` }}
    >
      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>
          Template name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border bg-slate-900/50 px-3 py-2 text-base"
          style={{ borderColor: colors.border, color: colors.text }}
          placeholder="e.g. New client intake"
        />
        <label className="block text-sm font-medium mt-3 mb-1" style={{ color: colors.muted }}>
          Service type
        </label>
        <input
          type="text"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="w-full rounded-lg border bg-slate-900/50 px-3 py-2 text-base"
          style={{ borderColor: colors.border, color: colors.text }}
          placeholder="e.g. coaching"
        />
        <div className="flex gap-2 mt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={() => setShowLink((v) => !v)}>
            <Copy size={16} className="mr-1" />
            {showLink ? 'Hide link' : 'Get onboarding link'}
          </Button>
        </div>
        {showLink && (
          <div className="mt-3 p-3 rounded-lg bg-slate-800/50 flex items-center justify-between gap-2">
            <code className="text-xs truncate flex-1" style={{ color: colors.muted }}>
              {typeof window !== 'undefined' && trainerId
                ? `${getAppOrigin()}/onboarding/${createOnboardingToken(trainerId, template.id)}`
                : '—'}
            </code>
            <Button variant="secondary" onClick={copyOnboardingLink}>
              Copy
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
          Sections
        </h2>
        <Button variant="secondary" onClick={addSection} className="gap-1">
          <Plus size={16} />
          Add section
        </Button>
      </div>

      {sections.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <p className="text-sm mb-3" style={{ color: colors.muted }}>
            Add sections and questions. Clients will see them in order.
          </p>
          <Button onClick={addSection}>Add first section</Button>
        </Card>
      ) : (
        <ul className="space-y-4">
          {sections.map((sec, secIdx) => (
            <Card key={sec.id} style={{ padding: spacing[16] }}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={sec.title ?? ''}
                  onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                  className="flex-1 rounded border bg-slate-900/50 px-3 py-2 font-medium"
                  style={{ borderColor: colors.border, color: colors.text }}
                  placeholder="Section title"
                />
                <div className="flex items-center gap-0">
                  <button
                    type="button"
                    onClick={() => moveSection(sec.id, -1)}
                    disabled={secIdx === 0}
                    className="p-2 rounded disabled:opacity-40"
                    aria-label="Move up"
                  >
                    <ChevronUp size={18} style={{ color: colors.text }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(sec.id, 1)}
                    disabled={secIdx === sections.length - 1}
                    className="p-2 rounded disabled:opacity-40"
                    aria-label="Move down"
                  >
                    <ChevronDown size={18} style={{ color: colors.text }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(sec.id)}
                    className="p-2 rounded text-red-400"
                    aria-label="Remove section"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="pl-2 space-y-2">
                {(sec.questions ?? []).map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/30"
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveQuestion(sec.id, q.id, -1)}
                        disabled={qIdx === 0}
                        className="p-1 rounded disabled:opacity-40"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(sec.id, q.id, 1)}
                        disabled={qIdx === (sec.questions?.length ?? 0) - 1}
                        className="p-1 rounded disabled:opacity-40"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={q.label ?? ''}
                        onChange={(e) => updateQuestion(sec.id, q.id, { label: e.target.value })}
                        className="w-full rounded border bg-slate-800/50 px-2 py-1.5 text-sm mb-2"
                        style={{ borderColor: colors.border, color: colors.text }}
                        placeholder="Question label"
                      />
                      <select
                        value={q.type ?? 'shortText'}
                        onChange={(e) =>
                          updateQuestion(sec.id, q.id, { type: e.target.value })
                        }
                        className="w-full rounded border bg-slate-800/50 px-2 py-1.5 text-sm mb-2"
                        style={{ borderColor: colors.border, color: colors.text }}
                      >
                        {QUESTION_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {(q.type === 'singleSelect' || q.type === 'multiSelect') && (
                        <input
                          type="text"
                          value={(q.options || []).join(', ')}
                          onChange={(e) =>
                            updateQuestion(sec.id, q.id, {
                              options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                            })
                          }
                          className="w-full rounded border bg-slate-800/50 px-2 py-1.5 text-sm"
                          style={{ borderColor: colors.border, color: colors.text }}
                          placeholder="Options (comma-separated)"
                        />
                      )}
                      <label className="flex items-center gap-2 mt-2 text-sm" style={{ color: colors.muted }}>
                        <input
                          type="checkbox"
                          checked={!!q.required}
                          onChange={(e) =>
                            updateQuestion(sec.id, q.id, { required: e.target.checked })
                          }
                        />
                        Required
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(sec.id, q.id)}
                      className="p-1.5 rounded text-red-400 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => addQuestion(sec.id)}
                  className="mt-2 gap-1 text-sm"
                >
                  <Plus size={14} />
                  Add question
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
