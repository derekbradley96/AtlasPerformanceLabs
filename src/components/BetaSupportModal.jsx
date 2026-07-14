/**
 * Beta support: report urgent issue, request help, or ask an onboarding question.
 * Stores in public.beta_support_requests. Used from More and Account.
 */
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { toGuardRole } from '@/lib/roles';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { AlertCircle, HelpCircle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { insertBetaSupportRequest } from '@/data/betaSupportRepo';
import BottomSheet from '@/components/ui/BottomSheet';

const REQUEST_TYPES = [
  { value: 'urgent_issue', label: 'Report urgent issue', icon: AlertCircle },
  { value: 'request_help', label: 'Request help', icon: HelpCircle },
  { value: 'onboarding_question', label: 'Ask onboarding question', icon: BookOpen },
];

export default function BetaSupportModal({ open, onClose }) {
  const { user, role: rawRole } = useAuth();
  const [requestType, setRequestType] = useState('request_help');
  const [message, setMessage] = useState('');

  const roleForDb = rawRole ? toGuardRole(rawRole) : null;
  const profileId = user?.id ?? null;

  const supportMutation = useMutation({
    mutationFn: async ({ msg, type }) => {
      await insertBetaSupportRequest({
        profileId,
        role: roleForDb,
        requestType: type,
        message: msg,
      });
    },
    onSuccess: () => {
      toast.success("We've received your request. We'll get back to you soon.");
      setMessage('');
      setRequestType('request_help');
      onClose?.();
    },
    onError: (err) => {
      if (err?.message === 'NO_SUPABASE') {
        toast.info('Support requests are sent when you have an active connection.');
        onClose?.();
        return;
      }
      toast.error(err?.message || 'Could not send. Try again.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const msg = (message || '').trim();
    if (!msg) {
      toast.error('Please describe what you need.');
      return;
    }
    if (!hasSupabase) {
      toast.info('Support requests are sent when you have an active connection.');
      onClose?.();
      return;
    }
    supportMutation.mutate({ msg, type: requestType });
  };

  const submitting = supportMutation.isPending;

  return (
    <BottomSheet open={open} onClose={() => onClose?.()} title="Get help" maxWidth={448} padded={false}>
      <form onSubmit={handleSubmit} style={{ padding: spacing[16], paddingTop: 0 }}>
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
    </BottomSheet>
  );
}
