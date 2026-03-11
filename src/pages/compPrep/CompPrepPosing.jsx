import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { getClientById } from '@/data/selectors';
import { getPosesForDivision } from '@/lib/compPrep/poseSets';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

export default function CompPrepPosing() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const client = useMemo(() => (clientId ? getClientById(clientId) : null), [clientId]);
  const poses = useMemo(() => getPosesForDivision(client?.division ?? ''), [client?.division]);

  const [expandedId, setExpandedId] = useState(null);
  const [coachingNotes, setCoachingNotes] = useState({});

  const setNote = (poseId, value) => {
    setCoachingNotes((prev) => ({ ...prev, [poseId]: value }));
  };

  if (!client) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Client not found.</p>
      </div>
    );
  }

  if (!client.division) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{
          minHeight: '100%',
          background: colors.bg,
          color: colors.text,
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigate(`/comp-prep/${clientId}`)}
            className="p-2 -ml-2 rounded-lg"
            style={{ color: colors.muted }}
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-semibold">Posing</h1>
        </div>
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            Set division on the client comp profile to see mandatory poses.
          </p>
        </Card>
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
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate(`/comp-prep/${clientId}`)}
          className="p-2 -ml-2 rounded-lg"
          style={{ color: colors.muted }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold">Posing</h1>
      </div>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        {client.full_name || client.name} · {client.division}
      </p>

      <div className="space-y-2">
        {poses.map((pose) => {
          const isExpanded = expandedId === pose.id;
          return (
            <Card key={pose.id} style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : pose.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="font-medium">{pose.name}</span>
                {isExpanded ? <ChevronUp size={20} style={{ color: colors.muted }} /> : <ChevronDown size={20} style={{ color: colors.muted }} />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: colors.border }}>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
                      Description
                    </p>
                    <p className="text-sm">{pose.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
                      What judges look for
                    </p>
                    <p className="text-sm">{pose.judgesLookFor}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
                      Common mistakes
                    </p>
                    <p className="text-sm">{pose.commonMistakes}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                      Coaching notes
                    </label>
                    <textarea
                      value={coachingNotes[pose.id] ?? ''}
                      onChange={(e) => setNote(pose.id, e.target.value)}
                      placeholder="Notes for this pose..."
                      rows={2}
                      className="w-full rounded-lg border bg-slate-800 text-white text-sm placeholder-slate-500"
                      style={{ padding: '8px 10px', borderColor: colors.border }}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
