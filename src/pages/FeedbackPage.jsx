/**
 * Beta feedback – coaches and Personal users can submit feature requests, bugs, general or UI feedback.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { MessageSquare, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const FEEDBACK_TYPES = [
  { value: 'feature_request', label: 'Feature request' },
  { value: 'bug', label: 'Bug report' },
  { value: 'general_feedback', label: 'General feedback' },
  { value: 'ui_feedback', label: 'UI / design feedback' },
];

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [feedbackType, setFeedbackType] = useState('general_feedback');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter your feedback.');
      return;
    }
    if (!hasSupabase || !user?.id) {
      toast.error('You must be signed in to send feedback.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Unable to submit. Try again later.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('user_feedback').insert({
        profile_id: user.id,
        role: profile?.role ?? null,
        feedback_type: feedbackType,
        message: message.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Thanks for your feedback.');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={pageContainer}>
        <div style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
          <CheckCircle size={48} style={{ color: colors.success, marginBottom: spacing[16] }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
            Feedback sent
          </h2>
          <p className="text-sm mb-6" style={{ color: colors.muted }}>
            We read every submission and use it to improve Atlas.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl py-2 px-4 text-sm font-medium flex items-center gap-2 mx-auto"
            style={{ background: colors.primarySubtle, color: colors.primary }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium mb-4"
        style={{ color: colors.muted }}
      >
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ color: colors.text }}>
        <MessageSquare size={24} /> Send feedback
      </h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>
        Feature ideas, bugs, or general thoughts. Your input helps shape Atlas.
      </p>

      <form onSubmit={handleSubmit} style={{ ...standardCard, padding: spacing[20] }}>
        <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
          Type
        </label>
        <select
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
          className="w-full rounded-lg border p-3 text-sm"
          style={{
            background: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        >
          {FEEDBACK_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium mt-4 mb-2" style={{ color: colors.text }}>
          Message <span style={{ color: colors.danger }}>*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what’s on your mind..."
          rows={5}
          required
          className="w-full rounded-lg border p-3 text-sm resize-y"
          style={{
            background: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        />

        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="mt-6 w-full rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
          style={{
            background: submitting ? colors.muted : colors.primary,
            color: '#fff',
          }}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </div>
  );
}
