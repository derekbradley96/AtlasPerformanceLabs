/**
 * Coach: create and manage marketplace listing (display name, headline, bio, specialties,
 * divisions, coaching focus, price, listed toggle, profile images).
 * Uses marketplace_coach_profiles, marketplace_coach_media, storage bucket marketplace_coach_media.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { ImagePlus, Trash2 } from 'lucide-react';

const STORAGE_BUCKET = 'marketplace_coach_media';
const COACHING_FOCUS_OPTIONS = [
  { value: 'transformation', label: 'Transformation' },
  { value: 'competition', label: 'Competition' },
  { value: 'integrated', label: 'Integrated' },
];

function arrayFromText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function textFromArray(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

export default function CoachMarketplaceProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [media, setMedia] = useState([]);
  const [mediaUrls, setMediaUrls] = useState({});

  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [specialtiesText, setSpecialtiesText] = useState('');
  const [divisionsText, setDivisionsText] = useState('');
  const [coachingFocus, setCoachingFocus] = useState([]);
  const [monthlyPriceFrom, setMonthlyPriceFrom] = useState('');
  const [isListed, setIsListed] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!supabase || !coachId) return null;
    const { data, error } = await supabase
      .from('marketplace_coach_profiles')
      .select('*')
      .eq('coach_id', coachId)
      .maybeSingle();
    if (error) return null;
    return data;
  }, [supabase, coachId]);

  const loadMedia = useCallback(
    async (profileId) => {
      if (!supabase || !profileId) return [];
      const { data, error } = await supabase
        .from('marketplace_coach_media')
        .select('*')
        .eq('marketplace_profile_id', profileId)
        .order('sort_order', { ascending: true });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coachId || !supabase) {
        setLoading(false);
        return;
      }
      const p = await loadProfile();
      if (cancelled) return;
      setProfile(p);
      if (p) {
        setDisplayName(p.display_name ?? '');
        setHeadline(p.headline ?? '');
        setBio(p.bio ?? '');
        setSpecialtiesText(textFromArray(p.specialties));
        setDivisionsText(textFromArray(p.divisions));
        setCoachingFocus(Array.isArray(p.coaching_focus) ? [...p.coaching_focus] : []);
        setMonthlyPriceFrom(p.monthly_price_from != null ? String(p.monthly_price_from) : '');
        setIsListed(!!p.is_listed);
        const m = await loadMedia(p.id);
        if (!cancelled) setMedia(m);
      } else {
        setDisplayName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [coachId, supabase, user, loadProfile, loadMedia]);

  useEffect(() => {
    if (media.length === 0) return;
    const bucket = supabase?.storage?.from(STORAGE_BUCKET);
    if (!bucket) return;
    let cancelled = false;
    (async () => {
      const byId = {};
      for (const m of media.filter((x) => x.media_path)) {
        try {
          const { data } = await bucket.createSignedUrl(m.media_path, 3600);
          if (!cancelled && data?.signedUrl) byId[m.id] = data.signedUrl;
        } catch (_) {}
      }
      if (!cancelled) setMediaUrls((prev) => ({ ...prev, ...byId }));
    })();
    return () => { cancelled = true; };
  }, [media, supabase]);

  const toggleFocus = (value) => {
    setCoachingFocus((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!coachId || !supabase || saving) return;
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        coach_id: coachId,
        display_name: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        specialties: arrayFromText(specialtiesText),
        divisions: arrayFromText(divisionsText),
        coaching_focus: coachingFocus,
        monthly_price_from: monthlyPriceFrom.trim() ? parseFloat(monthlyPriceFrom) : null,
        is_listed: isListed,
      };
      if (profile?.id) {
        const { coach_id: _, ...updatePayload } = payload;
        const { error } = await supabase
          .from('marketplace_coach_profiles')
          .update(updatePayload)
          .eq('id', profile.id);
        if (error) throw error;
        setProfile((p) => (p ? { ...p, ...payload } : p));
        toast.success('Profile updated');
      } else {
        const { data, error } = await supabase
          .from('marketplace_coach_profiles')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setProfile(data);
        toast.success('Profile created');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !profile?.id || !supabase || uploading) return;
    setUploading(true);
    try {
      const ext = (file.name || '').split('.').pop() || 'jpg';
      const path = `${coachId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const nextOrder = media.length > 0 ? Math.max(...media.map((m) => m.sort_order), 0) + 1 : 0;
      const { data: row, error: insertError } = await supabase
        .from('marketplace_coach_media')
        .insert({
          marketplace_profile_id: profile.id,
          media_type: 'image',
          media_path: path,
          sort_order: nextOrder,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setMedia((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order));
      toast.success('Image added');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = async (mediaId) => {
    if (!supabase || !mediaId) return;
    const row = media.find((m) => m.id === mediaId);
    if (!row) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([row.media_path]);
      await supabase.from('marketplace_coach_media').delete().eq('id', mediaId);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setMediaUrls((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
      toast.success('Image removed');
    } catch (err) {
      toast.error('Could not remove image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Marketplace profile" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Marketplace profile" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 560, margin: '0 auto' }}>
        <p className="text-sm mb-6" style={{ color: colors.muted }}>
          Control how you appear in coach discovery. Turn “Listed” on when you’re ready to be found.
        </p>

        <form onSubmit={handleSave}>
          <Card style={{ marginBottom: spacing[16], padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. NPC competitor & transformation coach"
              className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell clients what you offer and your experience…"
              rows={4}
              className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Specialties (comma-separated)</label>
            <input
              type="text"
              value={specialtiesText}
              onChange={(e) => setSpecialtiesText(e.target.value)}
              placeholder="e.g. Fat loss, Muscle building, Contest prep"
              className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Divisions coached (comma-separated)</label>
            <input
              type="text"
              value={divisionsText}
              onChange={(e) => setDivisionsText(e.target.value)}
              placeholder="e.g. Men's Physique, Bikini, Figure"
              className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[16] }}
            />

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Coaching focus</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {COACHING_FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleFocus(opt.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: radii.pill,
                    fontSize: 13,
                    fontWeight: 500,
                    border: `1px solid ${coachingFocus.includes(opt.value) ? colors.primary : colors.border}`,
                    background: coachingFocus.includes(opt.value) ? colors.primarySubtle : 'transparent',
                    color: colors.text,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Monthly price from (USD)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={monthlyPriceFrom}
              onChange={(e) => setMonthlyPriceFrom(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[16], maxWidth: 140 }}
            />

            <div className="flex items-center justify-between" style={{ marginBottom: spacing[8] }}>
              <span className="text-sm font-medium" style={{ color: colors.text }}>Listed on marketplace</span>
              <button
                type="button"
                role="switch"
                aria-checked={isListed}
                onClick={() => setIsListed((v) => !v)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: isListed ? colors.primary : colors.surface2,
                  border: 'none',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: isListed ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
            <p className="text-xs" style={{ color: colors.muted }}>When on, your profile can be discovered by personal users.</p>
          </Card>

          {profile?.id && (
            <Card style={{ marginBottom: spacing[16], padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>Profile images</p>
              <div className="flex flex-wrap gap-3 mb-3">
                {media.map((m) => (
                  <div key={m.id} className="relative group">
                    <div
                      className="rounded-xl overflow-hidden flex-shrink-0"
                      style={{ width: 100, height: 100, background: colors.surface2 }}
                    >
                      {mediaUrls[m.id] ? (
                        <img src={mediaUrls[m.id]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: colors.muted }}>…</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(m.id)}
                      className="absolute top-1 right-1 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      aria-label="Remove image"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <label
                  className="rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer flex-shrink-0"
                  style={{ width: 100, height: 100, borderColor: colors.border, color: colors.muted }}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadImage}
                    disabled={uploading}
                    className="sr-only"
                  />
                  {uploading ? <span className="text-xs">…</span> : <ImagePlus size={24} />}
                </label>
              </div>
              <p className="text-xs" style={{ color: colors.muted }}>Add images for your marketplace card. Save your profile first if you don’t see the upload area.</p>
            </Card>
          )}

          <Button type="submit" variant="primary" disabled={saving} onClick={handleSave} className="w-full">
            {saving ? 'Saving…' : profile ? 'Update profile' : 'Create profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}
