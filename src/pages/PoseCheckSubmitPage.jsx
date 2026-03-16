/**
 * Client/personal pose check submission. One per week (Monday week_start).
 * Reuses getMyClientId + getWeekStartISO from checkins pattern.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getMyClientId } from '@/lib/checkins';
import {
  getWeekStartISO,
  getPoseCheckForWeek,
  insertPoseCheck,
  uploadPoseCheckPhoto,
  updatePoseCheckPhotos,
} from '@/lib/poseChecks';
import { trackPoseCheckSubmitted, trackProgressPhotoUploaded } from '@/services/engagementTracker';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { ImagePlus } from 'lucide-react';

function isClientOrPersonal(role) {
  const r = (role ?? '').toString().toLowerCase();
  return r === 'client' || r === 'solo' || r === 'personal';
}

export default function PoseCheckSubmitPage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [weekStart, setWeekStart] = useState('');
  const [existing, setExisting] = useState(null);
  const [clientNotes, setClientNotes] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = getWeekStartISO();
      setWeekStart(w);
      const cid = await getMyClientId();
      if (cancelled) return;
      setClientId(cid);
      if (cid) {
        const ex = await getPoseCheckForWeek(cid, w);
        if (!cancelled) setExisting(ex);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientId || existing || submitting) return;
    setSubmitting(true);
    try {
      const row = await insertPoseCheck({
        client_id: clientId,
        week_start: weekStart,
        client_notes: clientNotes.trim() || null,
      });
      if (!row?.id) {
        toast.error('Failed to submit pose check');
        return;
      }
      const paths = [];
      for (const file of photoFiles) {
        const path = await uploadPoseCheckPhoto({
          clientId,
          poseCheckId: row.id,
          file,
        });
        if (path) paths.push(path);
      }
      if (paths.length > 0) await updatePoseCheckPhotos(row.id, paths);
      toast.success('Pose check submitted');
      setExisting({ ...row, client_notes: clientNotes.trim() || null, photos: paths });
      setPhotoFiles([]);
      setClientNotes('');
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
    } catch (err) {
      toast.error('Failed to submit pose check');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose check" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!isClientOrPersonal(role)) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose check" onBack={() => navigate(-1)} />
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
        <TopBar title="Pose check" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.muted, marginBottom: spacing[16] }}>
            Link your account to a coach to submit pose checks.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose check" onBack={() => navigate(-1)} />
        <div className="p-6">
          <p className="font-semibold mb-2" style={{ color: colors.text }}>Submitted</p>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            You’ve already submitted a pose check for the week of {weekStart}.
          </p>
          {existing.client_notes && (
            <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
              <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>Your notes</p>
              <p className="text-sm" style={{ color: colors.text }}>{existing.client_notes}</p>
            </Card>
          )}
          {existing.photos?.length > 0 && (
            <p className="text-sm" style={{ color: colors.muted }}>{existing.photos.length} photo(s) uploaded.</p>
          )}
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Pose check" onBack={() => navigate(-1)} />
      <form onSubmit={handleSubmit} className="p-4 pb-8" style={{ paddingBottom: spacing[32] }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Week of {weekStart}
        </p>

        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes (optional)</label>
          <textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            placeholder="How you're feeling, condition, etc."
            rows={3}
            className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
            style={{ padding: 10, borderColor: colors.border }}
          />
        </Card>

        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Photos</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoChange}
            className="sr-only"
            id="pose-check-photos"
          />
          <label
            htmlFor="pose-check-photos"
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer py-4"
            style={{ borderColor: colors.border, color: colors.muted }}
          >
            <ImagePlus size={20} />
            <span>{photoFiles.length > 0 ? `${photoFiles.length} selected` : 'Select images'}</span>
          </label>
        </Card>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full"
          style={{ minHeight: 48 }}
        >
          {submitting ? 'Submitting…' : 'Submit pose check'}
        </Button>
      </form>
    </div>
  );
}
