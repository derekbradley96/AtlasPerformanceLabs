/**
 * GATING AUDIT (Atlas Performance Labs)
 * --------------------------------------
 * 1. Team: Gated to Elite (and scale) only. canAccessTeam is true only when plan is elite/scale.
 * 2. Commission: Varies by plan (Basic 10%, Pro 3%, Elite 0%). Applied in Stripe/backend only; see config/plans.js getCommissionPercentForTier.
 * 3. Everything else: Available to all plans. No feature gating on Plan & Billing, Branding, Programs, Comp Prep, etc.
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import {
  getOwnerForAssistant,
  getAssistantPermissions,
  OWNER_PERMISSIONS,
} from '@/lib/coachTeamMemberStore';

const PLAN_STORAGE_KEY = 'atlas_trainer_plan';

function getPlanIdFromStorage() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PLAN_STORAGE_KEY) : null;
    return (raw || 'pro').toLowerCase();
  } catch {
    return 'pro';
  }
}

/**
 * For coach-role users: returns owner id, whether current user is an assistant,
 * and permission flags. Only Team is gated by plan (Elite only). Plan, Branding, etc. are available to all owners.
 */
export function useTrainerPermissions() {
  const { user, role } = useAuth();
  const userId = user?.id;

  return useMemo(() => {
    if (!isCoach(role) || !userId) {
      return {
        ownerId: null,
        isAssistant: false,
        permissions: null,
        canAccessPlan: false,
        canAccessTeam: false,
        canAccessBranding: false,
        canAccessCoachProfileEdit: false,
        canExport: false,
        canViewClients: false,
        canReviewCheckins: false,
        canReviewPosing: false,
        canMessageClients: false,
      };
    }

    const ownerForAssistant = getOwnerForAssistant(userId);
    const isAssistant = !!ownerForAssistant;
    const ownerId = isAssistant ? ownerForAssistant : userId;
    const permissions = isAssistant
      ? getAssistantPermissions(ownerId, userId)
      : OWNER_PERMISSIONS;

    const planId = getPlanIdFromStorage();
    const isEliteOrScale = planId === 'elite' || planId === 'scale';

    return {
      ownerId,
      isAssistant,
      permissions,
      canAccessPlan: !isAssistant,
      canAccessTeam: !isAssistant && isEliteOrScale,
      canAccessBranding: !isAssistant,
      canAccessCoachProfileEdit: !isAssistant,
      canExport: permissions?.canExport ?? false,
      canViewClients: permissions?.canViewClients ?? true,
      canReviewCheckins: permissions?.canReviewCheckins ?? true,
      canReviewPosing: permissions?.canReviewPosing ?? true,
      canMessageClients: permissions?.canMessageClients ?? true,
    };
  }, [role, userId]);
}
