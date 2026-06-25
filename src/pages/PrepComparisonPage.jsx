import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing, shell } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { isCoach, isPersonal } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getCoachClients } from '@/lib/checkins';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { listProgressPhotos } from '@/lib/progressPhotosService';
import PhotoComparisonView from '@/components/progress/PhotoComparisonView';
import { GitCompare } from 'lucide-react';

export default function PrepComparisonPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, effectiveRole } = useAuth();
  const coachView = isCoach(effectiveRole);
  const personalView = !coachView && isPersonal(effectiveRole);
  const presetClientId = searchParams.get('clientId') || '';
  const personalMode = personalView && (searchParams.get('personal') === '1' || !presetClientId);
  const [selectedClientId, setSelectedClientId] = useState(presetClientId);

  const { data: clients = [], isLoading: loadingClients, isError: clientsError } = useQuery({
    queryKey: ['photo-comparison-clients', user?.id],
    queryFn: async () => {
      const rows = await getCoachClients();
      return (rows || []).map((c) => ({
        id: c.id,
        name: c.full_name || c.name || 'Client',
        show_date: c.show_date ?? null,
        showDate: c.show_date ?? null,
        client_type: c.client_type ?? null,
      }));
    },
    enabled: coachView && !!user?.id && hasSupabase,
  });

  const { data: ownClientProfile = null, isLoading: loadingOwnClient, isError: ownClientError } = useQuery({
    queryKey: ['photo-comparison-own-client', user?.id],
    queryFn: () => getMyClientProfile(user.id),
    enabled: !coachView && !personalView && !!user?.id && hasSupabase,
  });

  const effectiveClientId = coachView ? selectedClientId : ownClientProfile?.id || '';
  const personalProfileId = personalMode && !effectiveClientId ? user?.id || '' : '';
  const photoScopeKey = effectiveClientId || personalProfileId || '';
  const selectedClient = useMemo(
    () => (coachView ? clients.find((c) => c.id === effectiveClientId) || null : ownClientProfile),
    [coachView, clients, ownClientProfile, effectiveClientId]
  );

  const { data: photos = [], isLoading: loadingPhotos, isError: photosError } = useQuery({
    queryKey: ['photo-comparison-photos', photoScopeKey, personalProfileId ? 'personal' : 'client'],
    queryFn: async () => {
      if (!photoScopeKey || !hasSupabase) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      return listProgressPhotos({
        supabase,
        clientId: effectiveClientId || undefined,
        profileId: personalProfileId || undefined,
      });
    },
    enabled: hasSupabase && !!photoScopeKey,
  });

  const isCompetitionContext = Boolean(
    selectedClient?.show_date || selectedClient?.showDate || selectedClient?.client_type === 'competition'
  );
  const isLoading = loadingPhotos || loadingClients || loadingOwnClient;

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Photo Comparison" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Compare two check-in photos side by side to make visual progress unmissable.
        </p>

        {!hasSupabase && (
          <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
            <p className="text-sm" style={{ color: colors.muted }}>Progress photos require a connected backend.</p>
          </Card>
        )}

        {coachView && hasSupabase && (
          <section style={{ marginBottom: spacing[20] }}>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Client
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              style={{
                width: '100%',
                padding: spacing[12],
                borderRadius: shell.cardRadius ?? 8,
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: 14,
              }}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </section>
        )}

        {isLoading && (
          <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
            <p className="text-sm" style={{ color: colors.muted }}>Loading comparison data…</p>
          </Card>
        )}

        {(clientsError || photosError || ownClientError) && (
          <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
            <p className="text-sm" style={{ color: colors.muted }}>
              Couldn&apos;t load comparison data. Try again in a moment.
            </p>
          </Card>
        )}

        {!isLoading && !photoScopeKey && (
          <EmptyState
            title={personalView ? 'Upload progress photos first' : 'Select a client'}
            description={
              personalView
                ? 'Add at least two dated photos on Progress photos, then compare them here.'
                : 'Choose a client with at least two progress photos.'
            }
            icon={GitCompare}
          />
        )}

        {!isLoading && photoScopeKey && photos.length < 2 && photos.length > 0 && (
          <Card style={{ padding: spacing[24], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
            <p className="text-sm" style={{ color: colors.text }}>Upload one more progress photo to unlock side-by-side comparison.</p>
          </Card>
        )}

        {!isLoading && photoScopeKey && photos.length === 0 && (
          <EmptyState
            title="No progress photos yet"
            description="Upload progress photos to compare your transformation visually."
            icon={GitCompare}
          />
        )}

        {!isLoading && photoScopeKey && photos.length >= 2 && (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              {isCompetitionContext ? 'Weeks out comparison' : 'Date comparison'}
            </h2>
            <PhotoComparisonView
              photos={photos}
              showDate={selectedClient?.show_date || selectedClient?.showDate || null}
              isCompetition={isCompetitionContext}
              canShare={coachView}
            />
          </>
        )}
      </div>
    </div>
  );
}
