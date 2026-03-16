/**
 * Admin user lookup: search by email, coach name, or client name. View-only profile detail.
 */
import React, { useState, useCallback } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import {
  Search,
  User,
  Loader2,
  Building2,
  Users,
  CreditCard,
  Activity,
  ChevronLeft,
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminUserLookupPage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [clientResults, setClientResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const runSearch = useCallback(async () => {
    const term = (search || '').trim();
    if (!hasSupabase || !term) {
      setSearchResults([]);
      setClientResults([]);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: usersData, error: usersErr } = await supabase.rpc('get_admin_users', {
        p_search: term,
      });
      if (usersErr) throw usersErr;
      const rows = usersData?.error === 'unauthorized' ? [] : (usersData?.rows || []);
      setSearchResults(Array.isArray(rows) ? rows.slice(0, 20) : []);

      const { data: clientsData, error: clientsErr } = await supabase
        .from('clients')
        .select('id, name, user_id, coach_id')
        .ilike('name', `%${term}%`)
        .limit(20);
      if (clientsErr) {
        setClientResults([]);
      } else {
        setClientResults(clientsData || []);
      }
    } catch (e) {
      setError(e?.message ?? 'Search failed');
      setSearchResults([]);
      setClientResults([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadDetail = useCallback(
    async (profileId) => {
      if (!hasSupabase || !profileId) return;
      const supabase = getSupabase();
      if (!supabase) return;
      setSelectedProfileId(profileId);
      setDetail(null);
      setDetailLoading(true);
      try {
        const { data, error: err } = await supabase.rpc('get_admin_user_detail', {
          p_profile_id: profileId,
        });
        if (err) throw err;
        if (data?.error === 'unauthorized' || data?.error === 'not_found') {
          setDetail({ error: data.error });
        } else {
          setDetail(data);
        }
      } catch (e) {
        setDetail({ error: e?.message ?? 'Failed to load' });
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const handleSelectProfile = (profileId) => {
    loadDetail(profileId);
  };

  const handleSelectClient = (client) => {
    const profileId = client.user_id || client.coach_id;
    if (profileId) loadDetail(profileId);
  };

  const clearSelection = () => {
    setSelectedProfileId(null);
    setDetail(null);
  };

  const hasResults = searchResults.length > 0 || clientResults.length > 0;
  const showDetail = selectedProfileId && (detail || detailLoading);

  return (
    <div style={pageContainer}>
      <h2 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
        User lookup
      </h2>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Search by email, coach name, or client name. View-only.
      </p>

      {!showDetail ? (
        <>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.muted }}
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Email, coach name, or client name"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
                style={{
                  background: colors.surface1,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={loading || !search.trim()}
              className="rounded-xl px-4 py-2.5 text-sm font-medium shrink-0"
              style={{
                background: colors.primary,
                color: '#fff',
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Search'}
            </button>
          </div>

          {error && (
            <p className="text-sm mb-4" style={{ color: colors.danger }}>
              {error}
            </p>
          )}

          {hasResults && !loading && (
            <div className="space-y-4">
              {searchResults.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                    Profiles
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => handleSelectProfile(row.id)}
                        className="w-full text-left rounded-xl border p-3 transition-colors"
                        style={{
                          background: colors.card,
                          borderColor: colors.border,
                        }}
                      >
                        <p className="font-medium" style={{ color: colors.text }}>
                          {row.display_name || row.email || 'No name'}
                        </p>
                        <p className="text-sm truncate" style={{ color: colors.muted }}>
                          {row.email || '—'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          {row.role || '—'}
                          {row.coach_focus ? ` · ${row.coach_focus}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {clientResults.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                    Clients (by name)
                  </p>
                  <div className="space-y-2">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="w-full text-left rounded-xl border p-3 transition-colors"
                        style={{
                          background: colors.card,
                          borderColor: colors.border,
                        }}
                      >
                        <p className="font-medium" style={{ color: colors.text }}>
                          {c.name || 'Unnamed client'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          Client record · {c.user_id ? 'View profile' : 'View coach'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {search.trim() && !hasResults && !loading && (
            <p className="text-sm py-4" style={{ color: colors.muted }}>
              No results for &quot;{search}&quot;
            </p>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={clearSelection}
            className="flex items-center gap-2 text-sm font-medium mb-4"
            style={{ color: colors.muted }}
          >
            <ChevronLeft size={18} /> Back to search
          </button>

          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin" style={{ color: colors.primary }} />
            </div>
          ) : detail?.error ? (
            <p style={{ color: colors.danger }}>{detail.error}</p>
          ) : detail ? (
            <div className="space-y-4">
              {/* Profile info */}
              <div style={{ ...standardCard, padding: spacing[16] }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.muted }}>
                  <User size={16} /> Profile
                </h3>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="font-medium" style={{ color: colors.text }}>Name</dt>
                    <dd style={{ color: colors.muted }}>{detail.profile?.display_name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium" style={{ color: colors.text }}>Email</dt>
                    <dd style={{ color: colors.muted }}>{detail.profile?.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium" style={{ color: colors.text }}>Role</dt>
                    <dd style={{ color: colors.muted }}>{detail.profile?.role || '—'}</dd>
                  </div>
                  {detail.profile?.coach_focus && (
                    <div>
                      <dt className="font-medium" style={{ color: colors.text }}>Coach focus</dt>
                      <dd style={{ color: colors.muted }}>{detail.profile.coach_focus}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-medium" style={{ color: colors.text }}>Joined</dt>
                    <dd style={{ color: colors.muted }}>{formatDate(detail.profile?.created_at)}</dd>
                  </div>
                </dl>
              </div>

              {/* Organisation */}
              <div style={{ ...standardCard, padding: spacing[16] }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.muted }}>
                  <Building2 size={16} /> Organisation
                </h3>
                {detail.organisation ? (
                  <p style={{ color: colors.text }}>{detail.organisation.name || detail.organisation.id}</p>
                ) : (
                  <p style={{ color: colors.muted }}>—</p>
                )}
              </div>

              {/* Clients */}
              <div style={{ ...standardCard, padding: spacing[16] }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.muted }}>
                  <Users size={16} /> Clients
                </h3>
                {detail.clients?.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.clients.map((c) => (
                      <li key={c.id} className="text-sm" style={{ color: colors.text }}>
                        {c.name || 'Unnamed'} <span style={{ color: colors.muted }}>({c.id?.slice(0, 8)}…)</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: colors.muted }}>—</p>
                )}
              </div>

              {/* Subscriptions */}
              <div style={{ ...standardCard, padding: spacing[16] }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.muted }}>
                  <CreditCard size={16} /> Subscriptions
                </h3>
                {detail.subscriptions?.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {detail.subscriptions.map((s) => (
                      <li key={s.id} style={{ color: colors.text }}>
                        {s.plan_name || 'Plan'} · {s.status || '—'} · {s.price != null ? `£${s.price}` : ''} · next: {formatDate(s.next_billing_date)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: colors.muted }}>—</p>
                )}
              </div>

              {/* Recent activity */}
              <div style={{ ...standardCard, padding: spacing[16] }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.muted }}>
                  <Activity size={16} /> Recent activity
                </h3>
                {detail.recent_activity?.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {detail.recent_activity.map((a) => (
                      <li key={a.id} style={{ color: colors.text }}>
                        Check-in submitted {formatDateTime(a.submitted_at)}
                        {a.reviewed_at ? ` · Reviewed ${formatDateTime(a.reviewed_at)}` : ' · Pending review'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: colors.muted }}>—</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
