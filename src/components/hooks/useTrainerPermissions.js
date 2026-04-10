/**
 * Trainer permissions & assistant scope (Atlas Performance Labs)
 * ---------------------------------------------------------------
 * 1. Team: Elite / Scale only — canAccessTeam when plan is elite or scale (owner only).
 * 2. Commission: Varies by tier (Basic 10%, Pro 3%, Elite 0%) — see config/plans.js.
 * 3. Plan & Billing, Branding, Programs, Comp Prep entry: available on owner plans as defined in routing
 *    (this hook does not duplicate App.jsx capability gates).
 * 4. Heavy automation surfaces — command center, advanced analytics, revenue analytics, training intelligence,
 *    capacity — are gated to Pro/Elite in App.jsx via RequireCoachCapability(capability: 'can_access_advanced_coach_automation').
 * 5. Peak week routes — gated to coaches with competition or integrated focus via can_access_peak_week in accessModel.js.
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import {
  getOwnerForAssistant,
  getAssistantPermissions,
  OWNER_PERMISSIONS,
} from '@/lib/coachTeamMemberStore';
import { resolveCoachPlanTier } from '@/config/plans';

/**
 * For coach-role users: returns owner id, whether current user is an assistant,
 * and permission flags. Only Team is gated by plan (Elite only). Plan, Branding, etc. are available to all owners.
 */
export function useTrainerPermissions() {
  const { user, role, profile } = useAuth();
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

    const planId = resolveCoachPlanTier(profile, user);
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
  }, [role, userId, profile?.plan_tier, user?.plan_tier]);
}
