/**
 * Coach-facing lifecycle model for invite/code acquisition and activation.
 *
 * States:
 * - invited: invite sent, client has not joined yet (InviteClient pending list)
 * - joined_unset: joined but missing key setup actions
 * - active: key setup done and ongoing coaching signals exist
 */

function toLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function derivePendingInviteLifecycle(invite) {
  const status = toLower(invite?.status);
  if (status === 'accepted' || status === 'joined') {
    return { key: 'joined', label: 'Joined', tone: 'success' };
  }
  if (status === 'expired') {
    return { key: 'expired', label: 'Expired', tone: 'warning' };
  }
  return { key: 'invited', label: 'Pending join', tone: 'neutral' };
}

export function deriveCoachClientLifecycle(client, options = {}) {
  const checkInCount = Number(options.checkInCount ?? 0) || 0;
  const hasProgram = Boolean(options.hasProgram);
  const hasNutrition = Boolean(options.hasNutrition);
  const hasMessage = Boolean(options.hasMessage);

  const billing = toLower(client?.billing_status ?? client?.subscription_status);
  const joined = Boolean(client?.user_id) || billing === 'active' || billing === 'trialing';
  const onboardingish = billing === 'pending' || billing === 'incomplete' || billing === 'trial';

  const setupTasks = {
    trainingAssigned: hasProgram,
    nutritionAssigned: hasNutrition,
    firstMessageSent: hasMessage,
    firstCheckinSubmitted: checkInCount > 0,
  };
  const completedTaskCount = Object.values(setupTasks).filter(Boolean).length;
  const setupComplete = completedTaskCount >= 3 && setupTasks.trainingAssigned && setupTasks.firstMessageSent;

  if (!joined && onboardingish) {
    return {
      key: 'joined_unset',
      label: 'Joined · setup incomplete',
      tone: 'warning',
      setupTasks,
      setupComplete: false,
    };
  }

  if (joined && !setupComplete) {
    return {
      key: 'joined_unset',
      label: 'Joined · setup incomplete',
      tone: 'warning',
      setupTasks,
      setupComplete: false,
    };
  }

  return {
    key: 'active',
    label: 'Active',
    tone: 'success',
    setupTasks,
    setupComplete: true,
  };
}

