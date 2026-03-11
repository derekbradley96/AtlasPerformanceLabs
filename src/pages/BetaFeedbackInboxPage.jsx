/**
 * Internal beta feedback inbox. Admin/internal only.
 * Lists feedback with category, role, screen_name, message preview, created_at, status.
 * Filters: All, Bugs, Feature Requests, Confusion, New only.
 * Actions: mark reviewed, mark resolved.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth, ADMIN_EMAIL } from '@/lib/AuthContext';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { Bug, Lightbulb, HelpCircle, MessageCircle, Check, CheckCircle, Loader2, Inbox } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_LABELS = {
  bug: 'Bug',
  feature_request: 'Feature request',
  confusion: 'Confusion',
  general: 'General',
};

const CATEGORY_ICONS = {
  bug: Bug,
  feature_request: Lightbulb,
  confusion: HelpCircle,
  general: MessageCircle,
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'bug', label: 'Bugs' },
  { key: 'feature_request', label: 'Feature Requests' },
  { key: 'confusion', label: 'Confusion' },
  { key: 'new', label: 'New only' },
];

const MESSAGE_PREVIEW_LEN = 80;

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messagePreview(msg) {
  if (!msg || typeof msg !== 'string') return '—';
  const t = msg.trim();
  if (t.length <= MESSAGE_PREVIEW_LEN) return t;
  return t.slice(0, MESSAGE_PREVIEW_LEN) + '…';
}

export default function BetaFeedbackInboxPage() {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL || import.meta.env.DEV;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchFeedback = useCallback(async () => {
    if (!hasSupabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('beta_feedback')
        .select('id, profile_id, role, category, screen_name, message, created_at, status')
        .order('created_at', { ascending: false });
      if (filter === 'new') {
        q = q.eq('status', 'new');
      } else if (filter !== 'all') {
        q = q.eq('category', filter);
      }
      const { data, error: err } = await q;
      if (err) throw err;
      setItems(data ?? []);
    } catch (e) {
      setError(e?.message ?? 'Failed to load feedback');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchFeedback();
  }, [isAdmin, fetchFeedback]);

  const updateStatus = async (id, status) => {
    if (!hasSupabase) {
      toast.error('Supabase not configured');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setUpdatingId(id);
    try {
      const { error: err } = await supabase.from('beta_feedback').update({ status }).eq('id', id);
      if (err) throw err;
      toast.success(status === 'reviewed' ? 'Marked as reviewed' : 'Marked as resolved');
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (e) {
      toast.error(e?.message ?? 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="app-screen min-w-0 max-w-full" style={{ ...pageContainer, paddingTop: spacing[24] }}>
        <div style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
          <p style={{ color: colors.text }}>This page is for internal use only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={pageContainer}>
      <div style={{ marginBottom: spacing[16] }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.muted, marginBottom: spacing[8] }}>
          Filters
        </p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="rounded-xl py-2 px-4 text-sm font-medium transition-colors"
              style={{
                background: filter === f.key ? colors.primarySubtle : colors.surface1,
                border: `1px solid ${filter === f.key ? colors.primary : colors.border}`,
                color: filter === f.key ? colors.accent : colors.text,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12" style={{ color: colors.muted }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : error ? (
        <div style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
          <p style={{ color: colors.text }}>{error}</p>
          <button
            type="button"
            onClick={() => fetchFeedback()}
            className="mt-3 rounded-xl py-2 px-4 text-sm font-medium"
            style={{ background: colors.primarySubtle, color: colors.accent, border: 'none' }}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12" style={{ color: colors.muted }}>
          <Inbox size={40} style={{ marginBottom: spacing[8] }} />
          <p>No feedback yet</p>
        </div>
      ) : (
        <div className="overflow-hidden" style={standardCard}>
          {items.map((row) => {
            const Icon = CATEGORY_ICONS[row.category] ?? MessageCircle;
            const isUpdating = updatingId === row.id;
            return (
              <div
                key={row.id}
                className="border-b last:border-b-0"
                style={{
                  borderColor: colors.border,
                  padding: spacing[16],
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 36, height: 36, background: colors.surface2 }}
                  >
                    <Icon size={18} style={{ color: colors.muted }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: colors.text }}>
                        {CATEGORY_LABELS[row.category] ?? row.category}
                      </span>
                      <span className="text-xs" style={{ color: colors.muted }}>
                        {row.role ?? '—'} {row.screen_name ? ` · ${row.screen_name}` : ''}
                      </span>
                      <span className="text-xs" style={{ color: colors.muted }}>
                        {formatDate(row.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                      {messagePreview(row.message)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-medium rounded-full py-0.5 px-2"
                        style={{
                          background: row.status === 'new' ? colors.primarySubtle : row.status === 'resolved' ? colors.successSubtle : 'rgba(255,255,255,0.06)',
                          color: row.status === 'new' ? colors.accent : colors.text,
                        }}
                      >
                        {row.status}
                      </span>
                      {row.status === 'new' && (
                        <>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStatus(row.id, 'reviewed')}
                            className="flex items-center gap-1 rounded-lg py-1.5 px-2 text-xs font-medium"
                            style={{
                              background: colors.surface2,
                              color: colors.text,
                              border: 'none',
                            }}
                          >
                            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Mark reviewed
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStatus(row.id, 'resolved')}
                            className="flex items-center gap-1 rounded-lg py-1.5 px-2 text-xs font-medium"
                            style={{
                              background: colors.primarySubtle,
                              color: colors.accent,
                              border: 'none',
                            }}
                          >
                            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Mark resolved
                          </button>
                        </>
                      )}
                      {row.status === 'reviewed' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => updateStatus(row.id, 'resolved')}
                          className="flex items-center gap-1 rounded-lg py-1.5 px-2 text-xs font-medium"
                          style={{
                            background: colors.primarySubtle,
                            color: colors.accent,
                            border: 'none',
                          }}
                        >
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Mark resolved
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
