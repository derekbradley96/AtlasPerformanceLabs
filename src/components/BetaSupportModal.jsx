/**
 * Beta support: report urgent issue, request help, or ask an onboarding question.
 * Stores in public.beta_support_requests. Used from More and Account.
 */
import React, { useState } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { toGuardRole } from '@/lib/roles';
import Button from '@/ui/Button';
import { colors, spacing, shell } from '@/ui/tokens';
import { X, AlertCircle, HelpCircle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

const REQUEST_TYPES = [
  { value: 'urgent_issue', label: 'Report urgent issue', icon: AlertCircle },
  { value: 'request_help', label: 'Request help', icon: HelpCircle },
  { value: 'onboarding_question', label: 'Ask onboarding question', icon: BookOpen },
];

export default function BetaSupportModal({ open, onClose }) {
  const { user, role: rawRole } = useAuth();
  const [requestType, setRequestType] = useState('request_help');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roleForDb = rawRole ? toGuardRole(rawRole) : null;
  const profileId = user?.id ?? null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = (message || '').trim();
    if (!msg) {
      toast.error('Please describe what you need.');
      return;
    }
    setSubmitting(true);
    try {
      if (!hasSupabase) {
        toast.info('Support requests are sent when you have an active connection.');
        setSubmitting(false);
        onClose?.();
        return;
      }
      const supabase = getSupabase();
      if (!supabase) {
        toast.info('Support requests are sent when you have an active connection.');
        setSubmitting(false);
        onClose?.();
        return;
      }
      const { error } = await supabase.from('beta_support_requests').insert({
        profile_id: profileId,
        role: roleForDb ?? undefined,
        request_type: requestType,
        message: msg,
      });
      if (error) throw error;
      toast.success("We've received your request. We'll get back to you soon.");
      setMessage('');
      setRequestType('request_help');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Could not send. Try again.');
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
      aria-labelledby="beta-support-title"
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
          <h2 id="beta-support-title" className="text-lg font-semibold" style={{ color: colors.text }}>
            Get help
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
            What do you need?
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {REQUEST_TYPES.map((opt) => {
              const Icon = opt.icon;
              const selected = requestType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRequestType(opt.value)}
                  className="flex items-center gap-3 rounded-xl py-3 px-4 text-left transition-colors"
                  style={{
                    background: selected ? colors.primarySubtle : colors.surface1,
                    border: `1px solid ${selected ? colors.primary : colors.border}`,
                    color: colors.text,
                    fontSize: 15,
                  }}
                >
                  <Icon size={20} style={{ color: selected ? colors.primary : colors.muted }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              requestType === 'urgent_issue'
                ? 'Describe the issue and what you were doing…'
                : requestType === 'onboarding_question'
                  ? 'What would you like to know?'
                  : 'What do you need help with?'
            }
            rows={4}
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
