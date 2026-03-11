import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClientByUserId } from '@/data/selectors';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { getPoseById } from '@/lib/repos/poseLibraryRepo';
import { impactLight } from '@/lib/haptics';
import PoseDiagram from '@/components/compPrep/PoseDiagram';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

export default function PoseDetail() {
  const { poseId } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const pose = getPoseById(poseId);

  const clientId = useMemo(() => {
    if (role !== 'client' || !user?.id) return null;
    const c = getClientByUserId(user.id);
    return c?.id ?? null;
  }, [role, user?.id]);
  const profile = useMemo(() => (clientId ? getClientCompProfile(clientId) : null), [clientId]);
  const federation = profile?.federation ?? 'PCA';

  const [activeHotspot, setActiveHotspot] = useState(null);

  const handleHotspotTap = useCallback((hotspot) => {
    impactLight();
    setActiveHotspot(hotspot);
  }, []);

  const handleUploadThisPose = useCallback(() => {
    impactLight();
    navigate(`/comp-prep/media/upload?poseId=${encodeURIComponent(poseId || '')}`);
  }, [navigate, poseId]);

  if (!pose) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Pose not found.</p>
      </div>
    );
  }

  const judgeNotesForFederation = pose.judgeNotes.find((j) => j.federation === federation) ?? pose.judgeNotes[0];
  const judgeBullets = judgeNotesForFederation?.bullets ?? [];

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
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold">{pose.name}</span>
        {pose.isMandatory && (
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: 'rgba(37, 99, 235, 0.2)', color: colors.accent }}
          >
            Mandatory
          </span>
        )}
      </div>
      {pose.description && (
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          {pose.description}
        </p>
      )}

      <div className="mb-4">
        <PoseDiagram
          pose={pose}
          activeHotspotId={activeHotspot?.id}
          onHotspotTap={handleHotspotTap}
        />
      </div>

      {/* Bottom sheet: hotspot cue */}
      {activeHotspot && (
        <Card
          style={{
            marginBottom: spacing[16],
            padding: spacing[16],
            borderLeft: `4px solid ${colors.accent}`,
          }}
        >
          <h3 className="font-semibold text-sm mb-1">{activeHotspot.cueTitle}</h3>
          <p className="text-sm" style={{ color: colors.muted }}>
            {activeHotspot.cueBody}
          </p>
          <button
            type="button"
            onClick={() => setActiveHotspot(null)}
            className="text-xs mt-2"
            style={{ color: colors.muted }}
          >
            Close
          </button>
        </Card>
      )}

      {judgeBullets.length > 0 && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Judges look for ({federation})</h3>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {judgeBullets.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </Card>
      )}

      {pose.commonMistakes?.length > 0 && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Common mistakes</h3>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {pose.commonMistakes.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </Card>
      )}

      {pose.tips?.length > 0 && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Tips</h3>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {pose.tips.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </Card>
      )}

      <Button onClick={handleUploadThisPose}>Upload this pose</Button>
    </div>
  );
}
