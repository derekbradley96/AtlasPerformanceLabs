/**
 * In-app beta feedback: category, screen (auto-fill), message.
 * Quick submit with success toast; used from More and optional floating action (beta mode).
 */
import React, { useState } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { toGuardRole } from '@/lib/roles';
import Button from '@/ui/Button';
import { colors, spacing, shell } from '@/ui/tokens';
import { X, Bug, Lightbulb, HelpCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'feature_request', label: 'Feature request', icon: Lightbulb },
  { value: 'confusion', label: 'Something confusing', icon: HelpCircle },
  { value: 'general', label: 'General feedback', icon: MessageCircle },
];

export default function BetaFeedbackModal({ open, onClose, initialScreenName = '' }) {
  const { user, profile, role: rawRole } = useAuth();
  const [category, setCategory] = useState('general');
  const [screenName, setScreenName] = useState(initialScreenName || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roleForDb = rawRole ? toGuardRole(rawRole) : null;
  const profileId = user?.id ?? null;

  React.useEffect(() => {
    if (open && initialScreenName) setScreenName(initialScreenName);
  }, [open, initialScreenName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = (message || '').trim();
    if (!msg) {
      toast.error('Please enter your message.');
      return;
    }
    setSubmitting(true);
    try {
      if (!hasSupabase) {
        toast.info('Feedback is sent when you have an active connection.');
        onClose?.();
        return;
      }
      const supabase = getSupabase();
      if (!supabase) {
        toast.info('Feedback is sent when you have an active connection.');
        onClose?.();
        return;
      }
      const { error } = await supabase.from('beta_feedback').insert({
        profile_id: profileId,
        role: roleForDb ?? undefined,
        category,
        screen_name: (screenName || '').trim() || null,
        message: msg,
      });
      if (error) throw error;
      toast.success('Thanks! Your feedback has been sent.');
      setMessage('');
      setCategory('general');
      setScreenName(initialScreenName || '');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Could not send feedback. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{
        background: colors.overlay,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-feedback-title"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          boxShadow: shell.cardShadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
          <h2 id="beta-feedback-title" className="text-lg font-semibold" style={{ color: colors.text }}>
            Send feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: colors.muted }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: spacing[16] }}>
          <p className="text-sm font-medium mb-2" style={{ color: colors.muted }}>
            Category
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map((opt) => {
              const Icon = opt.icon;
              const selected = category === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className="flex items-center gap-2 rounded-xl py-2.5 px-3 transition-colors"
                  style={{
                    background: selected ? colors.primarySubtle : colors.surface1,
                    border: `1px solid ${selected ? colors.primary : colors.border}`,
                    color: colors.text,
                    fontSize: 14,
                  }}
                >
                  <Icon size={18} style={{ color: selected ? colors.primary : colors.muted }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
            Screen (optional)
          </label>
          <input
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            placeholder="e.g. Home, Client detail"
            className="w-full rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-offset-0 mb-4"
            style={{
              background: colors.surface1,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: 15,
            }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What’s on your mind?"
            rows={3}
            className="w-full rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-offset-0 resize-y mb-4"
            style={{
              background: colors.surface1,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: 15,
            }}
            maxLength={2000}
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
