import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClientByUserId } from '@/data/selectors';
import { addMedia } from '@/lib/repos/compPrepRepo';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { getAllPoses } from '@/lib/repos/poseLibraryRepo';
import { impactLight, notificationSuccess } from '@/lib/haptics';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const CATEGORIES = [
  { value: 'posing', label: 'Posing' },
  { value: 'progress', label: 'Progress' },
  { value: 'checkin', label: 'Check-in' },
];

export default function CompMediaUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poseIdFromQuery = searchParams.get('poseId') || '';
  const { role, user } = useAuth();

  const clientId = useMemo(() => {
    if (role === 'client' && user?.id) {
      const c = getClientByUserId(user.id);
      return c?.id ?? null;
    }
    if (role === 'solo' && user?.id) return `solo-${user.id}`;
    return null;
  }, [role, user?.id]);

  const profile = useMemo(() => (clientId ? getClientCompProfile(clientId) : null), [clientId]);
  const allPoses = useMemo(() => getAllPoses(), []);
  const posesForDivision = useMemo(() => {
    if (!profile?.division) return allPoses;
    return allPoses.filter((p) => p.divisions.includes(profile.division));
  }, [allPoses, profile?.division]);

  const [mediaType, setMediaType] = useState('photo');
  const [category, setCategory] = useState('posing');
  const [poseId, setPoseId] = useState(poseIdFromQuery);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!clientId) return;
    impactLight();
    setSubmitting(true);
    const uri =
      mediaType === 'photo'
        ? 'https://placehold.co/400x600/1e293b/94a3b8?text=Photo'
        : 'https://placehold.co/400x600/1e293b/94a3b8?text=Video';
    addMedia({
      clientId,
      mediaType,
      category,
      poseId: poseId || undefined,
      uri,
      notes: notes || undefined,
    });
    setSubmitting(false);
    notificationSuccess();
    navigate('/comp-prep/media');
  };

  if (!clientId) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Sign in as client or solo to upload media.</p>
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
      <h1 className="text-lg font-semibold mb-4">Upload media</h1>

      <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Type
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Pose (optional)
            </label>
            <select
              value={poseId}
              onChange={(e) => setPoseId(e.target.value)}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            >
              <option value="">—</option>
              {posesForDivision.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Week, round, etc."
              rows={2}
              className="w-full rounded-lg border bg-slate-800 text-white text-sm placeholder-slate-500"
              style={{ padding: '10px 12px', borderColor: colors.border }}
            />
          </div>
        </div>
      </Card>

      <p className="text-xs mb-4" style={{ color: colors.muted }}>
        File upload is simulated. In production this would use Supabase storage and attach the URI.
      </p>

      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
