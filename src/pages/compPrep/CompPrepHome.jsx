import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Award, BookOpen, Camera, ClipboardList, ChevronRight, Upload } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { listCompClientsForTrainer } from '@/lib/repos/compPrepRepo';
import { getClientById } from '@/data/selectors';
import { getClientByUserId } from '@/data/selectors';
import { getNextShowInfo, getNextShowLabel } from '@/lib/compPrep/nextShow';
import { impactLight } from '@/lib/haptics';
import Card from '@/ui/Card';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';

const PHASE_LABELS = {
  OFFSEASON: 'Off season',
  PREP: 'Prep',
  PEAK_WEEK: 'Peak week',
  SHOW_DAY: 'Show day',
  POST_SHOW: 'Post-show',
};

function daysUntil(showDate) {
  if (!showDate) return null;
  const d = new Date(showDate);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (24 * 60 * 60 * 1000));
}

export default function CompPrepHome() {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { role, user } = useAuth();
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const clientProfile = useMemo(() => {
    if (role !== 'client' || !user?.id) return null;
    const c = getClientByUserId(user.id);
    return c ? { clientId: c.id, clientName: c.full_name || c.name } : null;
  }, [role, user?.id]);

  const competingClients = useMemo(() => {
    if (role !== 'trainer') return [];
    return listCompClientsForTrainer();
  }, [role, refreshKey]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return competingClients;
    const q = search.trim().toLowerCase();
    return competingClients.filter((p) => {
      const c = getClientById(p.clientId);
      const name = (c?.full_name || c?.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [competingClients, search]);

  const nextShow = useMemo(() => getNextShowInfo(competingClients), [competingClients]);

  const handleNav = (path) => {
    impactLight();
    navigate(path);
  };

  const handleRefresh = () => {
    impactLight();
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (typeof outletContext?.registerRefresh === 'function') {
      return outletContext.registerRefresh(handleRefresh);
    }
  }, [outletContext?.registerRefresh]);

  const isCoach = role === 'coach' || role === 'trainer';
  const isClient = role === 'client';

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingTop: `calc(${spacing[12]}px + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${spacing[24]}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.accent }}>
        Prep
      </p>
      <h1 className="text-xl font-semibold mb-1" style={{ color: colors.text }}>
        Competition Prep
      </h1>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: colors.muted }}>
        {isCoach && 'Manage competing clients, posing library, and reviews.'}
        {isClient && 'Your prep plan, poses, and media submissions.'}
        {(role === 'personal' || role === 'solo') && 'Pose guides and local progress logging.'}
      </p>

      {isCoach && nextShow != null && (
        <p className="text-[13px] font-medium mb-3" style={{ color: colors.accent }}>
          {getNextShowLabel(nextShow.daysRemaining)}
        </p>
      )}

      {isCoach && (
        <>
          <div className="mb-4">
            <input
              type="search"
              placeholder="Search clients by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search competing clients"
              className="w-full text-sm placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-inset"
              style={{
                minHeight: touchTargetMin,
                padding: `${spacing[10]}px ${spacing[14]}px`,
                borderRadius: radii.sm,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.text,
                caretColor: colors.accent,
                boxShadow: 'none',
              }}
            />
          </div>
          {(filteredClients ?? []).length > 0 && (
            <Card style={{ marginBottom: spacing[16], padding: 0, overflow: 'hidden' }}>
              <div className="px-4 py-2 border-b" style={{ borderColor: colors.border }}>
                <span className="text-sm font-medium" style={{ color: colors.muted }}>
                  Competing clients
                </span>
              </div>
              {(filteredClients ?? []).map((p) => {
                if (!p?.clientId) return null;
                const c = getClientById(p.clientId);
                const name = c?.full_name || c?.name || p.clientId;
                const countdown = daysUntil(p?.showDate);
                return (
                  <button
                    key={p.clientId}
                    type="button"
                    onClick={() => handleNav(`/comp-prep/client/${p.clientId}`)}
                    className="w-full flex items-center justify-between px-4 text-left border-b last:border-b-0 transition-colors active:opacity-90"
                    style={{
                      borderColor: colors.border,
                      minHeight: touchTargetMin,
                      paddingTop: spacing[12],
                      paddingBottom: spacing[12],
                      color: colors.text,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div>
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs" style={{ color: colors.muted }}>
                        {p?.division ?? '—'} · {p?.federation ?? '—'} · {PHASE_LABELS[p?.prepPhase] ?? p?.prepPhase ?? '—'}
                        {countdown != null && countdown >= 0 && (
                          <> · {countdown === 0 ? 'Show today' : `${countdown} days`}</>
                        )}
                      </p>
                    </div>
                    <ChevronRight size={18} style={{ color: colors.muted }} />
                  </button>
                );
              })}
            </Card>
          )}
          {(filteredClients ?? []).length === 0 && search.trim() && (
            <Card style={{ marginBottom: spacing[16], padding: spacing[20], textAlign: 'center', border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
              <Award size={28} className="mx-auto mb-2" style={{ color: colors.muted }} />
              <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>No matches</p>
              <p className="text-xs leading-relaxed" style={{ color: colors.muted }}>
                Try another name or clear the search to see your prep roster.
              </p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold"
                style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', minHeight: touchTargetMin }}
                onClick={() => { impactLight(); setSearch(''); }}
              >
                Clear search
              </button>
            </Card>
          )}
          {(filteredClients ?? []).length === 0 && !search.trim() && (
            <Card style={{ marginBottom: spacing[16], padding: spacing[24], textAlign: 'center', border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
              <Award size={32} className="mx-auto mb-3" style={{ color: colors.muted }} />
              <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>No prep athletes yet</p>
              <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: colors.muted }}>
                Invite prep athletes from <strong style={{ color: colors.textSecondary }}>Clients</strong> (they join with your link or code), then set show date / competition context on their profile; they&apos;ll appear here for posing, media, and timeline.
              </p>
            </Card>
          )}
        </>
      )}

      {isClient && clientProfile && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <p className="text-sm font-medium mb-1" style={{ color: colors.muted }}>
            Your plan
          </p>
          <p className="font-medium">{clientProfile.clientName}</p>
          <p className="text-sm mt-2" style={{ color: colors.muted }}>
            Use Pose Library and Photo Guide, then log media for trainer review.
          </p>
          <button
            type="button"
            onClick={() => handleNav('/comp-prep/media/upload')}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm"
            style={{
              background: colors.primary,
              color: '#fff',
              minHeight: touchTargetMin,
              padding: `${spacing[12]}px ${spacing[16]}px`,
              borderRadius: shell.cardRadius,
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Upload size={18} />
            Submit posing for review
          </button>
        </Card>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleNav('/comp-prep/pose-library')}
          className="w-full text-left overflow-hidden border transition-colors active:opacity-90"
          style={{
            background: colors.card,
            borderColor: colors.border,
            padding: spacing[16],
            borderRadius: shell.cardRadius,
            minHeight: touchTargetMin,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={22} style={{ color: colors.muted }} />
              <span className="font-medium">Pose Library</span>
            </div>
            <ChevronRight size={20} style={{ color: colors.muted }} />
          </div>
          <p className="text-xs mt-1 ml-9" style={{ color: colors.muted }}>Mandatory poses, cues, judges focus</p>
        </button>
        <button
          type="button"
          onClick={() => handleNav('/comp-prep/photo-guide')}
          className="w-full text-left overflow-hidden border transition-colors active:opacity-90"
          style={{
            background: colors.card,
            borderColor: colors.border,
            padding: spacing[16],
            borderRadius: shell.cardRadius,
            minHeight: touchTargetMin,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera size={22} style={{ color: colors.muted }} />
              <span className="font-medium">Photo Guide</span>
            </div>
            <ChevronRight size={20} style={{ color: colors.muted }} />
          </div>
          <p className="text-xs mt-1 ml-9" style={{ color: colors.muted }}>How to take check-in photos</p>
        </button>
        <button
          type="button"
          onClick={() => handleNav('/comp-prep/media')}
          className="w-full text-left overflow-hidden border transition-colors active:opacity-90"
          style={{
            background: colors.card,
            borderColor: colors.border,
            padding: spacing[16],
            borderRadius: shell.cardRadius,
            minHeight: touchTargetMin,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList size={22} style={{ color: colors.muted }} />
              <span className="font-medium">Media Log</span>
            </div>
            <ChevronRight size={20} style={{ color: colors.muted }} />
          </div>
          <p className="text-xs mt-1 ml-9" style={{ color: colors.muted }}>Photos & videos, trainer review</p>
        </button>
      </div>
    </div>
  );
}
