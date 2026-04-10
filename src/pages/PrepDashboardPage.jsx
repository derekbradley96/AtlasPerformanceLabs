/**
 * Coach Prep Dashboard — decision-first roster view (competition + integrated prep clients only).
 */
import React, { useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Search, X, Calendar, Droplets, FlaskConical, Scale, Target } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { usePresentationMode } from '@/lib/presentationMode';
import AccessDenied from '@/components/AccessDenied';
import { fetchPrepDashboardData } from '@/data/prepDashboardService';
import { weightTrendArrow } from '@/lib/prepDashboardEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Card from '@/ui/Card';
import { PageLoader } from '@/components/ui/LoadingState';
import { colors, shell, spacing, shadows } from '@/ui/tokens';

const PHASE_FILTERS = [
  { id: 'all', label: 'All phases' },
  { id: 'offseason', label: 'Off-season' },
  { id: 'prep', label: 'Prep' },
  { id: 'peak_week', label: 'Peak week' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All statuses' },
  { id: 'on_track', label: 'On track' },
  { id: 'needs_attention', label: 'Needs attention' },
  { id: 'at_risk', label: 'At risk' },
];

const CHECKIN_FILTERS = [
  { id: 'all', label: 'Check-ins' },
  { id: 'pending', label: 'Pending review' },
  { id: 'reviewed', label: 'Reviewed' },
];

const PRIORITY_KEYS = new Set(['attention', 'peak', 'checkins']);
const PHASE_IDS = new Set(PHASE_FILTERS.map((f) => f.id));
const STATUS_IDS = new Set(STATUS_FILTERS.map((f) => f.id));
const CHECKIN_IDS = new Set(CHECKIN_FILTERS.map((f) => f.id));

/** Build return URL for prep precision so back navigation restores dashboard + panel. */
function buildPrepDashboardReturnUrl(searchParams, clientId) {
  const next = new URLSearchParams(searchParams);
  if (clientId) next.set('client', clientId);
  const qs = next.toString();
  return qs ? `/prep-dashboard?${qs}` : '/prep-dashboard';
}

function prepPrecisionHref(clientId, searchParams) {
  const returnTo = buildPrepDashboardReturnUrl(searchParams, clientId);
  return `/clients/${clientId}/prep-precision?returnTo=${encodeURIComponent(returnTo)}`;
}

function toneColor(rollup) {
  if (rollup === 'at_risk') return colors.danger;
  if (rollup === 'needs_attention') return colors.warning;
  return colors.success;
}

function MiniBars({ values, color, height = 48 }) {
  const v = Array.isArray(values) ? values.map(Number).filter((n) => Number.isFinite(n)) : [];
  if (!v.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'flex-end', color: colors.muted, fontSize: 11 }}>
        No data
      </div>
    );
  }
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {v.map((n, i) => {
        const h = Math.max(4, ((n - min) / span) * (height - 8) + 4);
        return (
          <div
            key={i}
            style={{
              width: 8,
              height: h,
              borderRadius: 4,
              background: color,
              opacity: 0.35 + (i / Math.max(v.length - 1, 1)) * 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

function PrepClientCard({ row, onOpen, selected, prepPrecisionHref }) {
  const navigate = useNavigate();
  const { client, phaseBucket, weightTrend, adherence, water, sodium, rollup, dayType, insights } = row;
  const name = client?.name || client?.full_name || 'Client';
  const cid = client?.id;
  const phaseLabel =
    phaseBucket === 'peak_week' ? 'Peak week' : phaseBucket === 'prep' ? 'Prep' : 'Off-season';
  const flag = insights[0];

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      style={{
        textAlign: 'left',
        width: '100%',
        borderRadius: shell.cardRadius,
        border: `1px solid ${selected ? colors.borderActive : colors.border}`,
        background: selected ? colors.primarySubtle : colors.surface1,
        padding: spacing[14],
        cursor: 'pointer',
        boxShadow: selected ? shadows.glow : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[8] }}>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>{name}</p>
          <span
            style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '4px 8px',
              borderRadius: 8,
              background: colors.surface2,
              color: colors.muted,
            }}
          >
            {phaseLabel}
          </span>
        </div>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: toneColor(rollup),
            marginTop: 6,
            flexShrink: 0,
          }}
          title={rollup.replace('_', ' ')}
        />
      </div>
      <div style={{ marginTop: spacing[10], display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[8], fontSize: 12, color: colors.muted }}>
        <div>
          <span style={{ color: colors.textSecondary }}>Weight </span>
          <strong style={{ color: colors.text }}>
            {weightTrendArrow(weightTrend)} {String(weightTrend).replace(/_/g, ' ')}
          </strong>
        </div>
        <div>
          <span style={{ color: colors.textSecondary }}>Adherence </span>
          <strong style={{ color: colors.text }}>{adherence}</strong>
        </div>
        <div>
          <span style={{ color: colors.textSecondary }}>Water </span>
          <strong style={{ color: colors.text }}>{String(water).replace(/_/g, ' ')}</strong>
        </div>
        <div>
          <span style={{ color: colors.textSecondary }}>Sodium </span>
          <strong style={{ color: colors.text }}>{String(sodium).replace(/_/g, ' ')}</strong>
        </div>
      </div>
      {dayType ? (
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 11, color: colors.muted }}>
          Day type: <strong style={{ color: colors.text }}>{dayType}</strong>
        </p>
      ) : null}
      {flag ? (
        <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.warning, lineHeight: 1.35, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          {flag}
        </p>
      ) : null}
      {cid && prepPrecisionHref ? (
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ marginTop: spacing[10] }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate(prepPrecisionHref)}
          >
            Prep precision
          </Button>
        </div>
      ) : null}
      <div style={{ marginTop: spacing[10], display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.primary }}>Open client</span>
        <ChevronRight size={16} style={{ color: colors.primary }} />
      </div>
    </button>
  );
}

