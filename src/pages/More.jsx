import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ADMIN_EMAIL } from '@/lib/AuthContext';
import { useAlertStatus } from '@/components/hooks/useAlertStatus';
import { UserCircle, MessageSquare, Palette, HelpCircle, Trophy, Phone, Link2, Users, CheckSquare, Award, BarChart3, TrendingUp, FileText, Image, CreditCard, UsersRound, Package, RefreshCw, Zap, Dumbbell, Store, Inbox, Bell, Gift, Calendar, Building2, Building, Pill, Activity, LayoutDashboard } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { seedIfEmpty, resetSandbox, addClient } from '@/lib/sandboxStore';
import { getTrainerId } from '@/lib/getTrainerId';
import { getClientByUserId, getClientCheckIns } from '@/data/selectors';
import { getTrainerProfile } from '@/lib/trainerFoundation/trainerProfileRepo';
import { PLANS, CURRENCY } from '@/config/plans';
import { getAchievementsList, getShownAchievementIds } from '@/lib/milestonesStore';
import { evaluateUserMilestones } from '@/lib/milestoneEngine';
import {
  loadDismissedMilestones,
  markMilestoneDismissed,
  makeMilestoneKey,
  shouldShowMilestone,
} from '@/lib/milestoneDismissedStore';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';
import { shouldShowModule } from '@/lib/coachFocus';
import { isCoach, isClient, isPersonal, roleHomePath } from '@/lib/roles';
import { getRouteTitle } from '@/lib/routeMeta';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Row from '@/ui/Row';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionGap } from '@/ui/pageLayout';
import AchievementUnlockedModal from '@/components/achievements/AchievementUnlockedModal';
import RequestConsultationModal from '@/components/consultation/RequestConsultationModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

