import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Trophy, AlertTriangle } from 'lucide-react';
import { getPrepClients, getClientCheckIns } from '@/data/selectors';
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

export default function CompPrepOverview() {
  const navigate = useNavigate();
  const prepClients = useMemo(() => getPrepClients(), []);

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
            const checkins = getClientCheckIns(client.id);
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
                onClick={() => navigate(`/comp-prep/${client.id}`)}
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
