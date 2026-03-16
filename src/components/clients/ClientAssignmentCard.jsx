/**
 * Coach assignment card for a single client within an organisation.
 * Organisation-aware, permission-aware; uses clients.assigned_coach_id as primary,
 * syncing legacy coach_id / trainer_id for compatibility.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, standardCard } from '@/ui/pageLayout';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  canAssignClients,
  isOrganisationOwner,
  isOrganisationAdmin,
} from '@/lib/organisationPermissions';
import { ClientAssignmentSkeleton } from '@/components/ui/LoadingState';

const COACH_ROLES = ['owner', 'admin', 'coach'];

async function fetchClientAssignment(clientId, currentUserId) {
  if (!clientId || !hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, full_name, name, assigned_coach_id, coach_id, trainer_id, organisation_id')
    .eq('id', clientId)
    .maybeSingle();
  if (clientError) {
    console.error('[ClientAssignmentCard] load client', clientError);
    throw clientError;
  }
  if (!client) return null;

  const orgId = client.organisation_id ?? null;
  if (!orgId) {
    return {
      client: {
        id: client.id,
        name: client.full_name || client.name || 'Client',
      },
      organisation: null,
      currentCoachId: client.assigned_coach_id ?? client.coach_id ?? client.trainer_id ?? null,
      currentCoachName: null,
      myMember: null,
      canAssign: false,
      canAssignSelfOnly: false,
      coaches: [],
    };
  }

  const { data: members, error: membersError } = await supabase
    .from('organisation_members')
    .select('profile_id, role, is_active')
    .eq('organisation_id', orgId);
  if (membersError) {
    console.error('[ClientAssignmentCard] load members', membersError);
    throw membersError;
  }

  const activeMembers = (members ?? []).filter((m) => m.is_active);
  const myMember = activeMembers.find((m) => m.profile_id === currentUserId) ?? null;
  const coachMembers = activeMembers.filter((m) =>
    COACH_ROLES.includes((m.role || '').toLowerCase()),
  );

  const currentCoachId = client.assigned_coach_id ?? client.coach_id ?? client.trainer_id ?? null;

  const profileIds = new Set(coachMembers.map((m) => m.profile_id).filter(Boolean));
  if (currentCoachId && !profileIds.has(currentCoachId)) {
    profileIds.add(currentCoachId);
  }

  let profiles = [];
  if (profileIds.size > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, name')
      .in('id', Array.from(profileIds));
    if (profilesError) {
      console.error('[ClientAssignmentCard] load profiles', profilesError);
      throw profilesError;
    }
    profiles = profilesData ?? [];
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const coaches = coachMembers.map((m) => {
    const p = profileMap.get(m.profile_id);
    const name = p?.display_name || p?.name || 'Coach';
    return {
      id: m.profile_id,
      name,
      role: (m.role || '').toLowerCase(),
    };
  });

  const currentCoachProfile = currentCoachId ? profileMap.get(currentCoachId) : null;
  const currentCoachName = currentCoachProfile
    ? currentCoachProfile.display_name || currentCoachProfile.name || 'Coach'
    : null;

  const canAssign = myMember ? canAssignClients(myMember) : false;
  const myRole = (myMember?.role || '').toLowerCase();
  const ownerOrAdmin = isOrganisationOwner(myMember) || isOrganisationAdmin(myMember);
  const canAssignSelfOnly = canAssign && !ownerOrAdmin && myRole === 'coach';

  return {
    client: {
      id: client.id,
      name: client.full_name || client.name || 'Client',
    },
    organisation: { id: orgId },
    currentCoachId,
    currentCoachName,
    myMember,
    canAssign,
    canAssignSelfOnly,
    myProfileId: currentUserId,
    coaches,
  };
}

export default function ClientAssignmentCard({ clientId }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCoachId, setSelectedCoachId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client_assignment', clientId, user?.id],
    queryFn: () => fetchClientAssignment(clientId, user?.id),
    enabled: !!clientId && !!user?.id && hasSupabase,
  });

  const mutation = useMutation({
    mutationFn: async (nextCoachId) => {
      if (!clientId || !nextCoachId) return;
      const supabase = getSupabase();
      if (!supabase) throw new Error('No Supabase client');
      const { error } = await supabase
        .from('clients')
        .update({
          assigned_coach_id: nextCoachId,
          coach_id: nextCoachId,
          trainer_id: nextCoachId,
        })
        .eq('id', clientId);
      if (error) {
        console.error('[ClientAssignmentCard] update client coach', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_assignment', clientId, user?.id] });
      toast.success('Coach assignment updated');
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to update coach assignment');
    },
  });

  if (!clientId || !hasSupabase) return null;

  const loading = isLoading || (!data && !isError);
  if (!data && !loading) return null;

  const {
    client,
    organisation,
    currentCoachId,
    currentCoachName,
    canAssign,
    canAssignSelfOnly,
    myProfileId,
    coaches,
  } = data || {};

  const effectiveSelected = selectedCoachId ?? currentCoachId ?? myProfileId ?? '';

  const availableCoaches = canAssignSelfOnly
    ? coaches.filter((c) => c.id === myProfileId)
    : coaches;

  const canShowControls = canAssign && organisation && availableCoaches.length > 0;

  if (loading) {
    return <ClientAssignmentSkeleton />;
  }

  return (
    <div style={{ marginBottom: spacing[16] }}>
      <p style={sectionLabel}>Coach assignment</p>
      <Card style={{ ...standardCard, padding: spacing[16] }}>

        {!organisation && (
          <p className="text-sm" style={{ color: colors.muted }}>
            This client is not in an organisation yet. Add them to an organisation to assign or change their coach from here.
          </p>
        )}

        {organisation && (
          <>
            <p className="text-sm mb-2" style={{ color: colors.text }}>
              <span className="font-medium">Client:</span> {client?.name || 'Client'}
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              <span className="font-medium" style={{ color: colors.text }}>
                Current coach:
              </span>{' '}
              {currentCoachName || 'Unassigned'}
            </p>

            {canShowControls ? (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                    Assign to coach
                  </label>
                  <select
                    className="w-full rounded-md border px-2 py-1.5 text-sm bg-transparent"
                    style={{ borderColor: colors.border, color: colors.text }}
                    value={effectiveSelected}
                    onChange={(e) => setSelectedCoachId(e.target.value || null)}
                    disabled={mutation.isPending}
                  >
                    <option value="" disabled>
                      Select coach
                    </option>
                    {availableCoaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    mutation.isPending ||
                    !effectiveSelected ||
                    !clientId ||
                    effectiveSelected === currentCoachId
                  }
                  onClick={() => {
                    if (!effectiveSelected) return;
                    mutation.mutate(effectiveSelected);
                  }}
                >
                  {mutation.isPending ? 'Saving…' : 'Update coach'}
                </Button>
              </div>
            ) : (
              <p className="text-xs mt-1" style={{ color: colors.muted }}>
                You can view the assigned coach. Changes can be made by an organisation owner or
                admin.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

