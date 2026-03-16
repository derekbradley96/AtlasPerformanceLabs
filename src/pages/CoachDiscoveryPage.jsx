/**
 * Coach discovery marketplace: list public coaches from coach_marketplace_profiles + profiles.
 * Filter by coach type, accepts transformation/competition, location, pricing band.
 * Cards: name, headline, coach type, short bio, CTA View Profile → /coach/:slug (referral_code).
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { CoachDiscoverySkeleton } from '@/components/ui/LoadingState';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { isPersonal } from '@/lib/roles';
import { trackPersonalOpenedFindACoach } from '@/services/analyticsService';
import { Users, ChevronRight, MapPin } from 'lucide-react';

const COACH_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'competition', label: 'Competition' },
  { value: 'integrated', label: 'Integrated' },
];

const PRICE_BANDS = [
  { key: '', label: 'Any' },
  { key: 'has_pricing', label: 'Shows pricing' },
  { key: 'contact', label: 'Contact for pricing' },
];

function getCoachTypeLabel(value) {
  return COACH_TYPE_OPTIONS.find((o) => o.value === value)?.label || value || 'Coach';
}

/** Short bio: first ~120 chars, no mid-word cut */
function shortBio(bio, maxLen = 120) {
  if (!bio || typeof bio !== 'string') return '';
  const t = bio.trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > 0 ? slice.slice(0, lastSpace) + '…' : slice + '…';
}

