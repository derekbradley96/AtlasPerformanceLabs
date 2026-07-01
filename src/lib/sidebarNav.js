import {
  Home,
  Users,
  Inbox,
  Calendar,
  Dumbbell,
  UtensilsCrossed,
  TrendingUp,
  FileText,
  Package,
  ClipboardList,
  Phone,
  Award,
  Crosshair,
  UserPlus,
  Store,
  Share2,
  Image,
  CreditCard,
  Clock,
  LineChart,
  Gift,
  Zap,
  UsersRound,
  UserCircle,
  Palette,
  Bell,
  HelpCircle,
  MessageSquare,
  CheckSquare,
  Target,
  Trophy,
  BookOpen,
  Activity,
} from 'lucide-react';
import { PERSONAL_PROGRAM_BUILDER } from '@/lib/personalBuilderNav';

const COMP_ACCENT = '#9d6ef0'; // competition purple
const PREP_ACCENT = '#ba7517'; // prep amber

export function getSidebarSections(
  role,
  { coachFocus, isElite, hasCompetitionPrep, clientDeliveryContext, linkedCoachFocus } = {},
) {
  const isCompCoach = coachFocus === 'competition';
  const isIntegrated = coachFocus === 'integrated';
  const includePrepTools = isCompCoach || isIntegrated;
  const isCompClient = clientDeliveryContext === 'competition'
    || linkedCoachFocus === 'competition'
    || hasCompetitionPrep === true;

  if (role === 'coach') {
    return [
      {
        id: 'main',
        label: 'Main',
        items: [
          { path: '/home', label: 'Home', icon: Home },
          { path: '/clients', label: 'Clients', icon: Users, badgeKey: 'clients' },
          { path: '/inbox', label: 'Inbox', icon: Inbox, badgeKey: 'inbox' },
          { path: '/community', label: 'Community', icon: Users },
          ...(isCompCoach ? [{ path: '/prep-dashboard', label: 'Prep', icon: Crosshair }] : []),
        ],
      },
      ...(includePrepTools && !isCompCoach ? [{
        id: 'comp_prep_coach',
        label: 'Comp prep',
        accent: COMP_ACCENT,
        items: [
          { path: '/prep-dashboard', label: 'Prep hub', icon: Crosshair },
          { path: '/comp-prep/pose-library', label: 'Pose library', icon: Award },
          { path: '/peak-week-templates', label: 'Peak week', icon: Calendar },
        ],
      }] : []),
      {
        id: 'build',
        label: 'Build',
        items: [
          { path: '/programs', label: 'Programmes', icon: FileText },
          { path: '/methodology-packages', label: 'Coaching packs', icon: Package },
          { path: '/coach/nutrition', label: 'Nutrition plans', icon: UtensilsCrossed },
          { path: '/checkins', label: 'Check-ins', icon: ClipboardList },
          { path: '/checkintemplates', label: 'Check-in templates', icon: ClipboardList },
          { path: '/services', label: 'Services', icon: Phone },
        ],
      },
      {
        id: 'grow',
        label: 'Grow',
        items: [
          { path: '/get-clients', label: 'Get clients', icon: UserPlus },
          { path: '/marketplace-setup', label: 'Marketplace', icon: Store },
          { path: '/referrals', label: 'Referrals', icon: Share2 },
          { path: '/results-gallery', label: 'Result stories', icon: Image },
        ],
      },
      {
        id: 'business',
        label: 'Business',
        items: [
          { path: '/earnings', label: 'Earnings', icon: CreditCard },
          { path: '/time-report', label: 'Time report', icon: Clock },
          { path: '/revenue-analytics', label: 'Revenue analytics', icon: LineChart },
          { path: '/plan', label: 'Plan & billing', icon: Gift },
          ...(isElite ? [{ path: '/settings/branding', label: 'Client branding', icon: Zap }] : []),
          { path: '/team', label: 'Team', icon: UsersRound },
        ],
      },
      {
        id: 'account',
        label: 'Account',
        items: [
          { path: '/profile-account', label: 'Profile', icon: UserCircle },
          { path: '/settings/account', label: 'Settings', icon: Palette },
          { path: '/notifications', label: 'Notifications', icon: Bell },
          { path: '/helpsupport', label: 'Help', icon: HelpCircle },
        ],
      },
    ];
  }

  if (role === 'client') {
    return [
      {
        id: 'daily',
        label: 'Daily',
        items: [
          { path: '/today', label: 'Today', icon: Calendar },
          { path: '/today-workout', label: 'Train', icon: Dumbbell },
          { path: '/nutrition', label: 'Log food', icon: UtensilsCrossed },
        ],
      },
      {
        id: 'progress',
        label: 'Progress',
        items: [
          { path: '/progress', label: 'My progress', icon: TrendingUp },
          { path: '/progressphotos', label: 'Progress photos', icon: Image },
          { path: '/achievements', label: 'Milestones', icon: Trophy },
        ],
      },
      {
        id: 'coaching',
        label: 'Coaching',
        items: [
          { path: '/clientcheckin', label: 'Submit check-in', icon: ClipboardList, badgeKey: 'checkin_due' },
          { path: '/call-requests', label: 'Coach requests', icon: Phone },
          { path: '/messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
          { path: '/community', label: 'Community', icon: Users },
          { path: '/myprogram', label: 'My programme', icon: FileText },
          { path: '/nutrition', label: 'Nutrition plan', icon: UtensilsCrossed },
        ],
      },
      ...(isCompClient ? [{
        id: 'comp_prep',
        label: 'Comp prep',
        accent: PREP_ACCENT,
        items: [
          { path: '/comp-prep/pose-library', label: 'Pose library', icon: Award },
          { path: '/pose-self-assessment', label: 'Pose checks', icon: CheckSquare },
          { path: '/show-checklist', label: 'Show checklist', icon: Target },
          { path: '/first-timer-guide', label: 'First timer guide', icon: BookOpen },
        ],
      }] : []),
      {
        id: 'account',
        label: 'Account',
        items: [
          { path: '/settings/account', label: 'Settings', icon: Palette },
        ],
      },
    ];
  }

  const isCompPersonal = hasCompetitionPrep === true;
  return [
    {
      id: 'daily',
      label: 'Daily',
      items: [
        { path: '/today', label: 'Today', icon: Calendar },
        { path: '/workout', label: 'Train', icon: Dumbbell },
        { path: '/nutrition', label: 'Log food + weight', icon: UtensilsCrossed },
      ],
    },
    {
      id: 'progress',
      label: 'Progress',
      items: [
        { path: '/progressphotos', label: 'Progress photos', icon: Image },
        { path: '/progress', label: 'Weight chart', icon: TrendingUp },
        { path: '/achievements', label: 'Strength bests', icon: Trophy },
      ],
    },
    {
      id: 'build',
      label: 'Build',
      items: [
        { path: '/myprogram', label: 'My programme', icon: FileText },
        { path: PERSONAL_PROGRAM_BUILDER, label: 'Exercise library', icon: Dumbbell },
      ],
    },
    ...(isCompPersonal ? [{
      id: 'comp_prep',
      label: 'Comp prep',
      accent: PREP_ACCENT,
      items: [
        { path: '/prep-protocols', label: 'Prep protocols', icon: Crosshair },
        { path: '/comp-prep/pose-library', label: 'Pose library', icon: Award },
        { path: '/pose-self-assessment', label: 'Self-assessment', icon: CheckSquare },
        { path: '/federation-guide', label: 'Federation guide', icon: BookOpen },
      ],
    }] : []),
    {
      id: 'discover',
      label: 'Discover',
      items: [
        { path: '/discover', label: 'Find a coach', icon: Store },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { path: '/settings/account', label: 'Settings', icon: Palette },
      ],
    },
  ];
}
