/**
 * Admin feedback: beta_feedback table, filter by category, mark resolved.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_LABELS = { bug: 'Bug', feature_request: 'Feature request', confusion: 'Confusion', general: 'General' };
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'bug', label: 'Bugs' },
  { key: 'feature_request', label: 'Feature Requests' },
  { key: 'confusion', label: 'Confusion' },
  { key: 'general', label: 'General' },
  { key: 'new', label: 'New only' },
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function messagePreview(msg, len = 80) {
  if (!msg || typeof msg !== 'string') return '—';
  const t = msg.trim();
  return t.length <= len ? t : t.slice(0, len) + '…';
}

export default function AdminFeedbackPage() {
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
      if (filter === 'new') q = q.eq('status', 'new');
      else if (filter !== 'all') q = q.eq('category', filter);
      const { data, error: err } = await q;
      if (err) throw err;
      setItems(data ?? []);
    } catch (e) {
      setError(e?.message ?? 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const updateStatus = async (id, status) => {
    if (!hasSupabase) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setUpdatingId(id);
    try {
      const { error: err } = await supabase.from('beta_feedback').update({ status }).eq('id', id);
      if (err) throw err;
      toast.success(status === 'resolved' ? 'Marked resolved' : 'Updated');
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (e) {
      toast.error(e?.message ?? 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Feedback</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className="rounded-xl py-2 px-3 text-sm font-medium"
            style={{
              background: filter === f.key ? colors.primarySubtle : colors.surface1,
              border: `1px solid ${filter === f.key ? colors.primary : colors.border}`,
              color: filter === f.key ? colors.primary : colors.text,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: colors.muted }} /></div>
      ) : error ? (
        <p style={{ color: colors.text }}>{error}</p>
      ) : (
        <div className="space-y-2">
          {items.map((row) => (
            <div key={row.id} style={{ ...standardCard, padding: spacing[12] }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: colors.muted }}>{CATEGORY_LABELS[row.category] || row.category}</span>
                    <span className="text-xs" style={{ color: colors.muted }}>{row.role || '—'}</span>
                    {row.screen_name && <span className="text-xs" style={{ color: colors.muted }}>· {row.screen_name}</span>}
                    <span className="text-xs" style={{ color: colors.muted }}>{formatDate(row.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: colors.text }}>{messagePreview(row.message)}</p>
                  {row.status !== 'resolved' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        disabled={updatingId === row.id}
                        onClick={() => updateStatus(row.id, 'reviewed')}
                        className="text-xs font-medium py-1.5 px-2 rounded-lg"
                        style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                      >
                        Reviewed
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === row.id}
                        onClick={() => updateStatus(row.id, 'resolved')}
                        className="text-xs font-medium py-1.5 px-2 rounded-lg inline-flex items-center gap-1"
                        style={{ background: colors.primarySubtle, color: colors.primary }}
                      >
                        <CheckCircle size={12} /> Resolved
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: colors.muted }}>{row.status}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && !loading && <p className="text-sm py-4" style={{ color: colors.muted }}>No feedback.</p>}
        </div>
      )}
    </div>
  );
}
