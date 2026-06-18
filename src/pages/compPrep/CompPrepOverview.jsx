import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { atlasMigrationDataAttributes, deriveCompPrepOverviewRouteState } from '@/lib/atlasMigrationPhases';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Trophy, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getEffectiveTrainerId } from '@/data/useData';
import { getSupabase } from '@/lib/supabaseClient';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { computeStageReadiness } from '@/lib/intelligence/stageReadiness';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const PHASE_LABELS = {
  off_season: 'Off season',
  prep: 'Prep',
  peak_week: 'Peak week',
  show_day: 'Show day',
};

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (24 * 60 * 60 * 1000));
}

function ScoreRing({ score, size = 44 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const stroke = (score / 100) * circumference;
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - stroke}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function mapProfilePhaseToKey(p) {
  const u = String(p || '').toUpperCase().replace(/-/g, '_');
  if (u === 'OFFSEASON' || u === 'OFF_SEASON') return 'off_season';
  if (u === 'PREP') return 'prep';
  if (u === 'PEAK_WEEK' || u === 'PEAK WEEK') return 'peak_week';
  if (u === 'SHOW_DAY' || u === 'SHOW DAY') return 'show_day';
  if (u === 'POST_SHOW') return 'post_show';
  return String(p || 'prep').toLowerCase().replace(/\s+/g, '_');
}

export default function CompPrepOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = getSupabase();
  const trainerId = getEffectiveTrainerId(user?.id) || '';

  const { data: prepClientsRaw = [] } = useQuery({
    queryKey: ['prep-clients', trainerId],
    queryFn: async () => {
      if (!trainerId || !supabase) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, user_id, coach_id, trainer_id, client_type, show_date')
        .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`)
        .eq('client_type', 'competition')
        .order('name', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!trainerId && !!supabase,
    staleTime: 2 * 60 * 1000,
  });

  const prepClients = useMemo(
    () =>
      (prepClientsRaw ?? []).map((row) => {
        const profile = getClientCompProfile(row.id);
        const full_name = row.name ?? row.full_name ?? 'Client';
        const showDate = profile?.showDate ?? row.show_date ?? null;
        const prepPhase = mapProfilePhaseToKey(profile?.prepPhase ?? '');
        return {
          ...row,
          full_name,
          showDate,
          prepPhase,
          division: profile?.division ?? row.division,
          federation: profile?.federation ?? row.federation,
          baselineWeight: row.baseline_weight ?? row.baselineWeight,
          target_weight: row.target_weight ?? row.target_weight_kg,
        };
      }),
    [prepClientsRaw]
  );

  const prepIdsKey = useMemo(() => (prepClients ?? []).map((c) => c.id).filter(Boolean).sort().join(','), [prepClients]);

  const { data: batchCheckins = [] } = useQuery({
    queryKey: ['comp-checkins-overview', prepIdsKey],
    queryFn: async () => {
      const ids = prepIdsKey.split(',').filter(Boolean);
      if (!supabase || ids.length === 0) return [];
      const { data, error } = await supabase
        .from('checkins')
        .select('id, client_id, submitted_at, status, weight_kg, photos')
        .in('client_id', ids)
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (error) return [];
      return data || [];
    },
    enabled: !!supabase && !!prepIdsKey,
    staleTime: 5 * 60 * 1000,
  });

  const checkinsByClientId = useMemo(() => {
    const map = {};
    for (const c of prepClients ?? []) {
      if (c?.id) map[c.id] = [];
    }
    for (const ch of batchCheckins ?? []) {
      const cid = ch.client_id;
      if (!cid || !map[cid]) continue;
      if (map[cid].length < 12) map[cid].push(ch);
    }
    return map;
  }, [prepClients, batchCheckins]);

  const compPrepMigrationAttrs = useMemo(() => {
    const s = deriveCompPrepOverviewRouteState({
      surface: prepClients.length === 0 ? 'empty' : 'list',
    });
    return atlasMigrationDataAttributes(s.phase, s.primary);
  }, [prepClients.length]);

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
      {...compPrepMigrationAttrs}
    >
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Clients in competition prep. Tap for profile, photos & posing.
      </p>

      {prepClients.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <Trophy className="mx-auto mb-3" size={40} style={{ color: colors.muted }} />
          <p className="text-sm" style={{ color: colors.muted }}>
            No comp prep clients yet. Add federation, division, and show date on a client to include them here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {prepClients.map((client) => {
            const checkins = checkinsByClientId[client.id] ?? [];
            const readiness = computeStageReadiness(
              {
                showDate: client.showDate,
                prepPhase: client.prepPhase,
                baselineWeight: client.baselineWeight,
                target_weight: client.target_weight,
              },
              checkins
            );
            const days = daysUntil(client.showDate);
            const phaseLabel = PHASE_LABELS[client.prepPhase] ?? client.prepPhase ?? '—';

            return (
              <Card
                key={client.id}
                style={{ padding: spacing[16], cursor: 'pointer' }}
                onClick={() => navigate(`/comp-prep/client/${client.id}`)}
              >
                <div className="flex items-center gap-3">
                  <ScoreRing score={readiness.score} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: colors.text }}>
                      {client.full_name || client.name || 'Client'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: 'rgba(255,255,255,0.12)', color: colors.muted }}
                      >
                        {phaseLabel}
                      </span>
                      {client.division && (
                        <span className="text-xs" style={{ color: colors.muted }}>
                          {client.division}
                        </span>
                      )}
                      {client.federation && (
                        <span className="text-xs" style={{ color: colors.muted }}>
                          {client.federation}
                        </span>
                      )}
                      {days != null && (
                        <span className="text-xs" style={{ color: colors.muted }}>
                          {days > 0 ? `${days} days to show` : days === 0 ? 'Show today' : 'Show passed'}
                        </span>
                      )}
                    </div>
                    {readiness.flags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <AlertTriangle size={14} style={{ color: '#F59E0B' }} />
                        <span className="text-xs" style={{ color: '#F59E0B' }}>
                          {readiness.flags[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={20} style={{ color: colors.muted }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
