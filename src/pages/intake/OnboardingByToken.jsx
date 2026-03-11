import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { decodeOnboardingToken } from '@/lib/intake/intakeTemplateRepo';
import { getTemplate } from '@/lib/intake/intakeTemplateRepo';
import {
  createSubmission,
  submitSubmission,
} from '@/lib/intake/intakeSubmissionRepo';
import { validateSubmission } from '@/lib/intake/intakeValidation';
import { extractFlags } from '@/lib/intake/extractFlags';
import Button from '@/ui/Button';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { notificationSuccess } from '@/lib/haptics';

const DRAFT_KEY_PREFIX = 'atlas_onboarding_draft_';

function sectionLooksLikeScreening(title) {
  const t = (title || '').toLowerCase();
  return /screen|readiness|par-q|medical|health\s*check/.test(t);
}

export default function OnboardingByToken() {
  const { token } = useParams();
  const [decoded, setDecoded] = useState(null);
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const d = decodeOnboardingToken(token);
    if (!d?.trainerId || !d?.templateId) {
      setLoading(false);
      return;
    }
    setDecoded(d);
    const t = getTemplate(d.templateId);
    if (!t || !t.isActive || t.trainerId !== d.trainerId) {
      setLoading(false);
      return;
    }
    setTemplate(t);
    try {
      const raw = localStorage.getItem(DRAFT_KEY_PREFIX + token);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setAnswers(parsed);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  const sections = template?.sections ?? [];
  const currentSection = sections[step];
  const isScreening = currentSection && sectionLooksLikeScreening(currentSection.title);

  const saveDraft = useCallback(() => {
    if (!token) return;
    try {
      localStorage.setItem(DRAFT_KEY_PREFIX + token, JSON.stringify(answers));
      toast.success('Draft saved');
      notificationSuccess();
    } catch (e) {
      toast.error('Could not save draft');
    }
  }, [token, answers]);

  const setAnswer = useCallback((questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!template || !decoded) return;
    const errors = validateSubmission(template, answers);
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error('Please complete all required fields');
      return;
    }
    setValidationErrors([]);
    setSaving(true);
    try {
      const flags = extractFlags(answers, template);
      const sub = createSubmission(decoded.trainerId, decoded.templateId, {
        clientId: null,
        leadId: null,
        answers,
        flags,
      });
      submitSubmission(sub.id);
      try {
        localStorage.removeItem(DRAFT_KEY_PREFIX + token);
      } catch {}
      setSubmitted(true);
      notificationSuccess();
    } catch (e) {
      toast.error('Submission failed');
    } finally {
      setSaving(false);
    }
  }, [template, decoded, answers, token]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0B1220', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="w-10 h-10 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!decoded || !template) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: '#0B1220', color: '#94a3b8' }}
      >
        <h1 className="text-xl font-semibold text-white mb-2">Invalid or expired link</h1>
        <p className="text-center">
          This onboarding link is invalid or the form is no longer available. Please ask your trainer for a new link.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: '#0B1220' }}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Thank you</h1>
        <p className="text-center text-slate-400 mb-6">
          Your responses have been submitted. Your trainer will review them and be in touch.
        </p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: '#0B1220', color: '#94a3b8' }}
      >
        <p>This form has no sections yet.</p>
      </div>
    );
  }

  const questions = currentSection?.questions ?? [];
  const hasNext = step < sections.length - 1;
  const hasPrev = step > 0;

  return (
    <div
      className="min-h-screen"
      style={{
        background: '#0B1220',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))`,
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-4 flex gap-1">
          {sections.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{
                background: i <= step ? colors.accent : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">
          {currentSection?.title ?? 'Section'}
        </h2>

        {isScreening && (
          <Card style={{ marginBottom: spacing[16], padding: spacing[12], borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)' }}>
            <p className="text-sm" style={{ color: '#fcd34d' }}>
              This section helps us understand your readiness for training. If you answer yes to any medical or health questions, your trainer may follow up before starting.
            </p>
          </Card>
        )}

        <div className="space-y-4 mb-6">
          {questions.map((q) => {
            const err = validationErrors.find((e) => e.questionId === q.id);
            return (
              <div key={q.id}>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {q.label}
                  {q.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {q.type === 'shortText' && (
                  <input
                    type="text"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder}
                    className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-white placeholder-slate-500"
                    style={{ borderColor: err ? '#ef4444' : colors.border }}
                  />
                )}
                {q.type === 'longText' && (
                  <textarea
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder}
                    rows={3}
                    className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-white placeholder-slate-500"
                    style={{ borderColor: err ? '#ef4444' : colors.border }}
                  />
                )}
                {q.type === 'number' && (
                  <input
                    type="number"
                    value={answers[q.id] ?? ''}
                    onChange={(e) =>
                      setAnswer(q.id, e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-white"
                    style={{ borderColor: err ? '#ef4444' : colors.border }}
                  />
                )}
                {q.type === 'yesNo' && (
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === 'yes' || answers[q.id] === true}
                        onChange={() => setAnswer(q.id, 'yes')}
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === 'no' || answers[q.id] === false}
                        onChange={() => setAnswer(q.id, 'no')}
                      />
                      No
                    </label>
                  </div>
                )}
                {q.type === 'singleSelect' && (
                  <select
                    value={Array.isArray(answers[q.id]) ? answers[q.id][0] : answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-white"
                    style={{ borderColor: err ? '#ef4444' : colors.border }}
                  >
                    <option value="">Select…</option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {q.type === 'multiSelect' && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-slate-300">
                        <input
                          type="checkbox"
                          checked={(answers[q.id] ?? []).includes(opt)}
                          onChange={(e) => {
                            const arr = Array.isArray(answers[q.id]) ? [...answers[q.id]] : [];
                            if (e.target.checked) setAnswer(q.id, [...arr, opt]);
                            else setAnswer(q.id, arr.filter((x) => x !== opt));
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'date' && (
                  <input
                    type="date"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full rounded-lg border bg-slate-800/50 px-3 py-2 text-white"
                    style={{ borderColor: err ? '#ef4444' : colors.border }}
                  />
                )}
                {err && <p className="text-red-400 text-xs mt-1">{err.message}</p>}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {hasPrev && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={saveDraft}>
            Save draft
          </Button>
          {hasNext ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
