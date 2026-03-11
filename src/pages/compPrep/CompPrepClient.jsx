import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Layout, ChevronRight, Award } from 'lucide-react';
import { getClientById } from '@/data/selectors';
import { getClientCheckIns } from '@/data/selectors';
import { setCompPrepClient } from '@/lib/compPrepStore';
import { getFederationCriteria } from '@/lib/compPrep/federationCriteria';
import { computeStageReadiness } from '@/lib/intelligence/stageReadiness';
import { PREP_PHASES, FEDERATIONS, DIVISIONS_MALE, DIVISIONS_FEMALE } from '@/lib/compPrep/poseSets';
import PhotoGuideCard from '@/components/compPrep/PhotoGuideCard';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const PHASE_LABELS = { off_season: 'Off season', prep: 'Prep', peak_week: 'Peak week', show_day: 'Show day' };

export default function CompPrepClient() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const client = useMemo(() => (clientId ? getClientById(clientId) : null), [clientId]);
  const checkins = useMemo(() => (clientId ? getClientCheckIns(clientId) : []), [clientId]);

  const [federation, setFederation] = useState(client?.federation ?? '');
  const [division, setDivision] = useState(client?.division ?? '');
  const [prepPhase, setPrepPhase] = useState(client?.prepPhase ?? '');
  const [showDate, setShowDate] = useState(client?.showDate ?? '');
  const [compNotes, setCompNotes] = useState(client?.comp_notes ?? '');

  useEffect(() => {
    setFederation(client?.federation ?? '');
    setDivision(client?.division ?? '');
    setPrepPhase(client?.prepPhase ?? '');
    setShowDate(client?.showDate ?? '');
    setCompNotes(client?.comp_notes ?? '');
  }, [client?.federation, client?.division, client?.prepPhase, client?.showDate, client?.comp_notes]);

  const federationCriteria = useMemo(() => getFederationCriteria(client?.federation || federation), [client?.federation, federation]);
  const readiness = useMemo(
    () =>
      computeStageReadiness(
        {
          showDate: client?.showDate ?? showDate,
          prepPhase: client?.prepPhase ?? prepPhase,
          baselineWeight: client?.baselineWeight,
        },
        checkins
      ),
    [client, showDate, prepPhase, checkins]
  );

  const handleSave = () => {
    if (!clientId) return;
    setCompPrepClient(clientId, {
      federation: federation || null,
      division: division || null,
      prepPhase: prepPhase || null,
      showDate: showDate || null,
      comp_notes: compNotes || null,
    });
  };

  if (!client) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Client not found.</p>
      </div>
    );
  }

  const divisions = [...DIVISIONS_FEMALE, ...DIVISIONS_MALE];

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
      <h1 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
        {client.full_name || client.name || 'Client'}
      </h1>

      {/* Stage readiness */}
      <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            Stage readiness
          </span>
          <span
            className="text-2xl font-bold"
            style={{
              color: readiness.score >= 80 ? '#22C55E' : readiness.score >= 60 ? '#F59E0B' : '#EF4444',
            }}
          >
            {readiness.score}
          </span>
        </div>
        <div className="w-full h-2 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${readiness.score}%`,
              background: readiness.score >= 80 ? '#22C55E' : readiness.score >= 60 ? '#F59E0B' : '#EF4444',
            }}
          />
        </div>
        {readiness.suggestions.length > 0 && (
          <ul className="text-xs space-y-1" style={{ color: colors.muted }}>
            {readiness.suggestions.slice(0, 3).map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Comp profile */}
      <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
        <h2 className="text-base font-semibold mb-3" style={{ color: colors.text }}>
          Comp profile
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Federation
            </label>
            <select
              value={federation}
              onChange={(e) => setFederation(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {FEDERATIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Division
            </label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Phase
            </label>
            <select
              value={prepPhase}
              onChange={(e) => setPrepPhase(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {PREP_PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Show date
            </label>
            <input
              type="date"
              value={showDate}
              onChange={(e) => setShowDate(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Notes
            </label>
            <textarea
              value={compNotes}
              onChange={(e) => setCompNotes(e.target.value)}
              placeholder="Prep notes..."
              rows={3}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm placeholder-slate-500"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            />
          </div>
          <Button onClick={handleSave}>Save profile</Button>
        </div>
      </Card>

      {/* Federation judging focus */}
      {federationCriteria && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2" style={{ color: colors.text }}>
            <Award size={18} />
            {federationCriteria.name} judging focus
          </h2>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {federationCriteria.focus.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Photo guide */}
      <PhotoGuideCard phase={prepPhase || client.prepPhase} />

      {/* Nav to Photos & Posing */}
      <div className="space-y-2 mt-6">
        <Card
          style={{ padding: spacing[16], cursor: 'pointer' }}
          onClick={() => navigate(`/comp-prep/${clientId}/photos`)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera size={22} style={{ color: colors.muted }} />
              <span className="font-medium">Photo Vault</span>
            </div>
            <ChevronRight size={20} style={{ color: colors.muted }} />
          </div>
          <p className="text-xs mt-1 ml-9" style={{ color: colors.muted }}>
            Upload, compare, progression
          </p>
        </Card>
        <Card
          style={{ padding: spacing[16], cursor: 'pointer' }}
          onClick={() => navigate(`/comp-prep/${clientId}/posing`)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layout size={22} style={{ color: colors.muted }} />
              <span className="font-medium">Posing</span>
            </div>
            <ChevronRight size={20} style={{ color: colors.muted }} />
          </div>
          <p className="text-xs mt-1 ml-9" style={{ color: colors.muted }}>
            Mandatory poses, coaching notes
          </p>
        </Card>
      </div>
    </div>
  );
}
