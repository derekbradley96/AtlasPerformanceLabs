/**
 * Organisation team management: list members, assign role, remove, invite coach by email.
 * Only organisation owners and admins can access.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getAppOrigin } from '@/lib/appOrigin';
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { TeamManagementSkeleton } from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'assistant', label: 'Assistant' },
];

async function getCurrentUserOrg(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { orgId: null, organisation: null, canManage: false, userProfileId: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .maybeSingle();

  let orgId = profile?.organisation_id ?? null;
  if (!orgId) {
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('organisation_id, role')
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle();
    orgId = membership?.organisation_id ?? null;
  }

  if (!orgId) return { orgId: null, organisation: null, canManage: false, userProfileId: user.id };

  const { data: organisation } = await supabase
    .from('organisations')
    .select('id, name, owner_profile_id')
    .eq('id', orgId)
    .maybeSingle();

  const { data: myMember } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('organisation_id', orgId)
    .eq('profile_id', user.id)
    .maybeSingle();

  const canManage =
    organisation?.owner_profile_id === user.id ||
    (myMember?.role && ['owner', 'admin'].includes(myMember.role));

  return {
    orgId,
    organisation: organisation ?? { id: orgId, name: 'Organisation', owner_profile_id: null },
    canManage: !!canManage,
    userProfileId: user.id,
  };
}

async function fetchTeamData() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { orgId, organisation, canManage, userProfileId } = await getCurrentUserOrg(supabase);
  if (!orgId) return { organisation: null, members: [], invites: [], canManage: false };

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('organisation_members')
      .select('id, profile_id, role, is_active, created_at')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: true }),
    canManage
      ? supabase
          .from('organisation_invites')
          .select('id, email, role, created_at')
          .eq('organisation_id', orgId)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const members = membersRes.data ?? [];
  const invites = invitesRes.data ?? [];
  const profileIds = [...new Set(members.map((m) => m.profile_id).filter(Boolean))];

  let profiles = [];
  if (profileIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, name')
      .in('id', profileIds);
    profiles = data ?? [];
  }

  const profileMap = new Map(profiles.map((p) => [p.id, { name: p.display_name || p.name || 'Coach' }]));

  const membersWithNames = members.map((m) => ({
    ...m,
    name: profileMap.get(m.profile_id)?.name ?? 'Coach',
    isOwner: organisation.owner_profile_id === m.profile_id,
  }));

  return {
    organisation,
    members: membersWithNames,
    invites,
    canManage,
    userProfileId,
  };
}

export default function TeamManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('coach');
  const [inviteSent, setInviteSent] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team_management'],
    queryFn: fetchTeamData,
    enabled: hasSupabase,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('No Supabase');
      const { error } = await supabase
        .from('organisation_members')
        .update({ role })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_management'] });
      toast.success('Role updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update role'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ memberId, nextActive }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('No Supabase');
      const { error } = await supabase
        .from('organisation_members')
        .update({ is_active: nextActive })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team_management'] });
      toast.success(variables?.nextActive ? 'Member reactivated' : 'Member deactivated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update member'),
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('No Supabase');
      const org = await getCurrentUserOrg(supabase);
      if (!org?.orgId || !org.canManage) throw new Error('Not allowed');
      const email = (inviteEmail || '').trim().toLowerCase();
      if (!email) throw new Error('Enter an email');
      const token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const { data: row, error } = await supabase
        .from('organisation_invites')
        .insert({
          organisation_id: org.orgId,
          email,
          role: inviteRole,
          invited_by: org.userProfileId,
          token,
        })
        .select('id, token, email, role')
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      setInviteSent(row);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['team_management'] });
      toast.success('Invite created');
    },
    onError: (e) => toast.error(e.message || 'Failed to create invite'),
  });

  const inviteLink = inviteSent
    ? `${getAppOrigin()}/auth?org_invite=${encodeURIComponent(inviteSent.token)}`
    : '';

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedToken(inviteSent?.token ?? true);
      toast.success('Link copied');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleSendViaEmail = () => {
    if (!inviteLink) return;
    const subject = encodeURIComponent(`Join ${data?.organisation?.name ?? 'our team'} on Atlas`);
    const body = encodeURIComponent(
      `You're invited to join ${data?.organisation?.name ?? 'our team'} on Atlas Performance Labs.\n\nSign up using this link:\n${inviteLink}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (!hasSupabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to manage team.</p>
      </div>
    );
  }

  const noOrg = data && !data.organisation;
  const canManage = data?.canManage ?? false;

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar
        title={data?.organisation?.name ? `${data.organisation.name} · Team` : 'Team management'}
        onBack={() => navigate(-1)}
      />

      <div className="p-4 space-y-6">
        {isLoading && <TeamManagementSkeleton />}
        {isError && <p style={{ color: colors.muted }}>Could not load team.</p>}

        {noOrg && !isLoading && !isError && (
          <EmptyState
            title="No organisation"
            description="Join or create an organisation to manage team members, roles, and invites."
            icon={Users}
            actionLabel="Back to Organisation"
            onAction={() => navigate('/organisation')}
          />
        )}

        {data?.organisation && !canManage && (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p style={{ color: colors.muted }}>Only owners and admins can manage team members.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/organisation')}>
              Back to Organisation
            </Button>
          </Card>
        )}

        {data?.organisation && canManage && (
          <>
            {/* Invite coach */}
            <Card style={{ padding: spacing[16] }}>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text }}>
                <UserPlus size={18} />
                Invite coach
              </h2>
              {!inviteSent ? (
                <>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm mb-3"
                    style={{ borderColor: colors.border, color: colors.text }}
                  />
                  <div className="flex flex-wrap gap-2 items-center mb-3">
                    <span className="text-sm" style={{ color: colors.muted }}>Role:</span>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-lg border bg-transparent px-3 py-2 text-sm"
                      style={{ borderColor: colors.border, color: colors.text }}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={() => createInviteMutation.mutate()}
                    disabled={!inviteEmail.trim() || createInviteMutation.isPending}
                  >
                    {createInviteMutation.isPending ? 'Creating…' : 'Create invite link'}
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: colors.text }}>
                    Invite link for <strong>{inviteSent.email}</strong> ({inviteSent.role})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
                      {copiedToken ? <Check size={16} /> : <Copy size={16} />}
                      {copiedToken ? ' Copied' : ' Copy link'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSendViaEmail}>
                      <Mail size={16} />
                      Send via email
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setInviteSent(null)}>
                    Invite another
                  </Button>
                </div>
              )}
            </Card>

            {/* Pending invites */}
            {data.invites?.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  Pending invites
                </h2>
                <ul className="space-y-2">
                  {data.invites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: colors.surface1 }}
                    >
                      <span className="text-sm" style={{ color: colors.text }}>
                        {inv.email} <span style={{ color: colors.muted }}>({inv.role})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Team members */}
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                Team members
              </h2>
              {(!data?.members?.length ? (
                <EmptyState
                  title="No team members yet"
                  description="As owner or admin, invite coaches and admins above to build your team. Assign roles and manage access from here."
                  icon={UserPlus}
                />
              ) : (
                <ul className="space-y-2">
                  {data.members.map((member) => {
                    const joinedLabel = member.created_at
                      ? new Date(member.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—';
                    const activeLabel = member.is_active ? 'Active' : 'Inactive';
                    const activeColor = member.is_active ? colors.success : colors.muted;
                    return (
                      <li
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-3 border"
                        style={{ borderColor: colors.border, background: colors.card }}
                      >
                        <div>
                          <p className="font-medium text-sm" style={{ color: colors.text }}>
                            {member.name}
                            {member.isOwner && (
                              <span className="ml-2 text-xs" style={{ color: colors.muted }}>
                                (Owner)
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                            <span style={{ color: colors.muted }}>Role: {member.role}</span>
                            <span style={{ color: activeColor }}>• {activeLabel}</span>
                            <span style={{ color: colors.muted }}>• Joined {joinedLabel}</span>
                          </div>
                          {!member.isOwner && (
                            <select
                              value={member.role}
                              onChange={(e) => updateRoleMutation.mutate({ memberId: member.id, role: e.target.value })}
                              className="mt-2 rounded border bg-transparent px-2 py-1 text-xs"
                              style={{ borderColor: colors.border, color: colors.text }}
                              disabled={updateRoleMutation.isPending}
                            >
                              <option value="admin">Admin</option>
                              <option value="coach">Coach</option>
                              <option value="assistant">Assistant</option>
                            </select>
                          )}
                        </div>
                        {!member.isOwner && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                const nextActive = !member.is_active;
                                const label = nextActive ? 'reactivate' : 'deactivate';
                                if (window.confirm(`Are you sure you want to ${label} ${member.name}?`)) {
                                  toggleActiveMutation.mutate({ memberId: member.id, nextActive });
                                }
                              }}
                              disabled={toggleActiveMutation.isPending}
                            >
                              {member.is_active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