function DetailPanel({ row, onClose, isDesktop, prepPrecisionHref }) {
  const navigate = useNavigate();
  if (!row) return null;
  const { client, plan, prepPrecision, phaseBucket, weightTrend, adherence, water, sodium, rollup, insights, latestCheckins, prepDailies } = row;
  const cid = client?.id;
  const name = client?.name || client?.full_name || 'Client';

  const waterSeries = prepDailies.map((d) => Number(d.water_actual_ml)).filter((n) => Number.isFinite(n));
  const sodiumSeries = prepDailies.map((d) => Number(d.sodium_actual_mg)).filter((n) => Number.isFinite(n));
  const weightBars = (latestCheckins || []).map((c) => Number(c.weight)).filter((n) => Number.isFinite(n)).slice(0, 6).reverse();

  const panelStyle = isDesktop
    ? {
        position: 'sticky',
        top: spacing[16],
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        borderRadius: shell.cardRadius,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
        padding: spacing[16],
      }
    : {
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: colors.bg,
        padding: spacing[16],
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        overflowY: 'auto',
      };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>{name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 8, background: colors.surface2, color: colors.text }}
        >
          <X size={18} />
        </button>
      </div>

      <section style={{ marginBottom: spacing[16] }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Summary</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['Rollup', rollup.replace(/_/g, ' ')],
            ['Weight', weightTrend.replace(/_/g, ' ')],
            ['Adherence', adherence],
            ['Water', String(water).replace(/_/g, ' ')],
            ['Sodium', String(sodium).replace(/_/g, ' ')],
            ['Phase', phaseBucket.replace(/_/g, ' ')],
          ].map(([k, v]) => (
            <span key={k} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, background: colors.surface2, color: colors.text }}>
              <span style={{ color: colors.muted }}>{k}: </span>
              <strong>{v}</strong>
            </span>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: spacing[16] }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Insights</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
          {(insights.length ? insights : ['No urgent flags.']).map((t, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{t}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: spacing[16] }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trends</h3>
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3,1fr)' : '1fr', gap: spacing[12] }}>
          <Card style={{ padding: spacing[10], border: `1px solid ${colors.border}`, background: colors.surface2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: colors.muted }}>
              <Scale size={14} /> Weight (check-ins)
            </div>
            <MiniBars values={weightBars} color={colors.primary} />
          </Card>
          <Card style={{ padding: spacing[10], border: `1px solid ${colors.border}`, background: colors.surface2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: colors.muted }}>
              <Droplets size={14} /> Water (logged)
            </div>
            <MiniBars values={waterSeries} color={colors.accent} />
          </Card>
          <Card style={{ padding: spacing[10], border: `1px solid ${colors.border}`, background: colors.surface2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: colors.muted }}>
              <FlaskConical size={14} /> Sodium (logged)
            </div>
            <MiniBars values={sodiumSeries} color={colors.warning} />
          </Card>
        </div>
      </section>

      <section style={{ marginBottom: spacing[16] }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current plan</h3>
        <Card style={{ padding: spacing[12], border: `1px solid ${colors.border}`, background: colors.surface2, fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 6px' }}>
            <strong style={{ color: colors.text }}>Macros: </strong>
            {plan?.calories != null ? `${plan.calories} kcal` : '—'}
            {plan?.protein != null ? ` · P ${plan.protein}g` : ''}
            {plan?.carbs != null ? ` · C ${plan.carbs}g` : ''}
            {plan?.fats != null ? ` · F ${plan.fats}g` : ''}
          </p>
          <p style={{ margin: '0 0 6px' }}>
            <strong style={{ color: colors.text }}>Water target: </strong>
            {prepPrecision?.water_target_ml != null ? `${prepPrecision.water_target_ml} ml` : '—'}
          </p>
          <p style={{ margin: '0 0 6px' }}>
            <strong style={{ color: colors.text }}>Sodium target: </strong>
            {prepPrecision?.sodium_target_mg != null ? `${prepPrecision.sodium_target_mg} mg` : '—'}
          </p>
          <p style={{ margin: '0 0 6px' }}>
            <strong style={{ color: colors.text }}>Cardio: </strong>
            Follow program / messages — not stored on nutrition row.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: colors.text }}>Day type: </strong>
            {prepPrecision?.day_type || '—'}
          </p>
        </Card>
      </section>

      <section style={{ marginBottom: spacing[16] }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Check-in</h3>
        {row.latestCheckinId ? (
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/review-center/checkins/${row.latestCheckinId}`)}>
            <Calendar className="w-4 h-4 mr-2" />
            Open latest check-in review
          </Button>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>No check-in on file.</p>
        )}
      </section>

      <section>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coach actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
          <Button variant="secondary" onClick={() => navigate(`/trainer/nutrition/${cid}`)}>
            <Target className="w-4 h-4 mr-2" />
            Adjust macros (nutrition editor)
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(prepPrecisionHref || `/clients/${cid}/prep-precision`)}
          >
            Water / sodium / day type / notes
          </Button>
          <Button variant="outline" onClick={() => navigate(`/clients/${cid}`)}>
            Client profile
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function PrepDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, coachFocus } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
  const trainerId = user?.id;

  const priorityPreset = useMemo(() => {
    const p = searchParams.get('priority');
    return PRIORITY_KEYS.has(p) ? p : null;
  }, [searchParams]);

  const phaseFilter = useMemo(() => {
    const v = searchParams.get('phase') || 'all';
    return PHASE_IDS.has(v) ? v : 'all';
  }, [searchParams]);

  const statusFilter = useMemo(() => {
    const v = searchParams.get('status') || 'all';
    return STATUS_IDS.has(v) ? v : 'all';
  }, [searchParams]);

  const checkinFilter = useMemo(() => {
    const v = searchParams.get('checkin') || 'all';
    return CHECKIN_IDS.has(v) ? v : 'all';
  }, [searchParams]);

  const search = searchParams.get('q') ?? '';

  const clientIdParam = searchParams.get('client') || null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['prep-dashboard', trainerId, coachFocus],
    queryFn: () => fetchPrepDashboardData(trainerId, coachFocus),
    enabled: !!trainerId,
  });

  const rows = data?.prepClients ?? [];

  const counts = useMemo(() => {
    let need = 0;
    let peak = 0;
    let newCi = 0;
    for (const r of rows) {
      if (r.rollup === 'needs_attention' || r.rollup === 'at_risk') need += 1;
      if (r.phaseBucket === 'peak_week') peak += 1;
      if (r.hasUnreviewedRecent) newCi += 1;
    }
    return { need, peak, newCi, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const n = String(r.client?.name || r.client?.full_name || '').toLowerCase();
        return n.includes(q);
      });
    }
    if (priorityPreset === 'attention') {
      list = list.filter((r) => r.rollup === 'needs_attention' || r.rollup === 'at_risk');
    } else if (priorityPreset === 'peak') {
      list = list.filter((r) => r.phaseBucket === 'peak_week');
    } else if (priorityPreset === 'checkins') {
      list = list.filter((r) => r.hasUnreviewedRecent);
    }
    if (phaseFilter !== 'all') {
      list = list.filter((r) => r.phaseBucket === phaseFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.rollup === statusFilter);
    }
    if (checkinFilter === 'pending') {
      list = list.filter((r) => r.hasUnreviewedRecent);
    }
    if (checkinFilter === 'reviewed') {
      list = list.filter((r) => !r.hasUnreviewedRecent);
    }
    return list;
  }, [rows, search, phaseFilter, statusFilter, checkinFilter, priorityPreset]);

  const patchSearchParams = useCallback(
    (mutate) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const onPriority = useCallback(
    (key) => {
      patchSearchParams((next) => {
        const cur = next.get('priority');
        if (cur === key) next.delete('priority');
        else next.set('priority', key);
        next.delete('client');
      });
    },
    [patchSearchParams]
  );

  const setPhaseFilterUrl = useCallback(
    (v) => {
      patchSearchParams((next) => {
        next.delete('priority');
        if (!v || v === 'all') next.delete('phase');
        else next.set('phase', v);
      });
    },
    [patchSearchParams]
  );

  const setStatusFilterUrl = useCallback(
    (v) => {
      patchSearchParams((next) => {
        next.delete('priority');
        if (!v || v === 'all') next.delete('status');
        else next.set('status', v);
      });
    },
    [patchSearchParams]
  );

  const setCheckinFilterUrl = useCallback(
    (v) => {
      patchSearchParams((next) => {
        next.delete('priority');
        if (!v || v === 'all') next.delete('checkin');
        else next.set('checkin', v);
      });
    },
    [patchSearchParams]
  );

  const setSearchQuery = useCallback(
    (q) => {
      patchSearchParams((next) => {
        const t = String(q);
        if (!t) next.delete('q');
        else next.set('q', t);
      });
    },
    [patchSearchParams]
  );

  const openClientRow = useCallback(
    (r) => {
      const id = r?.client?.id;
      if (!id) return;
      patchSearchParams((next) => {
        next.set('client', id);
      });
    },
    [patchSearchParams]
  );

  const closeDetailPanel = useCallback(() => {
    patchSearchParams((next) => {
      next.delete('client');
    });
  }, [patchSearchParams]);

  useEffect(() => {
    if (!clientIdParam || isLoading) return;
    if (rows.some((r) => r.client?.id === clientIdParam)) return;
    patchSearchParams((next) => {
      next.delete('client');
    });
  }, [clientIdParam, rows, isLoading, patchSearchParams]);

  if (coachFocus === 'transformation') {
    return (
      <AccessDenied
        title="Prep Dashboard"
        message="Prep Dashboard is for competition or integrated coaches. Transformation-only accounts use the standard client list."
        secondaryAction={{ label: 'Back to clients', path: '/clients' }}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        paddingLeft: shell.pagePaddingH,
        paddingRight: shell.pagePaddingH,
        paddingTop: spacing[16],
        paddingBottom: 'calc(' + spacing[24] + 'px + env(safe-area-inset-bottom))',
      }}
    >
      <header style={{ marginBottom: spacing[16] }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Prep Dashboard</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: colors.muted, maxWidth: 560, lineHeight: 1.45 }}>
          Decision-first prep roster — flags, stability, and quick drill-in. Scoped to competition-delivery clients{coachFocus === 'integrated' ? ' (integrated coach)' : ''}.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.textSecondary }}>
          Prep clients: <strong style={{ color: colors.text }}>{counts.total}</strong>
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing[8],
          marginBottom: spacing[12],
          alignItems: 'center',
        }}
      >
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilterUrl(e.target.value)}
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13 }}
        >
          {PHASE_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilterUrl(e.target.value)}
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13 }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <select
          value={checkinFilter}
          onChange={(e) => { setCheckinFilter(e.target.value); setPriorityPreset(null); }}
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13 }}
        >
          {CHECKIN_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.muted }} />
          <Input
            value={search}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name"
            className="pl-9"
            style={{ background: colors.surface2, borderColor: colors.border }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div style={{ display: 'flex', gap: spacing[10], marginBottom: spacing[16], flexWrap: 'wrap' }}>
        {[
          { key: 'attention', label: 'Needs attention', value: counts.need, color: colors.warning },
          { key: 'peak', label: 'Peak week', value: counts.peak, color: colors.primary },
          { key: 'checkins', label: 'New check-ins', value: counts.newCi, color: colors.accent },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPriority(p.key)}
            style={{
              flex: '1 1 140px',
              minHeight: 56,
              borderRadius: 14,
              border: `1px solid ${priorityPreset === p.key ? p.color : colors.border}`,
              background: priorityPreset === p.key ? `${p.color}22` : colors.surface1,
              color: colors.text,
              cursor: 'pointer',
              textAlign: 'left',
              padding: spacing[12],
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: p.color }}>{p.value}</p>
          </button>
        ))}
      </div>

      {isLoading ? <PageLoader message="Loading prep roster…" /> : null}
      {isError ? (
        <Card style={{ padding: spacing[16], border: `1px solid ${colors.danger}55` }}>
          <p style={{ margin: 0, color: colors.danger }}>Could not load prep data. Check Supabase and try refresh.</p>
        </Card>
      ) : null}

      {!isLoading && !isError ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktopWeb && selected ? 'minmax(0,1fr) minmax(300px,380px)' : '1fr',
            gap: spacing[16],
            alignItems: 'start',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktopWeb ? 'repeat(auto-fill, minmax(260px, 1fr))' : '1fr',
              gap: spacing[12],
            }}
          >
            {filtered.length === 0 ? (
              <Card style={{ padding: spacing[20], border: `1px solid ${colors.border}` }}>
                <p style={{ margin: 0, color: colors.muted }}>No clients match filters. Add competition-delivery clients or adjust filters.</p>
              </Card>
            ) : (
              filtered.map((row) => (
                <PrepClientCard
                  key={row.client.id}
                  row={row}
                  selected={selected?.client?.id === row.client?.id}
                  onOpen={openClientRow}
                  prepPrecisionHref={row.client?.id ? prepPrecisionHref(row.client.id, searchParams) : null}
                />
              ))
            )}
          </div>
          {isDesktopWeb && selected ? (
            <DetailPanel
              row={selected}
              onClose={closeDetailPanel}
              isDesktop
              prepPrecisionHref={
                selected?.client?.id ? prepPrecisionHref(selected.client.id, searchParams) : null
              }
            />
          ) : null}
        </div>
      ) : null}

      {!isDesktopWeb && selected ? (
        <DetailPanel
          row={selected}
          onClose={closeDetailPanel}
          isDesktop={false}
          prepPrecisionHref={
            selected?.client?.id ? prepPrecisionHref(selected.client.id, searchParams) : null
          }
        />
      ) : null}
    </div>
  );
}
