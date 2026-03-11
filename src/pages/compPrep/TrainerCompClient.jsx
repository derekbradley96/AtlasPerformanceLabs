import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClientById, getClientCheckIns } from '@/data/selectors';
import {
  getClientCompProfile,
  upsertClientCompProfile,
  listMedia,
  markMediaReviewed,
} from '@/lib/repos/compPrepRepo';
import { getAllPoses } from '@/lib/repos/poseLibraryRepo';
import { impactLight, notificationSuccess } from '@/lib/haptics';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import HealthBreakdownSheet from '@/components/health/HealthBreakdownSheet';
import { getPhaseAwareHealthResult } from '@/lib/intelligence/healthScoreEngineBridge';
import { colors, spacing } from '@/ui/tokens';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

const FEDERATIONS = ['PCA', '2BROS', 'OTHER'];
const SEX_OPTIONS = ['MALE', 'FEMALE'];
const DIVISIONS = ['BODYBUILDING', 'CLASSIC', 'PHYSIQUE', 'BIKINI', 'FIGURE', 'WELLNESS'];
const PHASES = ['OFFSEASON', 'PREP', 'PEAK_WEEK', 'SHOW_DAY', 'POST_SHOW'];

export default function TrainerCompClient() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const client = useMemo(() => (clientId ? getClientById(clientId) : null), [clientId]);
  const profile = useMemo(() => (clientId ? getClientCompProfile(clientId) : null), [clientId]);
  const mediaList = useMemo(() => (clientId ? listMedia(clientId) : []), [clientId]);
  const allPoses = useMemo(() => getAllPoses(), []);

  const [federation, setFederation] = useState(profile?.federation ?? '');
  const [sex, setSex] = useState(profile?.sex ?? '');
  const [division, setDivision] = useState(profile?.division ?? '');
  const [prepPhase, setPrepPhase] = useState(profile?.prepPhase ?? '');
  const [showDate, setShowDate] = useState(profile?.showDate ?? '');
  const [coachNotes, setCoachNotes] = useState(profile?.coachNotes ?? '');
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [healthSheetOpen, setHealthSheetOpen] = useState(false);

  const checkIns = useMemo(() => (clientId ? getClientCheckIns(clientId) : []), [clientId]);
  const healthResult = useMemo(
    () => (client && clientId ? getPhaseAwareHealthResult(client, checkIns) : null),
    [clientId, client, checkIns]
  );
  const healthRiskColor = healthResult?.risk === 'high' ? '#EF4444' : healthResult?.risk === 'moderate' ? '#F59E0B' : '#22C55E';
  const healthBg = healthResult ? `${healthRiskColor}22` : 'rgba(255,255,255,0.08)';

  const mandatoryPosesForDivision = useMemo(() => {
    if (!division) return [];
    return allPoses.filter((p) => p.divisions.includes(division) && p.isMandatory);
  }, [division, allPoses]);

  const submittedPoseIds = useMemo(() => new Set(mediaList.filter((m) => m.poseId).map((m) => m.poseId)), [mediaList]);
  const missingMandatory = useMemo(
    () => mandatoryPosesForDivision.filter((p) => !submittedPoseIds.has(p.id)),
    [mandatoryPosesForDivision, submittedPoseIds]
  );

  useEffect(() => {
    setFederation(profile?.federation ?? '');
    setSex(profile?.sex ?? '');
    setDivision(profile?.division ?? '');
    setPrepPhase(profile?.prepPhase ?? '');
    setShowDate(profile?.showDate ?? '');
    setCoachNotes(profile?.coachNotes ?? '');
  }, [profile?.federation, profile?.sex, profile?.division, profile?.prepPhase, profile?.showDate, profile?.coachNotes]);

  const handleSaveProfile = () => {
    if (!clientId || !federation || !sex || !division || !prepPhase) return;
    impactLight();
    upsertClientCompProfile({
      clientId,
      federation,
      sex,
      division,
      prepPhase,
      showDate: showDate || undefined,
      coachNotes: coachNotes || undefined,
      updatedAt: new Date().toISOString(),
    });
    notificationSuccess();
    toast.success('Profile saved');
  };

  const handleMarkReviewed = (mediaId) => {
    impactLight();
    markMediaReviewed(mediaId, reviewComment);
    setReviewingId(null);
    setReviewComment('');
    notificationSuccess();
    toast.success('Marked as reviewed');
  };

  const handleRequestPoses = () => {
    impactLight();
    toast.success('Request sent. (Inbox task hook coming later.)');
  };

  if (!client) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Client not found.</p>
      </div>
    );
  }

  const latestMedia = mediaList.slice(0, 5);

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
      <div className="flex items-center justify-between gap-2 mb-1">
        <h1 className="text-lg font-semibold">{client.full_name || client.name || 'Client'}</h1>
        <button
          type="button"
          onClick={async () => { await lightHaptic(); setHealthSheetOpen(true); }}
          className="rounded-full px-2.5 py-1.5 text-[11px] font-medium flex-shrink-0 active:opacity-80"
          style={{ background: healthBg, color: healthResult ? healthRiskColor : colors.muted, border: 'none' }}
          aria-label="Health score"
        >
          Health {healthResult?.score ?? '—'}
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Comp profile & media review
      </p>

      <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
        <h2 className="text-sm font-semibold mb-3">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Federation</label>
            <select
              value={federation}
              onChange={(e) => setFederation(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {FEDERATIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {SEX_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Division</label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Phase</label>
            <select
              value={prepPhase}
              onChange={(e) => setPrepPhase(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {PHASES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Show date</label>
            <input
              type="date"
              value={showDate}
              onChange={(e) => setShowDate(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Coach notes (private)</label>
            <textarea
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            />
          </div>
          <Button onClick={handleSaveProfile}>Save profile</Button>
        </div>
      </Card>

      {missingMandatory.length > 0 && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h2 className="text-sm font-semibold mb-2">Missing mandatory poses</h2>
          <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
            {missingMandatory.map((p) => (
              <li key={p.id}>• {p.name}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Latest submissions</h2>
          <button type="button" onClick={handleRequestPoses} className="text-xs font-medium" style={{ color: colors.accent }}>
            Request poses
          </button>
        </div>
        {latestMedia.length === 0 ? (
          <p className="text-sm" style={{ color: colors.muted }}>No media yet.</p>
        ) : (
          <div className="space-y-2">
            {latestMedia.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                  {m.mediaType === 'photo' ? (
                    <img src={m.uri} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: colors.muted }}>▶</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: colors.muted }}>
                    {new Date(m.createdAt).toLocaleDateString()} · {m.category}
                    {m.poseId && ` · ${m.poseId}`}
                  </p>
                  {m.reviewedAt ? (
                    <p className="text-xs mt-0.5" style={{ color: colors.success }}>Reviewed</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        impactLight();
                        setReviewingId(m.id);
                        setReviewComment(m.trainerComment ?? '');
                      }}
                      className="text-xs mt-0.5"
                      style={{ color: colors.accent }}
                    >
                      Mark reviewed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {reviewingId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setReviewingId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-4"
            style={{
              background: colors.card,
              paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Add review comment</h3>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Comment for client..."
              rows={3}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm mb-3"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setReviewingId(null)}>Cancel</Button>
              <Button onClick={() => handleMarkReviewed(reviewingId)}>Mark reviewed</Button>
            </div>
          </div>
        </div>
      )}

      <HealthBreakdownSheet
        open={healthSheetOpen}
        onOpenChange={setHealthSheetOpen}
        result={healthResult}
      />
    </div>
  );
}