/** Local error boundary: captures and shows the real error so we can fix it. */
class MoreErrorBoundary extends React.Component {
  state = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[More screen]', error?.message ?? error, info?.componentStack);
    }
    this.setState((prev) => (prev.componentStack != null ? null : { componentStack: info?.componentStack ?? null }));
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const message = (err?.message && String(err.message).trim()) || (err && String(err)) || 'Unknown error';
      const stack = this.state.componentStack || err?.stack;
      const showStack = import.meta.env.DEV && stack;

      return (
        <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={{ padding: spacing[24] }}>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              background: colors.card,
              borderColor: colors.border,
              padding: spacing[24],
              textAlign: 'center',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}
            >
              <RefreshCw size={32} style={{ color: colors.muted }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>Something went wrong</h2>
            <p className="text-sm mb-2 font-medium" style={{ color: colors.text }}>
              {message}
            </p>
            {showStack && (
              <pre
                className="text-left text-xs overflow-auto mt-3 mb-4 p-3 rounded-lg"
                style={{
                  color: colors.muted,
                  background: colors.surface1,
                  border: `1px solid ${colors.border}`,
                  maxHeight: 120,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {typeof stack === 'string' ? stack.slice(0, 800) : String(stack).slice(0, 800)}
                {(typeof stack === 'string' ? stack.length : String(stack).length) > 800 ? '…' : ''}
              </pre>
            )}
            <p className="text-sm mb-6" style={{ color: colors.muted }}>Tap Reload to try again.</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
              className="px-6 py-3 rounded-xl font-medium transition-opacity active:opacity-90"
              style={{ background: colors.accent, color: '#fff' }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TRAINER_ROWS = [
  { label: 'Command center', icon: LayoutDashboard, path: '/command-center' },
  { label: 'Briefing', icon: FileText, path: '/briefing' },
  { label: 'Analytics', icon: TrendingUp, path: '/analytics' },
  { label: 'Daily closeout', icon: CheckSquare, path: '/closeout' },
  { label: 'Capacity', icon: BarChart3, path: '/capacity' },
  { label: 'Session calendar', icon: Calendar, path: '/calendar' },
  { label: 'Gym overview', icon: Building2, path: '/gym' },
  { label: 'Supplement stacks', icon: Pill, path: '/supplements/stacks' },
  { label: 'Competition Prep', icon: Award, path: '/comp-prep' },
  { label: 'Marketplace listing', icon: Store, path: '/marketplace-setup' },
  { label: 'Marketplace profile', icon: Store, path: '/marketplace-profile' },
  { label: 'Inquiry inbox', icon: Inbox, path: '/inquiry-inbox' },
  { label: 'Account', icon: UserCircle, path: '/account' },
  { label: 'Plan & Billing', icon: CreditCard, path: '/plan' },
  { label: 'Referrals', icon: Gift, path: '/referrals' },
  { label: 'Enquiries', icon: Inbox, path: '/enquiries' },
  { label: 'Result stories', icon: Trophy, path: '/results-stories/new' },
  { label: 'Organisation', icon: Building, path: '/organisation' },
  { label: 'Team', icon: UsersRound, path: '/team' },
  { label: 'Notification Center', icon: Bell, path: '/notifications' },
  { label: 'Notification settings', icon: MessageSquare, path: '/settings/notifications' },
  { label: 'Branding', icon: Image, path: '/settings/branding' },
  { label: 'Appearance', icon: Palette, page: 'Appearance' },
  { label: 'Help', icon: HelpCircle, page: 'HelpSupport' },
  { label: 'Consultations', icon: Phone, path: '/consultations' },
  { label: 'Onboarding link', icon: Link2, path: '/onboarding-link' },
  { label: 'Public link', icon: Link2, path: '/public-link' },
  { label: 'Services', icon: Package, path: '/services' },
  { label: 'Import clients', icon: Package, path: '/import-clients' },
  { label: 'Import program', icon: FileText, path: '/import-programs' },
  { label: 'Import bodyweight history', icon: Activity, path: '/import-bodyweight' },
  { label: 'Intake templates', icon: FileText, path: '/intake-templates' },
  { label: 'Leads', icon: Users, path: '/leads' },
];

/** DEV-only: Sandbox Tools sheet – Add Temp Client, Seed, Reset. */
function SandboxToolsSheet({ onClose, onAdded, getTrainerId, addClient: addClientFn, seedIfEmpty: seedFn, resetSandbox: resetFn }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('maintain');
  const [phase, setPhase] = useState('Maintenance');
  const [daysOut, setDaysOut] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const handleAddClient = () => {
    const full_name = (name || '').trim() || 'Temp Client';
    const trainerId = typeof getTrainerId === 'function' ? getTrainerId() : 'local-trainer';
    let showDate = null;
    if (daysOut.trim() !== '') {
      const n = parseInt(daysOut, 10);
      if (!isNaN(n) && n >= 0) {
        const d = new Date();
        d.setDate(d.getDate() + n);
        showDate = d.toISOString().slice(0, 10);
      }
    }
    addClientFn(trainerId, { full_name, goal, phase, showDate });
    toast.success('Client added');
    onAdded?.();
  };

  const handleSeed = () => {
    seedFn();
    toast.success('Sample data seeded');
    window.dispatchEvent(new Event('atlas-sandbox-updated'));
  };

  const handleResetConfirm = () => {
    resetFn();
    setResetConfirmOpen(false);
    toast.success('Sandbox reset');
    window.dispatchEvent(new Event('atlas-sandbox-updated'));
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: colors.bg }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Sandbox Tools</h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.accent }}>Close</button>
        </div>
        <div style={{ padding: spacing[16] }}>
          <p className="text-sm font-medium mb-2" style={{ color: colors.muted }}>Add temp client</p>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl py-2.5 px-3 mb-2 focus:outline-none focus:ring-1"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <div className="flex gap-2 mb-2">
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="flex-1 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              <option value="general">General</option>
              <option value="bulk">Bulk</option>
              <option value="cut">Cut</option>
              <option value="maintain">Maintain</option>
            </select>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="flex-1 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              <option value="Maintenance">Maintenance</option>
              <option value="Prep">Prep</option>
              <option value="Offseason">Offseason</option>
            </select>
          </div>
          <input
            placeholder="Days until show (optional)"
            type="number"
            min="0"
            value={daysOut}
            onChange={(e) => setDaysOut(e.target.value)}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <button
            type="button"
            onClick={handleAddClient}
            className="w-full py-3 rounded-xl font-medium mb-4"
            style={{ background: colors.accent, color: '#fff' }}
          >
            Add temp client
          </button>
          <button type="button" onClick={handleSeed} className="w-full py-3 rounded-xl font-medium mb-2 border" style={{ borderColor: colors.border, color: colors.text }}>
            Seed sample data
          </button>
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="w-full py-3 rounded-xl font-medium border"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            Reset sandbox
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset sandbox?"
        message="All local sandbox data will be cleared. This cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleResetConfirm}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}

function getCurrentPlanIdFromStorage() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_trainer_plan') : null;
    return raw || 'pro';
  } catch {
    return 'pro';
  }
}

function MoreContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openFeedback, openSupport } = useFeedbackModal();
  const { user: authUser, profile, logout, role: authRole, effectiveRole, setRole, setFakeSession, setRoleOverride, setCoachFocusOverride, canUseRoleSwitcher, hasCompetitionPrep, coachFocus, coachFocusOverride, supabaseSession } = useAuth();
  const isPlatformAdmin = profile?.is_admin === true || authUser?.email === ADMIN_EMAIL;
  const [achievementModalRecord, setAchievementModalRecord] = useState(null);
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [sandboxToolsOpen, setSandboxToolsOpen] = useState(false);
  const shownThisSessionRef = useRef(new Set());
  const dismissedMapRef = useRef(loadDismissedMilestones());
  const markAlertsSeenCalledRef = useRef(false);

  const displayUser = authUser;
  const userId = displayUser?.id ?? null;
  const trainerProfile = (isCoach(authRole) && userId) ? getTrainerProfile(userId) : null;
  const { canAccessTeam, isAssistant } = useTrainerPermissions();
  const clientForUser = userId ? getClientByUserId(userId) : null;
  const planId = getCurrentPlanIdFromStorage();
  const fallbackPlan = PLANS.find((p) => p.id === 'pro') || PLANS[0] || { id: 'pro', name: 'Pro', price: 0, commission: null };
  const currentPlan = PLANS.find((p) => p.id === planId) || fallbackPlan;
  const checkInsForUser = clientForUser ? getClientCheckIns(clientForUser.id) : [];
  const achievements = userId ? getAchievementsList(userId, { byUser: true }) : [];
  const shownIds = getShownAchievementIds();

  const { markAlertsSeen } = useAlertStatus(authUser);

  // Mark alerts seen once when we have a display user. Ref avoids re-running when markAlertsSeen identity changes.
  useEffect(() => {
    if (!userId) {
      markAlertsSeenCalledRef.current = false;
      return;
    }
    if (markAlertsSeenCalledRef.current) return;
    markAlertsSeenCalledRef.current = true;
    markAlertsSeen();
  }, [userId, markAlertsSeen]);

  useEffect(() => {
    if (!userId || isCoach(authRole)) return;
    const newlyUnlocked = evaluateUserMilestones(userId, checkInsForUser);
    if (!newlyUnlocked || shownIds.includes(newlyUnlocked.id)) return;
    dismissedMapRef.current = loadDismissedMilestones();
    if (!shouldShowMilestone(authRole, newlyUnlocked, dismissedMapRef.current, shownThisSessionRef.current)) return;
    shownThisSessionRef.current.add(makeMilestoneKey({
      userId: newlyUnlocked.userId ?? userId,
      clientId: newlyUnlocked.clientId,
      type: newlyUnlocked.milestoneId,
      value: newlyUnlocked.statImprovement,
      achievedAt: newlyUnlocked.unlockedAt,
    }));
    setAchievementModalRecord(newlyUnlocked);
  }, [userId, authRole, checkInsForUser.length]);

  const roleLabel = isCoach(effectiveRole) ? 'Coach' : isClient(effectiveRole) ? 'Client' : 'Personal';
  const isTrainer = isCoach(effectiveRole);
  const isSolo = isPersonal(effectiveRole);
  const showContent = !!displayUser;

  const handleRoleSwitcher = (viewRole) => {
    if (viewRole === 'admin') {
      impactLight();
      navigate('/admin', { replace: true });
      return;
    }
    if (viewRole !== 'coach' && viewRole !== 'client' && viewRole !== 'personal') return;
    setRoleOverride(viewRole);
    impactLight();
    navigate(roleHomePath(viewRole), { replace: true });
  };
  const handleUseActualRole = () => {
    setRoleOverride(null);
    impactLight();
    navigate(roleHomePath(authRole), { replace: true });
  };

  const handleRow = (item) => {
    if (item.path) navigate(item.path);
    else if (item.page) navigate(createPageUrl(item.page));
  };

  const handleDevRoleChange = (newRole) => {
    if (newRole !== 'coach' && newRole !== 'client' && newRole !== 'personal') return;
    setRole(newRole);
    setFakeSession(newRole, displayUser?.email || '');
  };

  // Single stable root: sign-in prompt when no user, content when ready. Never swap root tree.
  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={showContent ? pageContainer : undefined}>
      {!showContent ? (
        <Card style={{ ...standardCard, marginTop: spacing[24], padding: spacing[24], textAlign: 'center' }}>
          <p className="text-[17px] font-medium mb-2" style={{ color: colors.text }}>Please sign in</p>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>You need to sign in to view this screen.</p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-3 rounded-xl font-medium transition-opacity active:opacity-90"
            style={{ background: colors.accent, color: '#fff' }}
          >
            Go to login
          </button>
        </Card>
      ) : (
        <>
      <Card style={{ marginBottom: spacing[24] }}>
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0 overflow-hidden"
            style={{ background: colors.primarySubtle, color: colors.text }}
          >
            {trainerProfile?.profileImage ? (
              <img src={trainerProfile.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              (displayUser?.full_name || displayUser?.name || displayUser?.user_metadata?.full_name || '?').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold truncate" style={{ color: colors.text }}>
              {displayUser?.full_name || displayUser?.name || displayUser?.user_metadata?.full_name || 'User'}
            </p>
            <p className="text-sm truncate" style={{ color: colors.muted }}>{roleLabel}</p>
            {(displayUser?.email ?? displayUser?.user_metadata?.email) && (
              <p className="text-xs truncate mt-0.5" style={{ color: colors.muted }}>{displayUser?.email ?? displayUser?.user_metadata?.email}</p>
            )}
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: isTrainer ? colors.primarySubtle : authRole === 'client' ? colors.successSubtle : colors.surface1,
              color: isTrainer ? colors.accent : authRole === 'client' ? colors.success : colors.muted,
            }}
          >
            {roleLabel}
          </span>
        </div>
      </Card>

      {canUseRoleSwitcher && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Developer tools (testing)</p>
          <p className="text-xs mb-2" style={{ color: colors.muted }}>View as</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {['coach', 'client', 'personal', ...(isPlatformAdmin ? ['admin'] : [])].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleSwitcher(r)}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                style={{
                  background: (r === 'coach' ? (effectiveRole === 'coach' || effectiveRole === 'trainer') : r === 'client' || r === 'personal' ? effectiveRole === r : false) ? colors.primary : colors.surface1,
                  color: (r === 'coach' ? (effectiveRole === 'coach' || effectiveRole === 'trainer') : r === 'client' || r === 'personal' ? effectiveRole === r : false) ? '#fff' : colors.text,
                  border: r === 'admin' ? `1px solid ${colors.border}` : 'none',
                }}
              >
                {r === 'coach' ? 'Coach' : r === 'client' ? 'Client' : r === 'personal' ? 'Personal' : 'Admin'}
              </button>
            ))}
          </div>
          {isTrainer && setCoachFocusOverride && (
            <>
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Coach focus (when viewing as Coach)</p>
              <div className="flex flex-wrap gap-2">
                {['transformation', 'competition', 'integrated'].map((focus) => (
                  <button
                    key={focus}
                    type="button"
                    onClick={() => {
                      setCoachFocusOverride(focus);
                      impactLight();
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                    style={{
                      background: (coachFocusOverride ?? coachFocus) === focus ? colors.primary : colors.surface1,
                      color: (coachFocusOverride ?? coachFocus) === focus ? '#fff' : colors.text,
                      border: 'none',
                    }}
                  >
                    {focus.charAt(0).toUpperCase() + focus.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}
          {effectiveRole !== authRole && (
            <button
              type="button"
              onClick={handleUseActualRole}
              className="mt-2 text-sm font-medium"
              style={{ color: colors.muted, background: 'none', border: 'none' }}
            >
              Use my actual role ({authRole})
            </button>
          )}
        </Card>
      )}

      {isTrainer && !isAssistant && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[20], border: `1px solid ${colors.border}` }}>
          <div className="flex items-start gap-3">
            <span style={{ width: 44, height: 44, borderRadius: 12, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={22} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[17px] font-semibold mb-1" style={{ color: colors.text }}>Create Team</h3>
              <p className="text-sm mb-3" style={{ color: colors.muted }}>
                Organisation mode is for multi-coach teams, prep companies, and coaching brands. You become the owner and can invite more coaches later.
              </p>
              <button
                type="button"
                onClick={() => { impactLight(); navigate('/organisation/setup'); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-medium transition-opacity active:opacity-90"
                style={{ background: colors.primarySubtle, color: colors.primary, border: 'none' }}
              >
                <Building2 size={18} />
                Create Team
              </button>
            </div>
          </div>
        </Card>
      )}

      {isTrainer && !isAssistant && (
        <Row
          left={null}
          title="Edit Profile"
          showChevron={true}
          onPress={() => navigate('/editprofile')}
          style={{ marginBottom: spacing[8] }}
        />
      )}

      {isTrainer && !isAssistant && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>Current plan</p>
          <p className="text-[17px] font-semibold mb-1" style={{ color: colors.text }}>{currentPlan.name}</p>
          <p className="text-sm mb-3" style={{ color: colors.muted }}>
            {currentPlan.price === 0 ? `${CURRENCY}0` : `${CURRENCY}${currentPlan.price}`}/month
            {currentPlan.commission != null && ` · ${currentPlan.commission} commission`}
          </p>
          <button
            type="button"
            onClick={() => { impactLight(); navigate('/plan'); }}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-medium"
            style={{ background: colors.primarySubtle, color: colors.primary, border: 'none' }}
          >
            <Zap size={18} />
            Upgrade & manage billing
          </button>
        </Card>
      )}

      {isSolo && (
        <Row
          left={<Phone size={20} style={{ color: colors.muted }} />}
          title="Request consultation"
          showChevron={true}
          onPress={() => setConsultationModalOpen(true)}
          style={{ marginBottom: spacing[8] }}
        />
      )}

      {isSolo && (
        <Card style={{ marginBottom: sectionGap, padding: spacing[20], border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12], marginBottom: spacing[16] }}>
            <span style={{ width: 44, height: 44, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={22} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Find a Coach</h3>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>Discover coaches and get personalized programs, nutrition plans, and accountability.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { impactLight(); navigate('/discover'); }}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold transition-opacity active:opacity-90"
            style={{ background: colors.primary, color: '#fff', border: 'none' }}
          >
            Find a Coach
          </button>
        </Card>
      )}

      {authRole === 'client' && (
        <>
          <Row
            left={<Activity size={20} style={{ color: colors.muted }} />}
            title="Athlete dashboard"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/client-dashboard'); }}
            style={{ marginBottom: spacing[8] }}
          />
          <Row
            left={<Calendar size={20} style={{ color: colors.muted }} />}
            title="My sessions"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/client/sessions'); }}
            style={{ marginBottom: spacing[8] }}
          />
          <Row
            left={<Pill size={20} style={{ color: colors.muted }} />}
            title="My supplements"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/client/supplements'); }}
            style={{ marginBottom: spacing[8] }}
          />
          <Row
            left={<Dumbbell size={20} style={{ color: colors.muted }} />}
            title="Gym & equipment"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/settings/equipment'); }}
            style={{ marginBottom: spacing[8] }}
          />
        </>
      )}

      <div className="app-card overflow-hidden" style={{ marginBottom: spacing[24] }}>
        <Row
          left={<Trophy size={20} style={{ color: colors.muted }} />}
          title="Achievements"
          rightLabel={achievements.length > 0 ? `${achievements.length}` : null}
          showChevron={true}
          onPress={() => navigate('/achievements')}
        />
        <Row
          left={<MessageSquare size={20} style={{ color: colors.muted }} />}
          title="Send feedback"
          showChevron={true}
          onPress={() => { impactLight(); openFeedback(getRouteTitle(location.pathname)); }}
        />
        <Row
          left={<HelpCircle size={20} style={{ color: colors.muted }} />}
          title="Get help"
          showChevron={true}
          onPress={() => { impactLight(); openSupport(); }}
        />
        {isPlatformAdmin && (
          <Row
            left={<LayoutDashboard size={20} style={{ color: colors.muted }} />}
            title="Platform admin"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/admin'); }}
          />
        )}
        {!isTrainer && (
          <Row
            left={<Users size={20} style={{ color: colors.muted }} />}
            title="Find a Coach"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/discover'); }}
          />
        )}
        {TRAINER_ROWS.filter((item) => {
          if (item.path === '/team' && !canAccessTeam) return false;
          if (item.path === '/comp-prep' && (!hasCompetitionPrep || !shouldShowModule(coachFocus, 'comp_prep'))) return false;
          return true;
        }).map((item) => {
          const Icon = item.icon;
          return (
            <Row
              key={item.path || item.page}
              left={<Icon size={20} style={{ color: colors.muted }} />}
              title={item.label}
              showChevron={true}
              onPress={() => handleRow(item)}
            />
            );
        })}
      </div>

      <div className="app-card overflow-hidden">
        <button
          type="button"
          onClick={() => logout(true)}
          className="w-full flex items-center justify-between text-left active:opacity-90"
          style={{
            minHeight: 68,
            paddingLeft: spacing[16],
            paddingRight: spacing[16],
            background: 'transparent',
            border: 'none',
            borderTop: `1px solid ${colors.border}`,
            color: colors.destructive,
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          Log out
        </button>
      </div>

      {import.meta.env.DEV && (
        <>
          <div style={{ marginTop: spacing[24], paddingTop: spacing[16], borderTop: `1px solid ${colors.border}` }}>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Dev: Role</p>
            <div
              style={{
                display: 'flex',
                gap: 0,
                background: colors.surface1,
                borderRadius: 10,
                padding: 2,
              }}
            >
              {['coach', 'client', 'personal'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleDevRoleChange(r)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: 8,
                    background: authRole === r ? colors.primarySubtle : 'transparent',
                    color: authRole === r ? colors.text : colors.muted,
                    textTransform: 'capitalize',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <Row
              left={<Zap size={20} style={{ color: colors.muted }} />}
              title="Sandbox Tools"
              onPress={() => setSandboxToolsOpen(true)}
              style={{ marginTop: spacing[12] }}
            />
          </div>
          {sandboxToolsOpen && (
            <SandboxToolsSheet
              onClose={() => setSandboxToolsOpen(false)}
              onAdded={() => { setSandboxToolsOpen(false); window.dispatchEvent(new Event('atlas-sandbox-updated')); }}
              getTrainerId={() => getTrainerId(supabaseSession)}
              addClient={addClient}
              seedIfEmpty={seedIfEmpty}
              resetSandbox={resetSandbox}
            />
          )}
        </>
      )}

      {achievementModalRecord && (
        <AchievementUnlockedModal
          record={achievementModalRecord}
          onClose={() => {
            const r = achievementModalRecord;
            const key = makeMilestoneKey({
              userId: r.userId ?? userId,
              clientId: r.clientId,
              type: r.milestoneId,
              value: r.statImprovement,
              achievedAt: r.unlockedAt,
            });
            markMilestoneDismissed(key);
            setAchievementModalRecord(null);
          }}
        />
      )}
      {consultationModalOpen && (
        <RequestConsultationModal
          onClose={() => setConsultationModalOpen(false)}
          userId={displayUser?.id}
          userName={displayUser?.full_name || displayUser?.name || displayUser?.user_metadata?.full_name}
          userEmail={displayUser?.email ?? displayUser?.user_metadata?.email}
        />
      )}
        </>
      )}
    </div>
  );
}

export default function More() {
  return (
    <MoreErrorBoundary>
      <MoreContent />
    </MoreErrorBoundary>
  );
}
