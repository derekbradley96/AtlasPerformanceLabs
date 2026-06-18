import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Dumbbell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { getPoseById } from '@/lib/repos/poseLibraryRepo';
import { getExerciseById } from '@/data/exercises/exerciseLibrary';
import { getMessagesThreadPath } from '@/lib/messagesPath';
import { impactLight } from '@/lib/haptics';
import PoseDiagram from '@/components/compPrep/PoseDiagram';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

function divisionPresentationTone(division) {
  const d = String(division || '').toUpperCase();
  return d.includes('BIKINI') || d.includes('WELLNESS');
}

export default function PoseDetail() {
  const { poseId } = useParams();
  const navigate = useNavigate();
  const { user, role, clientLinkedRow } = useAuth();
  const pose = getPoseById(poseId);

  const clientId = useMemo(() => {
    if (role !== 'client' || !user?.id) return null;
    return clientLinkedRow?.id ?? null;
  }, [role, user?.id, clientLinkedRow?.id]);
  const profile = useMemo(() => (clientId ? getClientCompProfile(clientId) : null), [clientId]);
  const federation = profile?.federation ?? 'PCA';
  const clientDivision = profile?.division ?? '';

  const [activeHotspot, setActiveHotspot] = useState(null);

  const handleHotspotTap = useCallback((hotspot) => {
    impactLight();
    setActiveHotspot(hotspot);
  }, []);

  const handleUploadThisPose = useCallback(() => {
    impactLight();
    navigate(`/comp-prep/media/upload?poseId=${encodeURIComponent(poseId || '')}`);
  }, [navigate, poseId]);

  const programBuilderUrlForExercise = useCallback(
    (exerciseLibraryId) => {
      const p = new URLSearchParams();
      if (role === 'personal') p.set('personal', '1');
      p.set('suggestedExercise', exerciseLibraryId);
      return `/program-builder?${p.toString()}`;
    },
    [role],
  );

  const handleAskCoachForExercises = useCallback(() => {
    if (!clientId || !pose) return;
    impactLight();
    const links = pose.poseExerciseLinks ?? [];
    const names = links
      .map((l) => getExerciseById(l.exerciseId)?.name)
      .filter(Boolean);
    const list = names.length ? names.join(', ') : 'these exercises';
    const msg = `Can we add ${list} to my program? I'm working on my ${pose.name} pose.`;
    navigate(getMessagesThreadPath(clientId), { state: { prefilledMessage: msg } });
  }, [clientId, navigate, pose]);

  if (!pose) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Pose not found.</p>
      </div>
    );
  }

  const judgeNotesForFederation =
    pose.judgeNotes.find((j) => j.federation === federation) ??
    pose.judgeNotes.find((j) => j.federation === 'PCA') ??
    pose.judgeNotes[0];
  const judgeBullets = judgeNotesForFederation?.bullets ?? [];

  const usePresentationScript =
    pose.coachingScriptPresentation &&
    divisionPresentationTone(clientDivision);
  const verbalCues =
    (usePresentationScript ? pose.coachingScriptPresentation : pose.coachingScript) || pose.coachingScript;

  const poseExerciseLinks = pose.poseExerciseLinks ?? [];
  const primaryExerciseLinks = poseExerciseLinks.filter((l) => l.priority === 'primary');
  const secondaryExerciseLinks = poseExerciseLinks.filter((l) => l.priority === 'secondary');
  const showProgramBuilderCtas = role !== 'client';
  const showAskCoachCtas = role === 'client' && Boolean(clientId);

  const sidebar = (
    <div className="flex flex-col gap-4 min-w-0 lg:max-w-[400px]">
      {judgeBullets.length > 0 && (
        <Card style={{ padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Judges look for ({federation})</h3>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {judgeBullets.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </Card>
      )}

      {pose.commonMistakes?.length > 0 && (
        <Card style={{ padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Common mistakes</h3>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {pose.commonMistakes.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </Card>
      )}

      {pose.tips?.length > 0 && (
        <Card style={{ padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Tips</h3>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {pose.tips.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </Card>
      )}

      {verbalCues ? (
        <div
          className="rounded-2xl border p-4 shadow-lg"
          style={{
            borderColor: colors.border,
            background: 'linear-gradient(145deg, rgba(59,130,246,0.12) 0%, rgba(15,23,42,0.95) 100%)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(59,130,246,0.25)', color: colors.accent }}
              aria-hidden
            >
              <Mic size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold mb-1" style={{ color: colors.text }}>
                {"Coach's Verbal Cues"}
              </h3>
              {usePresentationScript ? (
                <p className="text-xs mb-2" style={{ color: colors.muted }}>
                  Presentation focus (Bikini / Wellness)
                </p>
              ) : (
                <p className="text-xs mb-2" style={{ color: colors.muted }}>
                  Conditioning &amp; muscular detail cues
                </p>
              )}
              <p className="text-[15px] leading-relaxed" style={{ color: colors.text }}>
                {verbalCues}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {poseExerciseLinks.length > 0 ? (
        <Card style={{ padding: spacing[16] }}>
          <div className="flex items-start gap-2 mb-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}
              aria-hidden
            >
              <Dumbbell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold mb-0.5" style={{ color: colors.text }}>
                Exercises for this pose
              </h3>
              <p className="text-xs leading-snug" style={{ color: colors.muted }}>
                Pick lifts that carry over to what judges see in this pose—not random “busy work” in the gym.
              </p>
            </div>
          </div>

          {primaryExerciseLinks.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Key exercises
              </p>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {primaryExerciseLinks.map((l) => {
                  const ex = getExerciseById(l.exerciseId);
                  const label = ex?.name || l.exerciseId;
                  return (
                    <li
                      key={`p-${l.exerciseId}`}
                      className="rounded-xl border p-3"
                      style={{ borderColor: colors.border, background: colors.surface2 }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
                        {label}
                      </p>
                      <p className="text-xs leading-relaxed mb-3" style={{ color: colors.muted }}>
                        {l.reason}
                      </p>
                      {showProgramBuilderCtas ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full min-h-[44px] text-sm lg:w-auto"
                          onClick={() => {
                            impactLight();
                            navigate(programBuilderUrlForExercise(l.exerciseId));
                          }}
                        >
                          {role === 'personal' ? 'Add to my program' : 'Add to program'}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {secondaryExerciseLinks.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Supporting exercises
              </p>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {secondaryExerciseLinks.map((l) => {
                  const ex = getExerciseById(l.exerciseId);
                  const label = ex?.name || l.exerciseId;
                  return (
                    <li
                      key={`s-${l.exerciseId}`}
                      className="rounded-xl border p-3"
                      style={{ borderColor: colors.border, background: colors.surface2 }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
                        {label}
                      </p>
                      <p className="text-xs leading-relaxed mb-3" style={{ color: colors.muted }}>
                        {l.reason}
                      </p>
                      {showProgramBuilderCtas ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full min-h-[44px] text-sm lg:w-auto"
                          onClick={() => {
                            impactLight();
                            navigate(programBuilderUrlForExercise(l.exerciseId));
                          }}
                        >
                          {role === 'personal' ? 'Add to my program' : 'Add to program'}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {showAskCoachCtas ? (
            <Button type="button" className="w-full min-h-[44px] text-sm" onClick={handleAskCoachForExercises}>
              Ask coach to add these
            </Button>
          ) : null}
        </Card>
      ) : null}

      <Button onClick={handleUploadThisPose}>Upload this pose</Button>
    </div>
  );

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
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
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

          <div className="mb-4 w-full">
            <PoseDiagram
              pose={pose}
              activeHotspotId={activeHotspot?.id}
              onHotspotTap={handleHotspotTap}
            />
          </div>

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

          <div className="lg:hidden">{sidebar}</div>
        </div>

        <div className="hidden lg:block w-full lg:w-[380px] lg:flex-shrink-0">{sidebar}</div>
      </div>
    </div>
  );
}