async function fetchDiscoveryCoaches(supabase) {
  if (!supabase) return { list: [], locations: [] };
  const { data: rows, error } = await supabase
    .from('coach_marketplace_profiles')
    .select('id, coach_id, display_name, slug, headline, bio, location, pricing_summary, accepts_transformation, accepts_competition, is_public')
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) return { list: [], locations: [] };
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return { list: [], locations: [] };

  const coachIds = [...new Set(list.map((r) => r.coach_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, coach_focus, referral_code')
    .in('id', coachIds);

  const profileMap = new Map();
  (profiles || []).forEach((p) => profileMap.set(p.id, p));

  const merged = list.map((row) => ({
    ...row,
    coach_focus: profileMap.get(row.coach_id)?.coach_focus ?? null,
    referral_code: profileMap.get(row.coach_id)?.referral_code ?? null,
  }));

  const locations = [...new Set(merged.map((r) => r.location).filter(Boolean))].sort();

  return { list: merged, locations };
}

export default function CoachDiscoveryPage() {
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const trackedFindACoach = useRef(false);

  useEffect(() => {
    if (!user?.id || !isPersonal(effectiveRole) || trackedFindACoach.current) return;
    trackedFindACoach.current = true;
    trackPersonalOpenedFindACoach().catch(() => {});
  }, [user?.id, effectiveRole]);

  const [coachType, setCoachType] = useState('');
  const [acceptsCompetition, setAcceptsCompetition] = useState(null);
  const [acceptsTransformation, setAcceptsTransformation] = useState(null);
  const [locationFilter, setLocationFilter] = useState('');
  const [priceBand, setPriceBand] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['coach-discovery-marketplace'],
    queryFn: () => fetchDiscoveryCoaches(supabase),
    enabled: !!supabase,
  });

  const { list: profiles = [], locations = [] } = data ?? { list: [], locations: [] };

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (coachType && (p.coach_focus || '').toLowerCase() !== coachType) return false;
      if (acceptsCompetition === true && !p.accepts_competition) return false;
      if (acceptsTransformation === true && !p.accepts_transformation) return false;
      if (locationFilter && (p.location || '').toLowerCase() !== locationFilter.toLowerCase()) return false;
      if (priceBand === 'has_pricing' && !(p.pricing_summary && p.pricing_summary.trim())) return false;
      if (priceBand === 'contact' && (p.pricing_summary && p.pricing_summary.trim())) return false;
      return true;
    });
  }, [profiles, coachType, acceptsCompetition, acceptsTransformation, locationFilter, priceBand]);

  const profileSlug = (p) => p.slug?.trim() || '';
  const hasMarketplaceSlug = (p) => !!p.slug?.trim();

  const handleViewProfile = (p) => {
    if (hasMarketplaceSlug(p)) {
      navigate(`/marketplace/coach/${encodeURIComponent(p.slug.trim())}`);
    } else if (p.referral_code?.trim()) {
      navigate(`/coach/${encodeURIComponent(p.referral_code.trim())}`);
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
          Browse coaches and view their profiles to get started.
        </p>

        {/* Filters */}
        <Card
          style={{
            marginBottom: spacing[16],
            padding: spacing[12],
            border: `1px solid ${shell.cardBorder}`,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Coach type
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COACH_TYPE_OPTIONS.filter((o) => o.value !== '').map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCoachType((v) => (v === opt.value ? '' : opt.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: radii.pill,
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${coachType === opt.value ? colors.primary : colors.border}`,
                  background: coachType === opt.value ? colors.primarySubtle : 'transparent',
                  color: colors.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Accepts clients
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setAcceptsTransformation(acceptsTransformation === true ? null : true)}
              style={{
                padding: '6px 12px',
                borderRadius: radii.pill,
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${acceptsTransformation === true ? colors.primary : colors.border}`,
                background: acceptsTransformation === true ? colors.primarySubtle : 'transparent',
                color: colors.text,
              }}
            >
              Transformation
            </button>
            <button
              type="button"
              onClick={() => setAcceptsCompetition(acceptsCompetition === true ? null : true)}
              style={{
                padding: '6px 12px',
                borderRadius: radii.pill,
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${acceptsCompetition === true ? colors.primary : colors.border}`,
                background: acceptsCompetition === true ? colors.primarySubtle : 'transparent',
                color: colors.text,
              }}
            >
              Competition
            </button>
          </div>

          {locations.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Location
              </p>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="rounded-lg border"
                style={{
                  padding: '8px 12px',
                  borderColor: colors.border,
                  marginBottom: spacing[12],
                  minWidth: 160,
                  background: colors.surface2,
                  color: colors.text,
                }}
              >
                <option value="">Any</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </>
          )}

          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Pricing
          </p>
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
          <CoachDiscoverySkeleton />
        ) : filteredProfiles.length === 0 ? (
          <EmptyState
            icon={Users}
            title={profiles.length === 0 ? 'No coaches found' : 'No coaches match your filters'}
            description={
              profiles.length === 0
                ? 'No coaches have listed themselves in discovery yet. Check back later.'
                : 'Try different filters or clear them to see all listed coaches.'
            }
            actionLabel={profiles.length > 0 ? 'Clear filters' : undefined}
            onAction={
              profiles.length > 0
                ? () => {
                    setCoachType('');
                    setAcceptsCompetition(null);
                    setAcceptsTransformation(null);
                    setLocationFilter('');
                    setPriceBand('');
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredProfiles.map((profile) => (
              <Card
                key={profile.id}
                style={{
                  padding: spacing[16],
                  border: `1px solid ${shell.cardBorder}`,
                  borderRadius: shell.cardRadius,
                  overflow: 'hidden',
                }}
              >
                <div className="flex gap-4">
                  <div
                    className="rounded-xl flex-shrink-0 w-14 h-14 flex items-center justify-center"
                    style={{ background: colors.surface2, color: colors.muted }}
                  >
                    <Users size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: colors.text }}>
                      {profile.display_name}
                    </p>
                    {profile.headline && (
                      <p className="text-sm truncate mt-0.5" style={{ color: colors.muted }}>
                        {profile.headline}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded capitalize"
                        style={{ background: colors.primarySubtle, color: colors.primary }}
                      >
                        {getCoachTypeLabel(profile.coach_focus)}
                      </span>
                    </div>
                    {profile.bio && (
                      <p className="text-sm mt-2 line-clamp-2" style={{ color: colors.muted }}>
                        {shortBio(profile.bio)}
                      </p>
                    )}
                    {profile.location && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: colors.muted }}>
                        <MapPin size={12} />
                        {profile.location}
                      </p>
                    )}
                    {profile.pricing_summary?.trim() && (
                      <p className="text-xs mt-1" style={{ color: colors.muted }}>
                        {profile.pricing_summary.trim().slice(0, 80)}
                        {(profile.pricing_summary.trim().length || 0) > 80 ? '…' : ''}
                      </p>
                    )}
                    <Button
                      variant="primary"
                      className="mt-3 w-full sm:w-auto"
                      onClick={() => handleViewProfile(profile)}
                      disabled={!profileSlug(profile) && !profile.referral_code?.trim()}
                    >
                      View Profile
                      <ChevronRight size={16} className="ml-1 inline" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
