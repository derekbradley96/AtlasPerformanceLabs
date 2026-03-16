/**
 * Report a bug – beta users can submit description, page, and optional screenshot URL.
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { Bug, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportBugPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [description, setDescription] = useState('');
  const [page, setPage] = useState(() => location?.pathname || '');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please describe the issue.');
      return;
    }
    if (!hasSupabase || !user?.id) {
      toast.error('You must be signed in to report a bug.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Unable to submit. Try again later.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bug_reports').insert({
        reported_by: user.id,
        role: profile?.role ?? null,
        page: page.trim() || null,
        description: description.trim(),
        screenshot_url: screenshotUrl.trim() || null,
        status: 'open',
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Bug report submitted. Thanks for helping improve Atlas.');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to submit report.');
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
            Report submitted
          </h2>
          <p className="text-sm mb-6" style={{ color: colors.muted }}>
            We’ll review it and get back to you if we need more details.
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
        <Bug size={24} /> Report a bug
      </h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>
        Describe what went wrong and where. Optional: add a screenshot URL (e.g. from an image host).
      </p>

      <form onSubmit={handleSubmit} style={{ ...standardCard, padding: spacing[20] }}>
        <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
          Description <span style={{ color: colors.danger }}>*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? What did you expect?"
          rows={4}
          required
          className="w-full rounded-lg border p-3 text-sm resize-y"
          style={{
            background: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        />

        <label className="block text-sm font-medium mt-4 mb-2" style={{ color: colors.text }}>
          Page / screen
        </label>
        <input
          type="text"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          placeholder="e.g. /messages, /clients/123"
          className="w-full rounded-lg border p-3 text-sm"
          style={{
            background: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        />

        <label className="block text-sm font-medium mt-4 mb-2" style={{ color: colors.text }}>
          Screenshot URL <span style={{ color: colors.muted }}>(optional)</span>
        </label>
        <input
          type="url"
          value={screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border p-3 text-sm"
          style={{
            background: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        />

        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="mt-6 w-full rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
          style={{
            background: submitting ? colors.muted : colors.primary,
            color: '#fff',
          }}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}
