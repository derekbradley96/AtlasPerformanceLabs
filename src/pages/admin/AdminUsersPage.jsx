/**
 * Admin users: search, view profile (role, coach_focus, created_at).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { Search, User, Loader2 } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
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
      const { data: result, error: err } = await supabase.rpc('get_admin_users', { p_search: search || null });
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
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Users</h2>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.muted }} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
          style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: colors.muted }} /></div>
      ) : error ? (
        <p style={{ color: colors.text }}>{error}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} style={{ ...standardCard, padding: spacing[12] }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.surface1 }}>
                  <User size={18} style={{ color: colors.muted }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" style={{ color: colors.text }}>{row.display_name || row.email || row.id?.slice(0, 8)}</p>
                  <p className="text-sm truncate" style={{ color: colors.muted }}>{row.email || '—'}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5 text-xs" style={{ color: colors.muted }}>
                    <span>Role: {row.role || '—'}</span>
                    {row.coach_focus && <span>Focus: {row.coach_focus}</span>}
                    <span>Joined: {formatDate(row.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && !loading && <p className="text-sm py-4" style={{ color: colors.muted }}>No users found.</p>}
        </div>
      )}
    </div>
  );
}
