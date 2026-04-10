/**
 * Deep links and icons for in-app notifications (single source for bell + notification center).
 * @param {object} notification — row from public.notifications
 * @param {string | null} [viewerRole] — normalized role hint (coach | client | personal)
 */
import {
  Bell,
  Calendar,
  CheckSquare,
  CreditCard,
  MessageCircle,
  FileText,
  Trophy,
  AlertTriangle,
  LineChart,
  UserRound,
} from 'lucide-react';
import { isCoach as roleIsCoach, isClient as roleIsClient } from '@/lib/roles';

function pickData(notification) {
  return notification?.data && typeof notification.data === 'object' ? notification.data : {};
}

/**
 * @param {object} notification
 * @param {string | null} [viewerRole]
 * @returns {string | null}
 */
export function getRouteForNotification(notification, viewerRole = null) {
  if (!notification?.type) return null;
  const data = pickData(notification);
  let clientId = data.client_id ?? data.clientId ?? null;
  const checkinId = data.checkin_id ?? data.checkinId ?? null;
  const threadId = data.thread_id ?? data.threadId ?? null;
  const peakWeekId = data.peak_week_id ?? data.peakWeekId ?? null;
  const poseCheckId = data.pose_check_id ?? data.poseCheckId ?? null;
  if (!clientId && notification.entity_id && data.checkin_id == null) {
    if (['at_risk_client', 'payment_issue', 'payment_due', 'program_update'].includes(notification.type)) {
      clientId = notification.entity_id;
    }
  }

  const isCoach = roleIsCoach(viewerRole);
  const isClient = roleIsClient(viewerRole);

  switch (notification.type) {
    case 'checkin_review':
    case 'checkin_submitted':
      if (isCoach && clientId && checkinId) return `/clients/${clientId}/checkins/${checkinId}`;
      if (isCoach && clientId) return `/clients/${clientId}/review-center`;
      if (isCoach) return '/review-center';
      return '/check-in';
    case 'checkin_overdue':
      if (isCoach && clientId && checkinId) return `/clients/${clientId}/checkins/${checkinId}`;
      if (isCoach && clientId) return `/clients/${clientId}/review-center`;
      if (isCoach) return '/review-center/checkins';
      return '/check-in';
    case 'checkin_due':
      return isClient || !isCoach ? '/check-in' : '/review-center/checkins';
    case 'message_received':
    case 'message_reply':
      if (isCoach && clientId) return `/messages/${clientId}`;
      return '/messages';
    case 'pose_check_submitted':
      if (isCoach && poseCheckId) return `/review-center/pose-checks/${poseCheckId}`;
      if (isCoach) return '/review-center/pose-checks';
      return '/pose-check';
    case 'at_risk_client':
    case 'client_flag_created':
      if (isCoach && clientId) return `/clients/${clientId}`;
      if (isCoach) return '/clients';
      return '/profile-account';
    case 'payment_issue':
    case 'billing_failed':
    case 'coach_alert':
    case 'payment_due':
      if (isCoach && clientId) return `/clients/${clientId}/billing`;
      if (isCoach) return '/revenue';
      return '/profile-account';
    case 'program_update':
      if (isCoach && clientId) return `/clients/${clientId}`;
      return '/my-program';
    case 'habit_due':
    case 'habit_streak':
    case 'retention_nudge':
    case 'missed_session':
      return '/habits-daily';
    case 'peak_week_update':
      if (isCoach && clientId) return `/clients/${clientId}/peak-week`;
      if (peakWeekId && isCoach) return '/peak-week-dashboard';
      return '/peak-week';
    case 'adherence_drop':
    case 'inactivity':
    case 'progress_insight':
    case 'upgrade_prompt':
    case 'review_summary':
      if (isCoach && clientId) return `/clients/${clientId}`;
      if (isCoach) return '/analytics';
      return '/progress';
    default:
      return null;
  }
}

const ICON_MAP = {
  checkin_due: Calendar,
  checkin_review: FileText,
  checkin_submitted: FileText,
  checkin_overdue: Calendar,
  message_received: MessageCircle,
  message_reply: MessageCircle,
  habit_due: CheckSquare,
  habit_streak: CheckSquare,
  retention_nudge: CheckSquare,
  missed_session: Calendar,
  peak_week_update: Trophy,
  program_update: FileText,
  coach_alert: AlertTriangle,
  payment_due: CreditCard,
  payment_issue: CreditCard,
  billing_failed: CreditCard,
  at_risk_client: AlertTriangle,
  client_flag_created: AlertTriangle,
  pose_check_submitted: UserRound,
  adherence_drop: LineChart,
  inactivity: LineChart,
  progress_insight: LineChart,
  upgrade_prompt: Bell,
  review_summary: LineChart,
};

/**
 * @param {string | undefined} type
 */
export function getIconForNotificationType(type) {
  return ICON_MAP[type] || Bell;
}
