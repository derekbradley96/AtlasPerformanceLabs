import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
} from '@/lib/coachTeamMemberStore';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { UserPlus, Trash2, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { SkeletonCard } from '@/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const PLAN_KEY = 'atlas_trainer_plan';

function getCurrentPlanId() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PLAN_KEY) : null;
    return raw || 'pro';
  } catch {
    return 'pro';
  }
}

const ROLE_LABELS = {
  assistant_readonly: 'View only',
  assistant_edit_limited: 'Limited edit',
  assistant_full: 'Full access',
};

export default function Team() {
  const { user, isDemoMode } = useAuth();
  const ownerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [memberIdToRemove, setMemberIdToRemove] = useState(null);

  const planId = getCurrentPlanId();
  const teamEnabled = planId === 'elite' || planId === 'scale';

  const load = useCallback(() => {
    if (!ownerId) return;
    setMembers(listTeamMembers(ownerId));
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = useCallback(() => {
    const email = (inviteEmail || '').trim();
    if (!email) {
      toast.error('Enter an email address');
      return;
    }
    impactLight();
    addTeamMember(ownerId, { email, role: 'assistant_readonly' });
    setInviteEmail('');
    toast.success('Invite sent (placeholder)');
    load();
  }, [ownerId, inviteEmail, load]);

  const handleRemoveRequest = useCallback((memberId) => {
    setMemberIdToRemove(memberId);
    setRemoveConfirmOpen(true);
  }, []);

  const handleRemoveConfirm = useCallback(() => {
    if (memberIdToRemove) {
      impactLight();
      removeTeamMember(memberIdToRemove);
      toast.success('Member removed');
      load();
    }
    setRemoveConfirmOpen(false);
    setMemberIdToRemove(null);
  }, [memberIdToRemove, load]);

  const handleRemoveCancel = useCallback(() => {
    setRemoveConfirmOpen(false);
    setMemberIdToRemove(null);
  }, []);

  if (!ownerId) {
    return (
      <div className="p-6" style={{ color: colors.muted }}>
        <p>Sign in as a trainer to manage your team.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!teamEnabled) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{
          paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))`,
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
          paddingTop: spacing[8],
        }}
      >
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <Lock size={48} style={{ color: colors.muted }} className="mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
            Team is available on Elite
          </h2>
          <p className="text-sm mb-6" style={{ color: colors.muted }}>
            Upgrade your plan to add assistant coaches and manage permissions.
          </p>
          <Button onClick={() => impactLight()}>Upgrade to Elite</Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingTop: spacing[8],
      }}
    >
      <h1 className="text-xl font-semibold mb-4" style={{ color: colors.text }}>Team</h1>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-sm font-medium mb-2" style={{ color: colors.muted }}>Invite assistant</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 rounded-lg border px-3 py-2.5 text-[15px]"
            style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
          />
          <Button onClick={handleInvite} className="gap-1">
            <UserPlus size={18} />
            Invite
          </Button>
        </div>
      </Card>

      <h2 className="text-base font-semibold mb-3" style={{ color: colors.text }}>Members</h2>
      {members.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <Users size={40} style={{ color: colors.muted }} className="mx-auto mb-3" />
          <p className="text-sm mb-2" style={{ color: colors.text }}>No team members yet</p>
          <p className="text-sm" style={{ color: colors.muted }}>Invite assistants by email to get started.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <Card key={m.id} style={{ padding: spacing[16] }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium" style={{ color: colors.text }}>{m.email || 'Pending invite'}</p>
                  <p className="text-xs" style={{ color: colors.muted }}>{ROLE_LABELS[m.role] || m.role}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs" style={{ color: colors.muted }}>
                    {m.permissions?.canViewClients && <span>Clients</span>}
                    {m.permissions?.canReviewCheckins && <span>Check-ins</span>}
                    {m.permissions?.canMessageClients && <span>Messages</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRequest(m.id)}
                  className="p-2 rounded-lg text-red-400"
                  aria-label="Remove"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={removeConfirmOpen}
        title="Remove team member?"
        message="This will remove the member from your team."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />
    </div>
  );
}
