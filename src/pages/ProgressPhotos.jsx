import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { listProgressPhotos, uploadProgressPhoto } from '@/lib/progressPhotosService';
import { usePresentationMode } from '@/lib/presentationMode';
import { trackProgressPhotoUploaded } from '@/services/engagementTracker';
import { colors, spacing, shell } from '@/ui/tokens';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { Camera, ArrowLeftRight, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';

const TAG_OPTIONS = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'side_left', label: 'Side (left)' },
  { value: 'side_right', label: 'Side (right)' },
];

const PHOTO_GROUPS = [
  { key: 'front', title: 'Front', match: (t) => t === 'front' },
  { key: 'side', title: 'Side', match: (t) => t === 'side_left' || t === 'side_right' || t === 'side' },
  { key: 'back', title: 'Back', match: (t) => t === 'back' },
  { key: 'custom', title: 'Other', match: (t) => t === 'custom' || !['front', 'back', 'side_left', 'side_right', 'side'].includes(t) },
];

function badgeLabel(tag) {
  if (tag === 'side_left') return 'Side L';
  if (tag === 'side_right') return 'Side R';
  if (tag === 'side') return 'Side';
  return tag || '—';
}

function badgeStyle(tag) {
  if (tag === 'front') return { background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' };
  if (tag === 'back') return { background: 'rgba(34, 197, 94, 0.2)', color: '#86efac' };
  if (tag === 'side_left' || tag === 'side_right' || tag === 'side') {
    return { background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe' };
  }
  return { background: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' };
}

/** Prefer last 4 weeks of dated weight entries; fall back to full span. */
function interpretWeightTrendLine(photos, { isCompetition = false } = {}) {
  const dated = (photos || [])
    .filter((p) => p?.weight_kg != null && p?.date_taken)
    .map((p) => ({
      w: Number(p.weight_kg),
      t: new Date(p.date_taken).getTime(),
    }))
    .filter((p) => Number.isFinite(p.w) && !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t);
  if (dated.length < 2) return null;
  const last = dated[dated.length - 1];
  const windowMs = 28 * 24 * 60 * 60 * 1000;
  let slice = dated.filter((p) => p.t >= last.t - windowMs);
  if (slice.length < 2) slice = dated;
  const first = slice[0];
  const end = slice[slice.length - 1];
  const kgDiff = end.w - first.w;
  const weeks = Math.max(1, Math.round(Math.abs(end.t - first.t) / (7 * 24 * 60 * 60 * 1000)));
  const abs = Math.abs(kgDiff);
  if (abs < 0.2) {
    return `Weight looks stable over about ${weeks} week${weeks === 1 ? '' : 's'} — visuals and training quality matter most here.`;
  }
  if (kgDiff < 0) {
    if (isCompetition) {
      return `Down ${abs.toFixed(1)}kg in ${weeks} week${weeks === 1 ? '' : 's'} — on track if conditioning and performance are holding.`;
    }
    return `Down ${abs.toFixed(1)}kg in ${weeks} week${weeks === 1 ? '' : 's'} — steady progress if energy and training quality stay good.`;
  }
  if (isCompetition) {
    return `Up ${abs.toFixed(1)}kg in ${weeks} week${weeks === 1 ? '' : 's'} — review peak prep timeline and weekly targets.`;
  }
  return `Up ${abs.toFixed(1)}kg in ${weeks} week${weeks === 1 ? '' : 's'} — useful in a build phase if performance is also improving.`;
}

function UploadFormFields({
  uploadForm,
  setUploadForm,
  pendingFile,
  onPickFile,
  onSubmit,
  isPending,
  disabled,
}) {
  return (
    <div style={{ display: 'grid', gap: spacing[16] }}>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Photo file</label>
        <input type="file" accept="image/*" onChange={onPickFile} disabled={disabled || isPending} />
        {pendingFile ? (
          <p className="text-xs mt-1" style={{ color: colors.muted }}>{pendingFile.name}</p>
        ) : (
          <p className="text-xs mt-1" style={{ color: colors.muted }}>JPEG, PNG, WebP, or HEIC</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Date taken</label>
        <input
          type="date"
          value={uploadForm.date_taken}
          onChange={(e) => setUploadForm((f) => ({ ...f, date_taken: e.target.value }))}
          disabled={disabled || isPending}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Pose</label>
        <select
          value={uploadForm.tag}
          onChange={(e) => setUploadForm((f) => ({ ...f, tag: e.target.value }))}
          disabled={disabled || isPending}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {TAG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Weight that day (kg, optional)</label>
        <input
          type="number"
          step="0.1"
          value={uploadForm.weight_kg}
          onChange={(e) => setUploadForm((f) => ({ ...f, weight_kg: e.target.value }))}
          placeholder="e.g. 75.5"
          disabled={disabled || isPending}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: colors.muted }}>Notes (optional)</label>
        <textarea
          value={uploadForm.notes}
          onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          disabled={disabled || isPending}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
        />
      </div>
      <Button type="button" variant="primary" onClick={onSubmit} disabled={disabled || isPending || !pendingFile}>
        {isPending ? 'Uploading…' : 'Upload photo'}
      </Button>
    </div>
  );
}

export default function ProgressPhotos() {
  const navigate = useNavigate();
  const { id: rosterClientId } = useParams();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const { isDesktopWeb } = usePresentationMode();

  const coachRosterMode = isCoach(effectiveRole) && !!rosterClientId;

  const [uploadForm, setUploadForm] = useState({
    date_taken: new Date().toISOString().split('T')[0],
    tag: 'front',
    notes: '',
    weight_kg: '',
  });
  const [pendingFile, setPendingFile] = useState(null);
  const [mobileUploadOpen, setMobileUploadOpen] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  const { data: myClient = null, isLoading: loadingMyClient } = useQuery({
    queryKey: ['progress-photos-my-client', user?.id],
    queryFn: () => getMyClientProfile(user.id),
    enabled: Boolean(user?.id && hasSupabase && !coachRosterMode),
  });

  const { data: rosterClient = null, isLoading: loadingRosterClient } = useQuery({
    queryKey: ['progress-photos-roster-client', rosterClientId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !rosterClientId) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('id, user_id, name, full_name, trainer_id, coach_id, show_date, client_type')
        .eq('id', rosterClientId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: Boolean(coachRosterMode && rosterClientId && hasSupabase),
  });

  const effectiveClientId = coachRosterMode ? rosterClientId : myClient?.id || '';
  const coachForTracking = rosterClient?.trainer_id ?? rosterClient?.coach_id ?? myClient?.trainer_id ?? myClient?.coach_id;

  const isCompetitionContext = Boolean(
    rosterClient?.show_date || myClient?.show_date || rosterClient?.client_type === 'competition' || myClient?.client_type === 'competition'
  );

  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['progress-photos', effectiveClientId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !effectiveClientId) return [];
      return listProgressPhotos({ supabase, clientId: effectiveClientId });
    },
    enabled: Boolean(hasSupabase && effectiveClientId),
  });

  const resolvedWeightTrend = useMemo(
    () => interpretWeightTrendLine(photos, { isCompetition: isCompetitionContext }),
    [photos, isCompetitionContext]
  );

  const grouped = useMemo(() => {
    const map = {};
    for (const g of PHOTO_GROUPS) map[g.key] = [];
    for (const p of photos) {
      const t = String(p.tag || 'custom');
      const g = PHOTO_GROUPS.find((grp) => grp.match(t));
      (map[g?.key || 'custom'] || map.custom).push(p);
    }
    return PHOTO_GROUPS.map((g) => ({ ...g, items: map[g.key] || [] })).filter((g) => g.items.length > 0);
  }, [photos]);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, tag, form }) => {
      const supabase = getSupabase();
      if (!supabase || !effectiveClientId || !file) throw new Error('Missing upload context');
      const profileId = coachRosterMode ? rosterClient?.user_id : user?.id;
      if (!profileId) throw new Error('Missing profile for upload');
      const w = form.weight_kg.trim();
      const weightKg = w === '' ? null : Number(w);
      return uploadProgressPhoto({
        supabase,
        clientId: effectiveClientId,
        profileId,
        file,
        dateTaken: form.date_taken,
        tag,
        notes: form.notes || null,
        weightKg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['progress-photos', effectiveClientId] });
      queryClient.invalidateQueries({ queryKey: ['photo-comparison-photos', effectiveClientId] });
      toast.success('Photo uploaded');
      setMobileUploadOpen(false);
      setPendingFile(null);
      setUploadForm({
        date_taken: new Date().toISOString().split('T')[0],
        tag: 'front',
        notes: '',
        weight_kg: '',
      });
      if (effectiveClientId) {
        trackProgressPhotoUploaded(effectiveClientId, coachForTracking ?? undefined, { tag: variables.tag }).catch(() => {});
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Upload failed');
    },
  });

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  };

  const submitUpload = () => {
    if (!pendingFile) {
      toast.error('Choose a photo first');
      return;
    }
    uploadMutation.mutate({ file: pendingFile, tag: uploadForm.tag, form: { ...uploadForm } });
  };

  const openComparison = () => {
    if (!effectiveClientId || photos.length < 2) return;
    navigate(`/prep-comparison?clientId=${encodeURIComponent(effectiveClientId)}`);
  };

  const gridCols = isDesktopWeb ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))';
  const headerName = coachRosterMode ? (rosterClient?.full_name || rosterClient?.name || 'Client') : null;

  if (!hasSupabase) {
    return (
      <div className="min-h-screen p-4" style={{ background: colors.bg, color: colors.text }}>
        <p className="text-sm" style={{ color: colors.muted }}>Progress photos require Supabase to be configured.</p>
      </div>
    );
  }

  if (!user?.id) {
    return <PageLoader />;
  }

  if (coachRosterMode && loadingRosterClient) return <PageLoader />;
  if (!coachRosterMode && loadingMyClient) return <PageLoader />;

  if (!effectiveClientId) {
    return (
      <div className="min-h-screen p-4" style={{ background: colors.bg, color: colors.text }}>
        <EmptyState
          icon={Camera}
          title="No client profile yet"
          description="Link with a coach or finish onboarding to upload progress photos."
        />
      </div>
    );
  }

  if (coachRosterMode && !rosterClient) {
    return (
      <div className="min-h-screen p-4" style={{ background: colors.bg, color: colors.text }}>
        <EmptyState
          icon={Camera}
          title="Client not found"
          description="You may not have access to this client, or the link is invalid."
        />
      </div>
    );
  }

  const uploadDisabled =
    !effectiveClientId || uploadMutation.isPending || (coachRosterMode && !rosterClient?.user_id);
  const uploadPanel = (
    <Card style={{ padding: spacing[20], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
      <h2 className="text-base font-semibold mb-1" style={{ color: colors.text }}>Upload</h2>
      <p className="text-xs mb-4" style={{ color: colors.muted }}>Add a dated pose shot. Images are stored privately and shown via signed links.</p>
      <UploadFormFields
        uploadForm={uploadForm}
        setUploadForm={setUploadForm}
        pendingFile={pendingFile}
        onPickFile={handlePickFile}
        onSubmit={submitUpload}
        isPending={uploadMutation.isPending}
        disabled={uploadDisabled}
      />
    </Card>
  );

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      {expandedPhoto ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)', border: 'none', cursor: 'pointer' }}
          onClick={() => setExpandedPhoto(null)}
          aria-label="Close photo"
        >
          <div className="relative max-w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()} role="presentation">
            <button
              type="button"
              className="absolute -top-10 right-0 p-2 rounded-full"
              style={{ background: colors.surface2, color: colors.text }}
              onClick={() => setExpandedPhoto(null)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            {expandedPhoto.photo_url ? (
              <img src={expandedPhoto.photo_url} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            ) : null}
          </div>
        </button>
      ) : null}

      <div
        style={{
          padding: spacing[16],
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing[12],
        }}
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: colors.text }}>
            {coachRosterMode ? `Progress photos — ${headerName}` : 'Progress photos'}
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.muted }}>
            {loadingPhotos ? 'Loading…' : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
          </p>
          {resolvedWeightTrend ? (
            <p className="text-sm mt-2 max-w-xl" style={{ color: colors.text }}>{resolvedWeightTrend}</p>
          ) : photos.length >= 2 ? (
            <p className="text-sm mt-2 max-w-xl" style={{ color: colors.muted }}>
              Add weight on two or more uploads to see an interpreted trend (for example, down 2.1kg in four weeks).
            </p>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
          {photos.length >= 2 ? (
            <Button type="button" variant="secondary" onClick={openComparison}>
              <ArrowLeftRight size={16} className="mr-2 inline" style={{ verticalAlign: 'middle' }} />
              Compare
            </Button>
          ) : null}
          {!isDesktopWeb ? (
            <Button type="button" variant="primary" onClick={() => setMobileUploadOpen(true)}>
              <Camera size={16} className="mr-2 inline" style={{ verticalAlign: 'middle' }} />
              Upload
            </Button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: isDesktopWeb ? 'grid' : 'block',
          gridTemplateColumns: isDesktopWeb ? 'minmax(0, 1fr) 320px' : undefined,
          gap: spacing[20],
          padding: spacing[16],
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {photos.length === 0 && !loadingPhotos ? (
            <EmptyState
              icon={Camera}
              title="No progress photos yet"
              description="Upload weekly photos to track your transformation visually."
              action={
                isDesktopWeb ? null : (
                  <Button type="button" variant="primary" onClick={() => setMobileUploadOpen(true)}>
                    <Camera size={16} className="mr-2 inline" style={{ verticalAlign: 'middle' }} />
                    Upload first photo
                  </Button>
                )
              }
            />
          ) : null}

          {loadingPhotos ? (
            <p className="text-sm" style={{ color: colors.muted }}>Loading photos…</p>
          ) : null}

          {!loadingPhotos && photos.length > 0 ? (
            <div style={{ display: 'grid', gap: spacing[24] }}>
              {grouped.map((group) => (
                <section key={group.key}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>{group.title}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: spacing[12] }}>
                    {group.items.map((photo) => (
                      <button
                        type="button"
                        key={photo.id}
                        onClick={() => setExpandedPhoto(photo)}
                        className="relative text-left rounded-xl overflow-hidden"
                        style={{
                          aspectRatio: '1',
                          border: `2px solid ${colors.border}`,
                          padding: 0,
                          background: colors.surface1,
                        }}
                      >
                        {photo.photo_url ? (
                          <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ background: colors.surface2 }} />
                        )}
                        <span
                          className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-md"
                          style={badgeStyle(photo.tag)}
                        >
                          {badgeLabel(photo.tag)}
                        </span>
                        <div
                          className="absolute bottom-0 left-0 right-0 p-2"
                          style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                          }}
                        >
                          <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#fff' }}>
                            <Calendar size={12} />
                            {photo.date_taken
                              ? new Date(photo.date_taken).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
                          </p>
                          {photo.weight_kg != null ? (
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{Number(photo.weight_kg).toFixed(1)} kg</p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>

        {isDesktopWeb ? (
          <aside style={{ position: 'sticky', top: spacing[16] }}>{uploadPanel}</aside>
        ) : null}
      </div>

      {!isDesktopWeb && mobileUploadOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-40 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileUploadOpen(false)}
        >
          <div
            className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl p-4"
            style={{ background: colors.card, borderTop: `1px solid ${colors.border}` }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Upload photo</h2>
              <button type="button" className="p-2 rounded-md" style={{ color: colors.muted }} onClick={() => setMobileUploadOpen(false)} aria-label="Close">
                <X size={22} />
              </button>
            </div>
            <UploadFormFields
              uploadForm={uploadForm}
              setUploadForm={setUploadForm}
              pendingFile={pendingFile}
              onPickFile={handlePickFile}
              onSubmit={submitUpload}
              isPending={uploadMutation.isPending}
              disabled={uploadDisabled}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
