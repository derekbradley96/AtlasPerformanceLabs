/**
 * Coach discovery marketplace: coach cards with name, focus, description, pricing, Apply button.
 * Uses marketplace_coach_profiles (is_listed), coach_inquiries for apply.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import { CoachDiscoverySkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { colors, spacing, shell } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { Users, X } from 'lucide-react';

const STORAGE_BUCKET = 'marketplace_coach_media';

function formatPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
}

function CoachCard({ profile, imageUrl, onApply }) {
  if (!profile) return null;
  const focusLabel = (profile.coaching_focus && profile.coaching_focus[0])
    ? String(profile.coaching_focus[0]).replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const description = profile.headline || profile.bio || null;

  return (
    <Card
      style={{
        padding: spacing[16],
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[12],
      }}
    >
      <div className="flex gap-4">
        <div
          className="rounded-xl flex-shrink-0 overflow-hidden"
          style={{ width: 64, height: 64, background: colors.surface2 }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ color: colors.muted }}>
              <Users size={28} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold" style={{ color: colors.text }}>{profile.display_name ?? 'Coach'}</p>
          {focusLabel && (
            <p className="text-sm mt-0.5" style={{ color: colors.primary }}>{focusLabel}</p>
          )}
        </div>
      </div>
      {description && (
        <p className="text-sm line-clamp-3" style={{ color: colors.muted }}>
          {description}
        </p>
      )}
      {profile.monthly_price_from != null && (
        <p className="text-sm font-medium" style={{ color: colors.text }}>
          {formatPrice(profile.monthly_price_from)}/mo
        </p>
      )}
      <Button
        variant="primary"
        className="w-full"
        onClick={() => onApply(profile)}
      >
        Apply
      </Button>
    </Card>
  );
}

export default function CoachMarketplacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  const { data: profiles = [], isLoading, isError: profilesError, refetch: refetchProfiles } = useQuery({
    queryKey: ['marketplace-listed-profiles'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('marketplace_coach_profiles')
        .select('*')
        .eq('is_listed', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
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
      toast.success('Application sent');
      setInquiryMessage('');
      setSelectedProfile(null);
    } catch (err) {
      toast.error('Could not send application');
    } finally {
      setSendingInquiry(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Coach marketplace" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in to browse coaches and apply.</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => navigate('/auth')}
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (profilesError) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 100 }}>
        <TopBar title="Coach marketplace" onBack={() => navigate(-1)} />
        <div style={{ padding: spacing[16], maxWidth: 800, margin: '0 auto' }}>
          <LoadErrorFallback
            title="Couldn't load coaches"
            description="Check your connection and try again."
            onRetry={() => refetchProfiles()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 100 }}>
      <TopBar title="Coach marketplace" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 800, margin: '0 auto' }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Browse coaches and apply to work with one that fits your goals.
        </p>

        {isLoading ? (
          <CoachDiscoverySkeleton />
        ) : (Array.isArray(profiles) ? profiles : []).length === 0 ? (
          <EmptyState
            icon={Users}
            title="No coaches listed yet"
            description="Check back later for coaches on the marketplace."
          />
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {(Array.isArray(profiles) ? profiles : []).map((profile, idx) => (
              <CoachCard
                key={profile?.id ?? profile?.coach_id ?? `profile-${idx}`}
                profile={profile}
                imageUrl={profile ? imageUrls[profile.id] : null}
                onApply={setSelectedProfile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Apply modal */}
      {selectedProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: colors.overlay }}
          onClick={() => setSelectedProfile(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border flex flex-col max-h-[90vh] overflow-hidden"
            style={{ background: colors.surface, borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
              <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
                Apply to {selectedProfile?.display_name ?? 'Coach'}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                style={{ color: colors.muted }}
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Message (optional)
              </p>
              <textarea
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Introduce yourself and what you're looking for…"
                rows={3}
                className="w-full rounded-xl border text-white placeholder:text-gray-500"
                style={{
                  padding: 12,
                  borderColor: colors.border,
                  background: colors.bg,
                  marginBottom: spacing[12],
                }}
              />
              <Button
                variant="primary"
                className="w-full"
                disabled={sendingInquiry}
                onClick={handleSendInquiry}
              >
                {sendingInquiry ? 'Sending…' : 'Send application'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
