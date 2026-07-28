/**
 * Client/personal pose check submission. One per week (Monday week_start).
 * Prep clients with division templates get pose_check_items — upload one photo per mandatory pose.
 * Others use legacy multi-photo on pose_checks.photos.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, shadows } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getMyClientId } from '@/lib/checkins';
import {
  getWeekStartISO,
  getPoseCheckForWeek,
  insertPoseCheck,
  uploadPoseCheckPhoto,
  updatePoseCheckPhotos,
  getPoseCheckItems,
  updatePoseCheckItem,
  createPoseCheckPhotoSignedUrl,
} from '@/lib/poseChecks';
import { trackPoseCheckSubmitted, trackProgressPhotoUploaded } from '@/services/engagementTracker';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { ImagePlus, CheckCircle2, Sparkles } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import AchievementUnlockedModal from '@/components/achievements/AchievementUnlockedModal';
import { evaluateUserMilestones } from '@/lib/milestoneEngine';
import { isClient, isPersonal } from '@/lib/roles';

function isClientOrPersonal(role) {
  return isClient(role) || isPersonal(role);
}

function PoseFeedbackImage({ item, urlMap }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const displayUrl =
    item.annotated_image_path && urlMap?.annotated ? urlMap.annotated : urlMap?.raw;
  const annotations = Array.isArray(item.coach_annotations) ? item.coach_annotations : [];
  if (!displayUrl) return null;
  return (
    <div className="relative rounded-lg overflow-hidden mt-2" style={{ background: colors.surface2 }}>
      <img src={displayUrl} alt={item.pose_label} className="w-full max-h-72 object-contain" />
      {!item.annotated_image_path && annotations.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {annotations.map((a, idx) => (
            <button
              key={idx}
              type="button"
              className="absolute rounded-full pointer-events-auto border-2 border-white"
              style={{
                left: `${(a.x ?? 0) * 100}%`,
                top: `${(a.y ?? 0) * 100}%`,
                width: 14,
                height: 14,
                transform: 'translate(-50%, -50%)',
                background: a.color || '#ef4444',
              }}
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              aria-label="Marker"
            />
          ))}
        </div>
      )}
      {expandedIdx != null && annotations[expandedIdx]?.label && (
        <div
          className="absolute left-2 right-2 bottom-2 text-xs p-2 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}
        >
          {annotations[expandedIdx].label}
        </div>
      )}
    </div>
  );
}

export default function PoseCheckSubmitPage() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [initLoading, setInitLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [weekStart, setWeekStart] = useState('');
  /** 'form' | 'structured' | 'submitted' */
  const [flow, setFlow] = useState('form');
  const [submittedRow, setSubmittedRow] = useState(null);
  const [submittedItems, setSubmittedItems] = useState([]);
  const [feedbackItemUrls, setFeedbackItemUrls] = useState({});
  const [poseCheckRow, setPoseCheckRow] = useState(null);
  const [structuredItems, setStructuredItems] = useState([]);
  const [clientNotes, setClientNotes] = useState('');
  const [legacyPhotoFiles, setLegacyPhotoFiles] = useState([]);
  const [structuredExtraFiles, setStructuredExtraFiles] = useState([]);
  /** @type {Record<string, File | undefined>} */
  const [poseFilesByItemId, setPoseFilesByItemId] = useState({});
  const [achievementRecord, setAchievementRecord] = useState(null);

  const loadWeekState = useCallback(async () => {
    const w = getWeekStartISO();
    setWeekStart(w);
    const cid = await getMyClientId();
    setClientId(cid);
    if (!cid) {
      setFlow('form');
      return;
    }
    const ex = await getPoseCheckForWeek(cid, w);
    if (!ex) {
      setFlow('form');
      setSubmittedRow(null);
      setSubmittedItems([]);
      setPoseCheckRow(null);
      setStructuredItems([]);
      return;
    }
    const items = await getPoseCheckItems(ex.id);
    const needsPoseUploads = items.length > 0 && items.some((i) => !i.photo_path);
    if (needsPoseUploads) {
      setPoseCheckRow(ex);
      setStructuredItems(items);
      setFlow('structured');
      setSubmittedRow(null);
      setSubmittedItems([]);
    } else {
      setSubmittedRow(ex);
      setSubmittedItems(items);
      setPoseCheckRow(null);
      setStructuredItems([]);
      setFlow('submitted');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitLoading(true);
      await loadWeekState();
      if (!cancelled) setInitLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadWeekState]);

  const previewsLegacy = useMemo(() => {
    return legacyPhotoFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
  }, [legacyPhotoFiles]);

  useEffect(() => () => { previewsLegacy.forEach((p) => URL.revokeObjectURL(p.url)); }, [previewsLegacy]);

  const structuredPreviews = useMemo(() => {
    const out = {};
    for (const item of structuredItems) {
      const f = poseFilesByItemId[item.id];
      if (f) out[item.id] = URL.createObjectURL(f);
    }
    return out;
  }, [structuredItems, poseFilesByItemId]);

  const structuredExtraPreviews = useMemo(
    () => structuredExtraFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [structuredExtraFiles]
  );

  useEffect(() => () => {
    Object.values(structuredPreviews).forEach((u) => URL.revokeObjectURL(u));
  }, [structuredPreviews]);
  useEffect(() => () => {
    structuredExtraPreviews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [structuredExtraPreviews]);

  useEffect(() => {
    if (flow !== 'submitted' || !submittedItems.length) {
      setFeedbackItemUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        submittedItems.map(async (i) => {
          const entry = {};
          if (i.annotated_image_path) {
            const u = await createPoseCheckPhotoSignedUrl(i.annotated_image_path);
            if (u) entry.annotated = u;
          }
          if (i.photo_path) {
            const u2 = await createPoseCheckPhotoSignedUrl(i.photo_path);
            if (u2) entry.raw = u2;
          }
          if (Object.keys(entry).length) next[i.id] = entry;
        })
      );
      if (!cancelled) setFeedbackItemUrls(next);
    })();
    return () => { cancelled = true; };
  }, [flow, submittedRow?.id, weekStart, submittedItems.map((i) => `${i.id}:${i.annotated_image_path || ''}:${i.photo_path || ''}`).join('|')]);

  const handleLegacyPhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    setLegacyPhotoFiles((prev) => [...prev, ...files]);
  };

  const handleStructuredFile = (itemId, e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setPoseFilesByItemId((prev) => ({ ...prev, [itemId]: file }));
  };
  const handleStructuredExtraFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setStructuredExtraFiles((prev) => [...prev, ...files]);
  };

  const handleCreateCheck = async (e) => {
    e.preventDefault();
    if (!clientId || submitting) return;
    setSubmitting(true);
    try {
      const row = await insertPoseCheck({
        client_id: clientId,
        week_start: weekStart,
        client_notes: clientNotes.trim() || null,
      });
      if (!row?.id) {
        toast.error('Failed to start pose check');
        return;
      }
      const items = await getPoseCheckItems(row.id);
      if (items.length > 0) {
        hapticLight();
        setPoseCheckRow(row);
        setStructuredItems(items);
        setFlow('structured');
        setLegacyPhotoFiles([]);
        toast.message('Now add a photo for each pose below.');
        return;
      }
      const paths = [];
      for (const file of legacyPhotoFiles) {
        const path = await uploadPoseCheckPhoto({
          clientId,
          poseCheckId: row.id,
          file,
        });
        if (path) paths.push(path);
      }
      if (paths.length > 0) await updatePoseCheckPhotos(row.id, paths);
      toast.success('Posing check sent to your coach');
      hapticLight();
      let coachId = null;
      if (hasSupabase && clientId) {
        try {
          const supabase = getSupabase();
          const { data: clientRow } = await supabase.from('clients').select('coach_id, trainer_id').eq('id', clientId).maybeSingle();
          coachId = clientRow?.coach_id ?? clientRow?.trainer_id ?? null;
        } catch (_) {}
      }
      trackPoseCheckSubmitted(clientId, coachId, { pose_check_id: row.id, photo_count: paths.length }).catch(() => {});
      if (paths.length > 0) {
        trackProgressPhotoUploaded(clientId, coachId, { pose_check_id: row.id, photo_count: paths.length }).catch(() => {});
      }
      const unlocked = evaluateUserMilestones(user?.id, [], {
        poseCheckCount: 1,
        isCompetitionClient: true,
      });
      if (unlocked) setAchievementRecord(unlocked);
      await loadWeekState();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishStructured = async (e) => {
    e.preventDefault();
    if (!clientId || !poseCheckRow?.id || submitting) return;
    const missing = structuredItems.filter((i) => !i.photo_path && !poseFilesByItemId[i.id]);
    if (missing.length > 0) {
      toast.error(`Add a photo for: ${missing.map((m) => m.pose_label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const paths = [];
      for (const item of structuredItems) {
        const file = poseFilesByItemId[item.id];
        if (!file) continue;
        const path = await uploadPoseCheckPhoto({
          clientId,
          poseCheckId: poseCheckRow.id,
          file,
        });
        if (path) {
          paths.push(path);
          await updatePoseCheckItem(item.id, { photo_path: path });
        }
      }
      for (const file of structuredExtraFiles) {
        const path = await uploadPoseCheckPhoto({
          clientId,
          poseCheckId: poseCheckRow.id,
          file,
        });
        if (path) paths.push(path);
      }
      if (paths.length > 0) await updatePoseCheckPhotos(poseCheckRow.id, paths);
      toast.success('Posing check sent to your coach');
      hapticLight();
      let coachId = null;
      if (hasSupabase && clientId) {
        try {
          const supabase = getSupabase();
          const { data: clientRow } = await supabase.from('clients').select('coach_id, trainer_id').eq('id', clientId).maybeSingle();
          coachId = clientRow?.coach_id ?? clientRow?.trainer_id ?? null;
        } catch (_) {}
      }
      trackPoseCheckSubmitted(clientId, coachId, { pose_check_id: poseCheckRow.id, photo_count: paths.length }).catch(() => {});
      trackProgressPhotoUploaded(clientId, coachId, { pose_check_id: poseCheckRow.id, photo_count: paths.length }).catch(() => {});
      const unlocked = evaluateUserMilestones(user?.id, [], {
        poseCheckCount: 1,
        isCompetitionClient: true,
      });
      if (unlocked) setAchievementRecord(unlocked);
      setPoseFilesByItemId({});
      setStructuredExtraFiles([]);
      await loadWeekState();
    } catch {
      toast.error('Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (initLoading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Posing check" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!isClientOrPersonal(role)) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Posing check" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.muted }}>Pose check submission is for clients and personal accounts.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Posing check" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.muted, marginBottom: spacing[16] }}>
            Link your account to a coach to submit pose checks.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (flow === 'submitted' && submittedRow) {
    const reviewed = !!(submittedRow.reviewed_at || submittedRow.reviewed_by);
    const hasItemFeedback = submittedItems.some((i) => (i.coach_notes && String(i.coach_notes).trim()) || i.coach_rating != null);
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Posing check" onBack={() => navigate(-1)} />
        <div className="p-4" style={{ paddingBottom: spacing[32] }}>
          <Card
            style={{
              padding: spacing[20],
              marginBottom: spacing[16],
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.glow,
              background: 'linear-gradient(145deg, rgba(59,130,246,0.12) 0%, rgba(15,23,42,0.4) 100%)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: colors.primarySubtle, color: colors.primary }}
              >
                <Sparkles size={24} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: colors.text }}>Weekly posing check</p>
                <p className="text-sm mt-1" style={{ color: colors.muted }}>
                  Week of {weekStart} · Core prep workflow — your coach reviews poses here every week.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={22} style={{ color: colors.success }} />
            <p className="font-semibold" style={{ color: colors.text }}>Submitted</p>
          </div>

          {reviewed ? (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16], border: `2px solid ${colors.primary}`, boxShadow: shadows.brandGlow }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: colors.primary }}>Coach feedback</p>
              {submittedRow.coach_notes ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: colors.text }}>{submittedRow.coach_notes}</p>
              ) : (
                <p className="text-sm" style={{ color: colors.muted }}>Your coach reviewed this submission. Check per-pose notes below.</p>
              )}
            </Card>
          ) : (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
              <p className="text-sm" style={{ color: colors.muted }}>
                Waiting for coach review. You&apos;ll see their feedback here when it&apos;s ready.
              </p>
            </Card>
          )}

          {submittedRow.client_notes && (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
              <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>Your notes</p>
              <p className="text-sm" style={{ color: colors.text }}>{submittedRow.client_notes}</p>
            </Card>
          )}

          {(hasItemFeedback || submittedItems.some((i) => i.photo_path || i.annotated_image_path)) && (
            <div style={{ marginBottom: spacing[16] }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Per-pose feedback</p>
              <div className="space-y-2">
                {submittedItems
                  .filter(
                    (i) =>
                      (i.coach_notes && String(i.coach_notes).trim()) ||
                      i.coach_rating != null ||
                      i.photo_path ||
                      i.annotated_image_path
                  )
                  .map((i) => (
                    <Card key={i.id} style={{ padding: spacing[12] }}>
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>{i.pose_label}</p>
                      <PoseFeedbackImage item={i} urlMap={feedbackItemUrls[i.id]} />
                      {i.coach_rating != null && (
                        <p className="text-xs mt-1" style={{ color: colors.accent }}>Rating {i.coach_rating}/10</p>
                      )}
                      {i.coach_notes && (
                        <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: colors.text }}>{i.coach_notes}</p>
                      )}
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {Array.isArray(submittedRow.photos) && submittedRow.photos.length > 0 && submittedItems.length === 0 && (
            <p className="text-sm" style={{ color: colors.muted }}>{submittedRow.photos.length} photo(s) on file.</p>
          )}

          <Button variant="outline" className="mt-6 w-full" onClick={() => navigate(-1)}>Done</Button>
        </div>
      </div>
    );
  }

  if (flow === 'structured' && poseCheckRow && structuredItems.length > 0) {
    const doneCount = structuredItems.filter((i) => i.photo_path || poseFilesByItemId[i.id]).length;
    const total = structuredItems.length;
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Posing check" onBack={() => navigate(-1)} />
        <form onSubmit={handleFinishStructured} className="p-4" style={{ paddingBottom: spacing[32] }}>
          <Card style={{ padding: spacing[16], marginBottom: spacing[16], border: `1px solid ${colors.primary}55` }}>
            <p className="text-base font-semibold" style={{ color: colors.text }}>Upload your poses</p>
            <p className="text-sm mt-1" style={{ color: colors.muted }}>
              Week of {weekStart} · {doneCount}/{total} poses ready · one clear photo per pose helps your coach compare week to week.
            </p>
          </Card>
          <div className="space-y-3">
            {structuredItems.map((item) => {
              const hasPath = !!item.photo_path;
              const file = poseFilesByItemId[item.id];
              const preview = structuredPreviews[item.id];
              return (
                <Card key={item.id} style={{ padding: spacing[16] }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>{item.pose_label}</p>
                  {hasPath ? (
                    <p className="text-xs" style={{ color: colors.success }}>Photo on file — replace?</p>
                  ) : null}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    id={`pose-file-${item.id}`}
                    onChange={(ev) => handleStructuredFile(item.id, ev)}
                  />
                  <label
                    htmlFor={`pose-file-${item.id}`}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed cursor-pointer py-6 mt-2"
                    style={{ borderColor: colors.border, color: colors.muted }}
                  >
                    <ImagePlus size={22} />
                    <span className="text-sm">{file || hasPath ? 'Change photo' : 'Add photo'}</span>
                  </label>
                  {preview && (
                    <img src={preview} alt="" className="mt-3 w-full max-h-64 object-contain rounded-lg" style={{ background: colors.surface2 }} />
                  )}
                </Card>
              );
            })}
          </div>
          <Card style={{ padding: spacing[16], marginTop: spacing[12] }}>
            <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Optional extra photos</p>
            <input
              type="file"
              multiple
              accept="image/*"
              className="sr-only"
              id="pose-check-extra-files"
              onChange={handleStructuredExtraFiles}
            />
            <label
              htmlFor="pose-check-extra-files"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer py-4"
              style={{ borderColor: colors.border, color: colors.muted }}
            >
              <ImagePlus size={20} />
              <span>{structuredExtraFiles.length > 0 ? `${structuredExtraFiles.length} selected` : 'Add optional extras'}</span>
            </label>
            {structuredExtraPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {structuredExtraPreviews.map((p) => (
                  <img key={p.url} src={p.url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                ))}
              </div>
            )}
          </Card>
          <Button type="submit" disabled={submitting} className="w-full mt-6" style={{ minHeight: 48 }}>
            {submitting ? 'Uploading…' : 'Send to coach'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Posing check" onBack={() => navigate(-1)} />
      <form onSubmit={handleCreateCheck} className="p-4" style={{ paddingBottom: spacing[32] }}>
        <Card
          style={{
            padding: spacing[20],
            marginBottom: spacing[16],
            border: `1px solid ${colors.primary}44`,
            boxShadow: shadows.glow,
          }}
        >
          <p className="text-lg font-bold" style={{ color: colors.text }}>Weekly posing check</p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: colors.muted }}>
            Send stage photos so your coach can review posing and track progress. If you&apos;re in contest prep with mandatory poses, you&apos;ll upload one shot per pose after this step.
          </p>
        </Card>
        <p className="text-xs font-medium mb-4" style={{ color: colors.muted }}>
          Week of {weekStart}
        </p>

        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes (optional)</label>
          <textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            placeholder="Condition, how posing felt, what you want feedback on…"
            rows={3}
            className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
            style={{ padding: 10, borderColor: colors.border }}
          />
        </Card>

        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Photos (if not using mandatory poses)</label>
          <p className="text-xs mb-3" style={{ color: colors.muted }}>
            Prep athletes with a division usually skip this — you&apos;ll add front / side / back per pose next. Everyone else: add progress shots here.
          </p>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleLegacyPhotoChange}
            className="sr-only"
            id="pose-check-photos"
          />
          <label
            htmlFor="pose-check-photos"
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer py-4"
            style={{ borderColor: colors.border, color: colors.muted }}
          >
            <ImagePlus size={20} />
            <span>{legacyPhotoFiles.length > 0 ? `${legacyPhotoFiles.length} selected` : 'Select images'}</span>
          </label>
          {previewsLegacy.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {previewsLegacy.map((p) => (
                <img key={p.url} src={p.url} alt="" className="w-16 h-16 object-cover rounded-lg" />
              ))}
            </div>
          )}
        </Card>

        <Button type="submit" disabled={submitting} className="w-full" style={{ minHeight: 48 }}>
          {submitting ? 'Working…' : 'Continue'}
        </Button>
      </form>
      {achievementRecord ? (
        <AchievementUnlockedModal
          record={achievementRecord}
          onClose={() => setAchievementRecord(null)}
        />
      ) : null}
    </div>
  );
}
