import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClientByUserId } from '@/data/selectors';
import { listMedia, getCompMediaById } from '@/lib/repos/compPrepRepo';
import { impactLight } from '@/lib/haptics';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'posing', label: 'Posing' },
  { value: 'progress', label: 'Progress' },
  { value: 'checkin', label: 'Check-in' },
];

export default function CompMediaList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const outletContext = useOutletContext() || {};
  const { role, user } = useAuth();
  const urlClientId = searchParams.get('clientId') || null;
  const focusMediaId = searchParams.get('focus') || null;
  const [categoryFilter, setCategoryFilter] = useState('');
  const [poseFilter, setPoseFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const focusRef = useRef(null);

  const effectiveClientId = useMemo(() => {
    if (role === 'trainer' && urlClientId) return urlClientId;
    if (role === 'client' && user?.id) {
      const c = getClientByUserId(user.id);
      return c?.id ?? null;
    }
    if (role === 'solo' && user?.id) return `solo-${user.id}`;
    return null;
  }, [role, user?.id, urlClientId]);

  const allMedia = useMemo(
    () =>
      effectiveClientId
        ? listMedia(effectiveClientId, {
            ...(categoryFilter ? { category: categoryFilter } : {}),
            ...(poseFilter ? { poseId: poseFilter } : {}),
          })
        : [],
    [effectiveClientId, categoryFilter, poseFilter, refreshKey]
  );

  const byWeek = useMemo(() => {
    const groups = {};
    allMedia.forEach((m) => {
      const d = new Date(m.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, items]) => ({ week, items }));
  }, [allMedia]);

  const selectedLog = useMemo(
    () => (selectedId ? getCompMediaById(selectedId) : null),
    [selectedId]
  );

  const handleRefresh = () => {
    impactLight();
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (typeof outletContext?.registerRefresh === 'function') {
      return outletContext.registerRefresh(handleRefresh);
    }
  }, [outletContext?.registerRefresh]);

  // When focus=mediaId in URL, open that media and scroll to it
  useEffect(() => {
    if (!focusMediaId || !allMedia.some((m) => m.id === focusMediaId)) return;
    setSelectedId(focusMediaId);
    const t = setTimeout(() => {
      focusRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(t);
  }, [focusMediaId, allMedia.length]);

  if (!effectiveClientId) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">
          {role === 'trainer' ? 'Add a client to the URL (e.g. ?clientId=...) or open from Comp Prep.' : 'Sign in as a client or solo to view your media log.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Media Log</h1>
        <button
          type="button"
          onClick={() => {
            impactLight();
            navigate('/comp-prep/media/upload');
          }}
          className="text-sm font-medium"
          style={{ color: colors.accent }}
        >
          Upload
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.value || 'all'}
            type="button"
            onClick={() => setCategoryFilter(c.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: categoryFilter === c.value ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255,255,255,0.08)',
              color: categoryFilter === c.value ? colors.accent : colors.muted,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {allMedia.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            No media yet. Tap Upload to add photos or videos.
          </p>
          <button
            type="button"
            onClick={() => {
              impactLight();
              navigate('/comp-prep/media/upload');
            }}
            className="mt-3 text-sm font-medium"
            style={{ color: colors.accent }}
          >
            Upload
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {byWeek.map(({ week, items }) => (
            <div key={week}>
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>
                Week of {new Date(week).toLocaleDateString()}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((m) => (
                  <button
                    key={m.id}
                    ref={m.id === focusMediaId ? focusRef : undefined}
                    type="button"
                    onClick={() => {
                      impactLight();
                      setSelectedId(m.id);
                    }}
                    className="rounded-xl overflow-hidden bg-slate-800 aspect-square relative"
                  >
                    {m.mediaType === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: colors.muted }}>
                        ▶
                      </div>
                    ) : (
                      <img
                        src={m.uri}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.background = colors.surface1;
                          e.target.style.color = colors.muted;
                        }}
                      />
                    )}
                    {m.reviewedAt && (
                      <span
                        className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: colors.success, color: '#fff' }}
                      >
                        Reviewed
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setSelectedId(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-t-2xl overflow-hidden"
            style={{
              background: colors.card,
              paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b" style={{ borderColor: colors.border }}>
              <p className="text-xs" style={{ color: colors.muted }}>
                {new Date(selectedLog.createdAt).toLocaleString()} · {selectedLog.category}
                {selectedLog.poseId && ` · ${selectedLog.poseId}`}
              </p>
            </div>
            <div className="p-4">
              {selectedLog.mediaType === 'photo' && (
                <img
                  src={selectedLog.uri}
                  alt=""
                  className="w-full rounded-xl mb-3 max-h-64 object-contain bg-slate-800"
                />
              )}
              {selectedLog.trainerComment && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
                    Trainer comment
                  </p>
                  <p className="text-sm">{selectedLog.trainerComment}</p>
                </div>
              )}
              {selectedLog.reviewedAt && (
                <p className="text-xs" style={{ color: colors.success }}>
                  ✓ Reviewed {new Date(selectedLog.reviewedAt).toLocaleDateString()}
                </p>
              )}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mt-3 text-sm"
                style={{ color: colors.muted }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
