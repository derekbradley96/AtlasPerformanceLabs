/**
 * GlobalSearch – quick search across Atlas:
 * - clients
 * - exercises
 * - messages (threads)
 * - programs
 *
 * Pure UI component; parent decides where/how to show it (page, sheet, modal).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, User, Dumbbell, MessageSquare, FileText, X } from 'lucide-react';
import { useData } from '@/data/useData';
import { searchExercises } from '@/data/exercises/exerciseLibrary';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const DOMAINS = [
  { key: 'all', label: 'All' },
  { key: 'clients', label: 'Clients' },
  { key: 'exercises', label: 'Exercises' },
  { key: 'messages', label: 'Messages' },
  { key: 'programs', label: 'Programs' },
];

function SectionHeader({ icon: Icon, label, count }) {
  if (!count) return null;
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: colors.muted }} />
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
          {label}
        </p>
      </div>
      <span className="text-[11px]" style={{ color: colors.muted }}>
        {count}
      </span>
    </div>
  );
}

export default function GlobalSearch({ onClose }) {
  const navigate = useNavigate();
  const data = useData();

  const [query, setQuery] = useState('');
  const [activeDomain, setActiveDomain] = useState('all');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [threads, setThreads] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [clientRows, threadRows, programRows] = await Promise.all([
          data.listClients(),
          data.listThreads(),
          data.listPrograms(),
        ]);
        if (cancelled) return;
        setClients(Array.isArray(clientRows) ? clientRows : []);
        setThreads(Array.isArray(threadRows) ? threadRows : []);
        setPrograms(Array.isArray(programRows) ? programRows : []);
      } catch (e) {
        if (!cancelled) {
          setError('Could not load search data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const q = (query || '').trim().toLowerCase();

  const clientResults = useMemo(() => {
    if (!q) return [];
    return (clients || []).filter((c) => {
      const name = (c.full_name || c.name || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(q) || (!!email && email.includes(q));
    });
  }, [clients, q]);

  const exerciseResults = useMemo(() => {
    if (!q) return [];
    return searchExercises(q).slice(0, 20);
  }, [q]);

  const threadsByClientId = useMemo(() => {
    const map = new Map();
    (threads || []).forEach((t) => {
      if (t?.client_id) map.set(t.client_id, t);
    });
    return map;
  }, [threads]);

  const clientNameById = useMemo(() => {
    const map = new Map();
    (clients || []).forEach((c) => {
      if (!c?.id) return;
      map.set(c.id, c.full_name || c.name || 'Client');
    });
    return map;
  }, [clients]);

  const messageResults = useMemo(() => {
    if (!q) return [];
    const results = [];
    (threads || []).forEach((t) => {
      const preview = (t.last_message_preview || '').toLowerCase();
      const clientName = (clientNameById.get(t.client_id) || '').toLowerCase();
      if (preview.includes(q) || clientName.includes(q)) {
        results.push(t);
      }
    });
    return results.slice(0, 20);
  }, [threads, clientNameById, q]);

  const programResults = useMemo(() => {
    if (!q) return [];
    return (programs || []).filter((p) => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(q) || (!!desc && desc.includes(q));
    });
  }, [programs, q]);

  const hasAnyResults =
    clientResults.length + exerciseResults.length + messageResults.length + programResults.length > 0;

  const showClients = activeDomain === 'all' || activeDomain === 'clients';
  const showExercises = activeDomain === 'all' || activeDomain === 'exercises';
  const showMessages = activeDomain === 'all' || activeDomain === 'messages';
  const showPrograms = activeDomain === 'all' || activeDomain === 'programs';

  const handleClientClick = (id) => {
    if (!id) return;
    navigate(`/clients/${id}`);
    onClose?.();
  };

  const handleMessageClick = (clientId) => {
    if (!clientId) return;
    navigate(`/messages/${clientId}`);
    onClose?.();
  };

  const handleProgramClick = (id) => {
    if (!id) return;
    navigate(`/programbuilder?id=${id}`);
    onClose?.();
  };

  const handleExerciseClick = (exerciseId) => {
    // For now, just navigate to Programs screen; could be wired into builder later.
    navigate('/programs');
    onClose?.();
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: colors.bg, color: colors.text, paddingBottom: spacing[16] }}
    >
      <div
        className="flex items-center gap-2 px-4 pt-4 pb-3"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            <SearchIcon size={18} style={{ color: colors.muted }} />
          </span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, exercises, messages, programs…"
            className="w-full pl-9 pr-8 py-2.5 text-sm placeholder:opacity-70 focus:outline-none focus:ring-1 rounded-[20px]"
            style={{
              color: colors.text,
              background: colors.card,
              border: `1px solid ${colors.border}`,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1"
              style={{ color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-full p-2 active:opacity-80"
            style={{ border: 'none', background: 'transparent', color: colors.muted }}
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto" style={{ paddingBottom: spacing[8] }}>
        {DOMAINS.map((d) => {
          const active = d.key === activeDomain;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveDomain(d.key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={{
                border: `1px solid ${active ? colors.primary : colors.border}`,
                background: active ? colors.primarySubtle : colors.surface2,
                color: active ? colors.primary : colors.muted,
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 space-y-4">
        {loading && (
          <p className="text-sm" style={{ color: colors.muted, paddingTop: spacing[16] }}>
            Searching…
          </p>
        )}
        {!loading && error && (
          <Card style={{ padding: spacing[16], marginTop: spacing[8] }}>
            <p className="text-sm" style={{ color: colors.muted }}>
              {error}
            </p>
          </Card>
        )}
        {!loading && !error && q && !hasAnyResults && (
          <Card style={{ padding: spacing[16], marginTop: spacing[8] }}>
            <p className="text-sm" style={{ color: colors.muted }}>
              No results for “{query}”.
            </p>
          </Card>
        )}

        {!loading && !error && q && (
          <>
            {showClients && clientResults.length > 0 && (
              <section>
                <SectionHeader icon={User} label="Clients" count={clientResults.length} />
                <div className="space-y-1">
                  {clientResults.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClientClick(c.id)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                      style={{ border: 'none' }}
                    >
                      <p className="text-sm font-medium" style={{ color: colors.text, margin: 0 }}>
                        {c.full_name || c.name || 'Client'}
                      </p>
                      {c.email && (
                        <p className="text-xs mt-0.5" style={{ color: colors.muted, margin: 0 }}>
                          {c.email}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {showExercises && exerciseResults.length > 0 && (
              <section>
                <SectionHeader icon={Dumbbell} label="Exercises" count={exerciseResults.length} />
                <div className="space-y-1">
                  {exerciseResults.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => handleExerciseClick(e.id)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                      style={{ border: 'none' }}
                    >
                      <p className="text-sm font-medium" style={{ color: colors.text, margin: 0 }}>
                        {e.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: colors.muted, margin: 0 }}>
                        {e.primaryMuscle}
                        {e.movementPattern ? ` · ${e.movementPattern}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {showMessages && messageResults.length > 0 && (
              <section>
                <SectionHeader icon={MessageSquare} label="Messages" count={messageResults.length} />
                <div className="space-y-1">
                  {messageResults.map((t) => {
                    const name = clientNameById.get(t.client_id) || 'Client';
                    return (
                      <button
                        key={t.id || t.client_id}
                        type="button"
                        onClick={() => handleMessageClick(t.client_id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                        style={{ border: 'none' }}
                      >
                        <p className="text-sm font-medium" style={{ color: colors.text, margin: 0 }}>
                          {name}
                        </p>
                        {t.last_message_preview && (
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: colors.muted, margin: 0 }}>
                            {t.last_message_preview}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {showPrograms && programResults.length > 0 && (
              <section>
                <SectionHeader icon={FileText} label="Programs" count={programResults.length} />
                <div className="space-y-1">
                  {programResults.slice(0, 20).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProgramClick(p.id)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                      style={{ border: 'none' }}
                    >
                      <p className="text-sm font-medium" style={{ color: colors.text, margin: 0 }}>
                        {p.name || 'Program'}
                      </p>
                      {p.description && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: colors.muted, margin: 0 }}>
                          {p.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

