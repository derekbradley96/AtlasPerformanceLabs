/**
 * Personal users: discover listed coaches (marketplace_coach_profiles), filter by focus/specialty/division/price, open profile, send inquiry.
 * Uses marketplace_coach_profiles, marketplace_coach_media, coach_inquiries; storage signed URLs for images.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { Users, X, ChevronRight } from 'lucide-react';

const STORAGE_BUCKET = 'marketplace_coach_media';
const COACHING_FOCUS_OPTIONS = [
  { value: 'transformation', label: 'Transformation' },
  { value: 'competition', label: 'Competition' },
  { value: 'integrated', label: 'Integrated' },
];
const PRICE_BANDS = [
  { key: '', label: 'Any' },
  { key: '0-100', label: 'Under $100', min: 0, max: 100 },
  { key: '100-200', label: '$100–200', min: 100, max: 200 },
  { key: '200+', label: '$200+', min: 200, max: null },
];

function formatPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
}

export default function CoachDiscoveryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const [focusFilter, setFocusFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['marketplace-listed-profiles'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('marketplace_coach_profiles')
        .select('*')
        .eq('is_listed', true)
        .order('updated_at', { ascending: false });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase,
  });

  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);

  const { data: mediaByProfileId = {} } = useQuery({
    queryKey: ['marketplace-media-first', profileIds],
    queryFn: async () => {
      if (!supabase || profileIds.length === 0) return {};
      const { data, error } = await supabase
        .from('marketplace_coach_media')
        .select('marketplace_profile_id, media_path, sort_order')
        .in('marketplace_profile_id', profileIds)
        .eq('media_type', 'image')
        .order('sort_order', { ascending: true });
      if (error) return {};
      const byProfile = {};
      (data || []).forEach((row) => {
        if (!byProfile[row.marketplace_profile_id]) byProfile[row.marketplace_profile_id] = row.media_path;
      });
      return byProfile;
    },
    enabled: !!supabase && profileIds.length > 0,
  });

  const [imageUrls, setImageUrls] = useState({});
  useEffect(() => {
    if (!supabase || Object.keys(mediaByProfileId).length === 0) return;
    const paths = Object.values(mediaByProfileId);
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        paths.map(async (path) => {
          try {
            const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600);
            if (!cancelled && data?.signedUrl) {
              const profileId = Object.keys(mediaByProfileId).find((id) => mediaByProfileId[id] === path);
              if (profileId) next[profileId] = data.signedUrl;
            }
          } catch (_) {}
        })
      );
      if (!cancelled) setImageUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [supabase, mediaByProfileId]);

  const filterOptions = useMemo(() => {
    const specialties = new Set();
    const divisions = new Set();
    profiles.forEach((p) => {
      (p.specialties || []).forEach((s) => s && specialties.add(s));
      (p.divisions || []).forEach((d) => d && divisions.add(d));
    });
    return {
      specialties: [...specialties].sort(),
      divisions: [...divisions].sort(),
    };
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (focusFilter && (!p.coaching_focus || !p.coaching_focus.includes(focusFilter))) return false;
      if (specialtyFilter && (!p.specialties || !p.specialties.includes(specialtyFilter))) return false;
      if (divisionFilter && (!p.divisions || !p.divisions.includes(divisionFilter))) return false;
      if (priceBand) {
        const band = PRICE_BANDS.find((b) => b.key === priceBand);
        if (band && band.key !== '') {
          const price = p.monthly_price_from != null ? Number(p.monthly_price_from) : null;
          if (price == null) return false;
          if (band.max != null && (price < band.min || price >= band.max)) return false;
          if (band.max == null && price < band.min) return false;
        }
      }
      return true;
    });
  }, [profiles, focusFilter, specialtyFilter, divisionFilter, priceBand]);

  const handleSendInquiry = async () => {
    if (!selectedProfile || !user?.id || !supabase || sendingInquiry) return;
    setSendingInquiry(true);
    try {
      const { error } = await supabase.from('coach_inquiries').insert({
        coach_id: selectedProfile.coach_id,
        user_profile_id: user.id,
        status: 'new',
        message: inquiryMessage.trim() || null,
      });
      if (error) throw error;
      toast.success('Inquiry sent');
      setInquiryMessage('');
      setSelectedProfile(null);
    } catch (err) {
      toast.error('Could not send inquiry');
    } finally {
      setSendingInquiry(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Find a coach" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in to discover coaches.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 100 }}>
      <TopBar title="Find a coach" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 600, margin: '0 auto' }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Browse listed coaches and send an inquiry to get started.
        </p>

        {/* Filters */}
        <Card style={{ marginBottom: spacing[16], padding: spacing[12], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Coaching focus</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COACHING_FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFocusFilter((f) => (f === opt.value ? '' : opt.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: radii.pill,
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${focusFilter === opt.value ? colors.primary : colors.border}`,
                  background: focusFilter === opt.value ? colors.primarySubtle : 'transparent',
                  color: colors.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {filterOptions.specialties.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Specialty</p>
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="rounded-lg border bg-black/20 text-white"
                style={{ padding: '8px 12px', borderColor: colors.border, marginBottom: spacing[12], minWidth: 160 }}
              >
                <option value="">Any</option>
                {filterOptions.specialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}
          {filterOptions.divisions.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Division</p>
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="rounded-lg border bg-black/20 text-white"
                style={{ padding: '8px 12px', borderColor: colors.border, marginBottom: spacing[12], minWidth: 160 }}
              >
                <option value="">Any</option>
                {filterOptions.divisions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Price</p>
          <div className="flex flex-wrap gap-2">
            {PRICE_BANDS.map((b) => (
              <button
                key={b.key || 'any'}
                type="button"
                onClick={() => setPriceBand(b.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: radii.pill,
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${priceBand === b.key ? colors.primary : colors.border}`,
                  background: priceBand === b.key ? colors.primarySubtle : 'transparent',
                  color: colors.text,
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
            <p style={{ color: colors.muted }}>Loading…</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <EmptyState
            icon={Users}
            title={profiles.length === 0 ? 'No coaches listed yet' : 'No coaches match your filters'}
            description={profiles.length === 0 ? 'Check back later for coaches in your area.' : 'Try changing filters.'}
          />
        ) : (
          <div className="space-y-3">
            {filteredProfiles.map((profile) => (
              <Card
                key={profile.id}
                style={{
                  padding: 0,
                  border: `1px solid ${shell.cardBorder}`,
                  borderRadius: shell.cardRadius,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedProfile(profile)}
              >
                <div className="flex gap-4 p-4">
                  <div
                    className="rounded-xl flex-shrink-0 overflow-hidden"
                    style={{ width: 72, height: 72, background: colors.surface2 }}
                  >
                    {imageUrls[profile.id] ? (
                      <img src={imageUrls[profile.id]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: colors.muted }}>
                        <Users size={28} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: colors.text }}>{profile.display_name}</p>
                    {profile.headline && (
                      <p className="text-sm truncate mt-0.5" style={{ color: colors.muted }}>{profile.headline}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(profile.specialties || []).slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: colors.surface2, color: colors.muted }}
                        >
                          {s}
                        </span>
                      ))}
                      {(profile.coaching_focus || []).slice(0, 2).map((c) => (
                        <span
                          key={c}
                          className="text-xs px-2 py-0.5 rounded capitalize"
                          style={{ background: colors.primarySubtle, color: colors.primary }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    {profile.monthly_price_from != null && (
                      <p className="text-xs mt-1" style={{ color: colors.muted }}>
                        From {formatPrice(profile.monthly_price_from)}/mo
                      </p>
                    )}
                  </div>
                  <ChevronRight size={20} style={{ color: colors.muted, flexShrink: 0 }} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Profile detail / inquiry panel */}
      {selectedProfile && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: colors.overlay }}
          onClick={() => setSelectedProfile(null)}
        >
          <div
            className="ml-auto w-full max-w-md flex flex-col flex-1 max-h-full overflow-hidden"
            style={{ background: colors.bg, boxShadow: '-4px 0 24px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: shell.cardBorder }}>
              <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Coach profile</h2>
              <button type="button" onClick={() => setSelectedProfile(null)} style={{ color: colors.muted }} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex gap-4 mb-4">
                <div
                  className="rounded-xl flex-shrink-0 overflow-hidden"
                  style={{ width: 80, height: 80, background: colors.surface2 }}
                >
                  {imageUrls[selectedProfile.id] ? (
                    <img src={imageUrls[selectedProfile.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: colors.muted }}>
                      <Users size={36} />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg" style={{ color: colors.text }}>{selectedProfile.display_name}</p>
                  {selectedProfile.headline && (
                    <p className="text-sm mt-1" style={{ color: colors.muted }}>{selectedProfile.headline}</p>
                  )}
                  {selectedProfile.monthly_price_from != null && (
                    <p className="text-sm mt-1" style={{ color: colors.primary }}>{formatPrice(selectedProfile.monthly_price_from)}/mo from</p>
                  )}
                </div>
              </div>
              {(selectedProfile.specialties?.length || selectedProfile.divisions?.length || selectedProfile.coaching_focus?.length) > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(selectedProfile.specialties || []).map((s) => (
                    <span key={s} className="text-xs px-2 py-1 rounded" style={{ background: colors.surface2, color: colors.text }}>{s}</span>
                  ))}
                  {(selectedProfile.divisions || []).map((d) => (
                    <span key={d} className="text-xs px-2 py-1 rounded" style={{ background: colors.surface2, color: colors.text }}>{d}</span>
                  ))}
                  {(selectedProfile.coaching_focus || []).map((c) => (
                    <span key={c} className="text-xs px-2 py-1 rounded capitalize" style={{ background: colors.primarySubtle, color: colors.primary }}>{c}</span>
                  ))}
                </div>
              )}
              {selectedProfile.bio && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>About</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }}>{selectedProfile.bio}</p>
                </div>
              )}
              <div className="pt-4 border-t" style={{ borderColor: shell.cardBorder }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Send an inquiry</p>
                <textarea
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="Introduce yourself and what you're looking for…"
                  rows={3}
                  className="w-full rounded-xl border bg-black/20 text-white placeholder:text-gray-500"
                  style={{ padding: 12, borderColor: colors.border, marginBottom: spacing[12] }}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={sendingInquiry}
                  onClick={handleSendInquiry}
                >
                  {sendingInquiry ? 'Sending…' : 'Send inquiry'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
