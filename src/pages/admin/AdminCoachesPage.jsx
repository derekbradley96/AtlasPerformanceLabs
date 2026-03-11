/**
 * Admin coaches: name, focus, clients count, revenue (placeholder).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { UserCheck, Loader2, DollarSign } from 'lucide-react';

export default function AdminCoachesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCoaches = useCallback(async () => {
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
      const { data: result, error: err } = await supabase.rpc('get_admin_coaches');
      if (err) throw err;
      if (result?.error === 'unauthorized') {
        setError('Access denied');
        setRows([]);
        return;
      }
      setRows(Array.isArray(result?.rows) ? result.rows : []);
    } catch (e) {
      setError(e?.message ?? 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Coaches</h2>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: colors.muted }} /></div>
      ) : error ? (
        <p style={{ color: colors.text }}>{error}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} style={{ ...standardCard, padding: spacing[12] }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.surface1 }}>
                    <UserCheck size={18} style={{ color: colors.muted }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: colors.text }}>{row.display_name || row.email || 'Coach'}</p>
                    <p className="text-xs" style={{ color: colors.muted }}>Focus: {row.coach_focus || '—'}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium" style={{ color: colors.text }}>{row.clients_count ?? 0} clients</p>
                  <p className="text-xs flex items-center justify-end gap-1" style={{ color: colors.muted }}>
                    <DollarSign size={12} /> {row.revenue != null ? row.revenue : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && !loading && <p className="text-sm py-4" style={{ color: colors.muted }}>No coaches found.</p>}
        </div>
      )}
    </div>
  );
}
