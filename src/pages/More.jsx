import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isInternalAdmin } from '@/lib/internalAccess';
import { useAlertStatus } from '@/components/hooks/useAlertStatus';
import { UserCircle, MessageSquare, Palette, HelpCircle, Trophy, Phone, Link2, Users, CheckSquare, Award, BarChart3, TrendingUp, FileText, Image, CreditCard, UsersRound, Package, RefreshCw, Zap, Store, Inbox, Bell, Gift, Calendar, Building2, Activity, LayoutDashboard, ChevronRight, UtensilsCrossed, Crosshair, UserPlus, Send, ClipboardList, Dumbbell, LineChart, Target, Share2 } from 'lucide-react';
import { seedIfEmpty, resetSandbox, addClient } from '@/lib/sandboxStore';
import { getTrainerId } from '@/lib/getTrainerId';
import { getClientByUserId, getClientCheckIns } from '@/data/selectors';
import { getTrainerProfile } from '@/lib/trainerFoundation/trainerProfileRepo';
import { PLANS, PLAN_TIER_IDS } from '@/config/plans';
import { getAchievementsList, getShownAchievementIds } from '@/lib/milestonesStore';
import { evaluateUserMilestones } from '@/lib/milestoneEngine';
import {
  loadDismissedMilestones,
  markMilestoneDismissed,
  makeMilestoneKey,
  shouldShowMilestone,
} from '@/lib/milestoneDismissedStore';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';
import { isCoach, isClient, isPersonal } from '@/lib/roles';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Row from '@/ui/Row';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import AchievementUnlockedModal from '@/components/achievements/AchievementUnlockedModal';
import RequestConsultationModal from '@/components/consultation/RequestConsultationModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { personalMoreHubHelperText, personalPlanBadgeLabel } from '@/lib/personalAccountUx';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { usePresentationMode } from '@/lib/presentationMode';
import PersonalMoreDesktopLayout from '@/components/personal/PersonalMoreDesktopLayout';
import { deriveMorePageSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { showCoachManualClientAcquisitionTools } from '@/lib/coachClientAcquisition';

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

function MoreContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openFeedback, openSupport } = useFeedbackModal();
  const {
    user: authUser,
    profile,
    logout,
    role: authRole,
    effectiveRole,
    setRole,
    setFakeSession,
    supabaseSession,
    resolvedAccess,
    supabaseUser,
    isDemoMode,
    isAdminBypass,
  } = useAuth();
  const showManualClientTools = showCoachManualClientAcquisitionTools({
    isDemoMode,
    isAdminBypass,
    profile,
    supabaseUser,
  });
  const isPlatformAdmin = isInternalAdmin(supabaseUser);
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
  const planId = resolvedAccess?.coachPlanTier || 'basic';
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

  /** Keep localStorage in sync with DB so Trainer Plan + permissions match onboarding. */
  useEffect(() => {
    const t = (profile?.plan_tier ?? displayUser?.plan_tier ?? '').toString().toLowerCase().trim();
    if (!PLAN_TIER_IDS.includes(t) || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('atlas_trainer_plan', t);
    } catch {
      // ignore
    }
  }, [profile?.plan_tier, displayUser?.plan_tier]);

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

  const { isWideWeb } = usePresentationMode();
  const roleLabel = isCoach(effectiveRole) ? 'Coach' : isClient(effectiveRole) ? 'Client' : 'Personal';
  const isTrainer = resolvedAccess?.isCoach ?? isCoach(effectiveRole);
  const isSolo = resolvedAccess?.isPersonal ?? isPersonal(effectiveRole);
  const showContent = !!displayUser;

  const coachFocusEffective = resolvedAccess?.coachFocus || 'transformation';
  const personalTier = resolvedAccess?.personalPlanTier || 'basic';
  const realRoleKey = isCoach(effectiveRole) ? 'coach' : isClient(effectiveRole) ? 'client' : 'personal';
  const [previewRole, setPreviewRole] = useState(() => (isPlatformAdmin ? realRoleKey : null));
  const [previewCoachSubtype, setPreviewCoachSubtype] = useState(() => String(coachFocusEffective || 'transformation'));
  const [previewCoachTier, setPreviewCoachTier] = useState(() => String(planId || 'basic'));
  const [previewClientSubtype, setPreviewClientSubtype] = useState(() => String(resolvedAccess?.clientDeliveryContext || 'transformation'));
  const [previewPersonalTier, setPreviewPersonalTier] = useState(() => String(personalTier || 'basic'));

  useEffect(() => {
    if (!isPlatformAdmin) return;
    setPreviewRole(realRoleKey);
    setPreviewCoachSubtype(String(coachFocusEffective || 'transformation'));
    setPreviewCoachTier(String(planId || 'basic'));
    setPreviewClientSubtype(String(resolvedAccess?.clientDeliveryContext || 'transformation'));
    setPreviewPersonalTier(String(personalTier || 'basic'));
  }, [isPlatformAdmin, realRoleKey, coachFocusEffective, planId, resolvedAccess?.clientDeliveryContext, personalTier]);

  const handleDevRoleChange = (newRole) => {
    if (newRole !== 'coach' && newRole !== 'client' && newRole !== 'personal') return;
    setRole(newRole);
    setFakeSession(newRole, displayUser?.email || '');
  };


  const previewIdentityLine = useMemo(() => {
    if (!isPlatformAdmin) return roleLabel;
    if (previewRole === 'coach') {
      return `Coach · ${previewCoachSubtype.charAt(0).toUpperCase() + previewCoachSubtype.slice(1)} · ${String(previewCoachTier || 'basic').toUpperCase()}`;
    }
    if (previewRole === 'client') {
      return `Client · ${previewClientSubtype.charAt(0).toUpperCase() + previewClientSubtype.slice(1)}`;
    }
    if (previewRole === 'personal') {
      return `Personal · ${previewPersonalTier === 'enhanced' ? 'Enhanced' : 'Basic'}`;
    }
    return 'Admin / Owner';
  }, [isPlatformAdmin, previewRole, previewCoachSubtype, previewCoachTier, previewClientSubtype, previewPersonalTier, roleLabel]);

  const previewModeActive = isPlatformAdmin && previewRole && previewRole !== realRoleKey;
  const activePreviewRole = isPlatformAdmin ? previewRole : realRoleKey;
  /** Website shell: wide Personal More uses sidebar + sections (not mobile list). */
  const showPersonalMoreDesktop =
    isWideWeb && activePreviewRole === 'personal' && (isSolo || isPlatformAdmin);
  const personalTierEffective =
    isPlatformAdmin && activePreviewRole === 'personal' ? previewPersonalTier : personalTier;
  const personalTierLabelDesktop = personalTierEffective === 'enhanced' ? 'Enhanced' : 'Basic';
  const isBasicTierDesktop = personalTierEffective !== 'enhanced';

  const renderRolePreviewMenus = () => {
    const menuRow = (icon, title, subtitle, to) => (
      <Row
        left={icon}
        title={title}
        subtitle={subtitle}
        showChevron
        onPress={() => {
          impactLight();
          if (to) navigate(to);
        }}
      />
    );

    if (activePreviewRole === 'coach') {
      const prepCoachSurfaces =
        isPlatformAdmin && previewRole === 'coach'
          ? previewCoachSubtype === 'competition' || previewCoachSubtype === 'integrated'
          : !!resolvedAccess?.hasCompetitionPrep;
      return (
        <>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Growth
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<UserPlus size={20} style={{ color: colors.muted }} />, 'Get Clients', 'Invite link, code, and pending joins', '/get-clients')}
            {menuRow(<Store size={20} style={{ color: colors.muted }} />, 'Marketplace Setup', 'Discovery profile, pricing, go public', '/marketplace-setup')}
            {menuRow(<Link2 size={20} style={{ color: colors.muted }} />, 'Onboarding link', 'Coach signup and onboarding entry', '/onboarding-link')}
            {menuRow(<Send size={20} style={{ color: colors.muted }} />, 'Public link', 'Shareable entry without full onboarding', '/public-link')}
            {menuRow(<Inbox size={20} style={{ color: colors.muted }} />, 'Enquiries', 'Inbound questions from athletes', '/enquiries')}
            {menuRow(<Share2 size={20} style={{ color: colors.muted }} />, 'Referrals', 'Share Atlas and track referrals', '/referrals')}
            {menuRow(<Image size={20} style={{ color: colors.muted }} />, 'Result stories', 'Before/after and social proof', '/results-stories/new')}
            {showManualClientTools
              ? menuRow(
                  <Package size={20} style={{ color: colors.muted }} />,
                  'Client import (dev / admin)',
                  'CSV migration — not a production roster path',
                  '/import-clients'
                )
              : null}
          </div>

          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Coaching
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<CheckSquare size={20} style={{ color: colors.muted }} />, 'Review Queue', 'Prioritized triage, filters, and sort', '/review-center')}
            {menuRow(<FileText size={20} style={{ color: colors.muted }} />, 'Programs', 'Program library and templates', '/programs')}
            {menuRow(<UtensilsCrossed size={20} style={{ color: colors.muted }} />, 'Nutrition plans', 'Per-client nutrition plans', '/trainer/nutrition')}
            {menuRow(<ClipboardList size={20} style={{ color: colors.muted }} />, 'Check-in templates', 'Templates coaches send to clients', '/checkintemplates')}
            {menuRow(<Phone size={20} style={{ color: colors.muted }} />, 'Services', 'Offers and service packages', '/services')}
            {menuRow(<Zap size={20} style={{ color: colors.muted }} />, 'Training Intelligence', 'Workload and automation signals', '/trainingintelligence')}
            {menuRow(<Activity size={20} style={{ color: colors.muted }} />, 'Capacity', 'Roster load and limits', '/capacity')}
          </div>

          {prepCoachSurfaces ? (
            <>
              <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
                  Comp prep
                </p>
              </Card>
              <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
                {menuRow(<Award size={20} style={{ color: colors.muted }} />, 'Prep command center', 'Roster prep overview and timeline', '/prep-dashboard')}
                {menuRow(<Crosshair size={20} style={{ color: colors.muted }} />, 'Prep library & tools', 'Poses, photo guide, media, reviews', '/comp-prep')}
                {menuRow(<Calendar size={20} style={{ color: colors.muted }} />, 'Peak Week', 'Command center and dashboards', '/peak-week-dashboard')}
                {menuRow(<LineChart size={20} style={{ color: colors.muted }} />, 'Prep comparison', 'Side-by-side prep views', '/prep-comparison')}
                {menuRow(<LayoutDashboard size={20} style={{ color: colors.muted }} />, 'Peak Week command center', 'Peak-week operations hub', '/peak-week-command-center')}
              </div>
            </>
          ) : null}

          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Business
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<CreditCard size={20} style={{ color: colors.muted }} />, 'Earnings', 'Subscriptions, payouts, invoices', '/earnings')}
            {menuRow(<TrendingUp size={20} style={{ color: colors.muted }} />, 'Revenue', 'Expected and collected revenue', '/revenue')}
            {menuRow(<LineChart size={20} style={{ color: colors.muted }} />, 'Revenue analytics', 'Trends and cohort views', '/revenue-analytics')}
            {menuRow(<BarChart3 size={20} style={{ color: colors.muted }} />, 'Analytics', 'Coaching and roster signals', '/analytics')}
            {menuRow(<Building2 size={20} style={{ color: colors.muted }} />, 'Organisation', 'Org dashboard and setup', '/organisation')}
            {menuRow(<UsersRound size={20} style={{ color: colors.muted }} />, 'Team', 'Seats and permissions', '/team')}
            {menuRow(<Gift size={20} style={{ color: colors.muted }} />, 'Plan & billing', 'Subscription and upgrades', '/plan')}
            {menuRow(<Inbox size={20} style={{ color: colors.muted }} />, 'Leads', 'Lead pipeline', '/leads')}
            {menuRow(<Calendar size={20} style={{ color: colors.muted }} />, 'Consultations', 'Booking and consult offers', '/consultations')}
          </div>

          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Account
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<UserCircle size={20} style={{ color: colors.muted }} />, 'Profile', 'Photo, name, and preferences', '/profile-account')}
            {menuRow(<Palette size={20} style={{ color: colors.muted }} />, 'Settings', 'Account, appearance, and security', '/settings/account')}
            {menuRow(<Bell size={20} style={{ color: colors.muted }} />, 'Notifications', 'Alerts and delivery settings', '/notifications')}
            {menuRow(<HelpCircle size={20} style={{ color: colors.muted }} />, 'Help & support', 'Get help and contact support', '/helpsupport')}
          </div>
        </>
      );
    }
    if (activePreviewRole === 'client') {
      return (
        <>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Coaching
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<Dumbbell size={20} style={{ color: colors.muted }} />, 'Training plan', 'Your assigned program', '/myprogram')}
            {menuRow(<UtensilsCrossed size={20} style={{ color: colors.muted }} />, 'Nutrition plan', 'Targets and daily fuel', '/nutrition')}
            {menuRow(<ClipboardList size={20} style={{ color: colors.muted }} />, 'Check-ins', 'Submit and review check-ins', '/clientcheckin')}
            {menuRow(<TrendingUp size={20} style={{ color: colors.muted }} />, 'Progress', 'Trends and milestones', '/progress')}
            {menuRow(<CheckSquare size={20} style={{ color: colors.muted }} />, 'Habits', 'Daily habit tracking', '/habits-daily')}
          </div>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Communication
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<MessageSquare size={20} style={{ color: colors.muted }} />, 'Messages', 'Chat with your coach', '/messages')}
            {menuRow(<Users size={20} style={{ color: colors.muted }} />, 'My coach', 'Coach relationship and contact', '/my-trainer')}
          </div>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Account
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<UserCircle size={20} style={{ color: colors.muted }} />, 'Profile', 'Your profile and preferences', '/profile-account')}
            {menuRow(<Palette size={20} style={{ color: colors.muted }} />, 'Settings', 'Account and app settings', '/settings/account')}
            {menuRow(<Bell size={20} style={{ color: colors.muted }} />, 'Notifications', 'Alerts and delivery settings', '/notifications')}
          </div>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Support
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<HelpCircle size={20} style={{ color: colors.muted }} />, 'Help & support', 'Get help and contact support', '/helpsupport')}
            {menuRow(<CheckSquare size={20} style={{ color: colors.muted }} />, 'Check-in preferences', 'Daily check-in settings', '/check-in')}
          </div>
        </>
      );
    }
    if (activePreviewRole === 'admin') {
      return (
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<UserCircle size={20} style={{ color: colors.muted }} />, 'Account & settings', 'Owner account preferences', '/profile-account')}
          {menuRow(<Bell size={20} style={{ color: colors.muted }} />, 'Notifications', 'Owner notification center', '/notifications')}
          {menuRow(<HelpCircle size={20} style={{ color: colors.muted }} />, 'Help & support', 'Support and reporting', '/helpsupport')}
        </div>
      );
    }
    if (showPersonalMoreDesktop) return null;
    return (
      <>
        <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
            Training
          </p>
        </Card>
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<Calendar size={20} style={{ color: colors.muted }} />, 'Today', 'Today’s session and plan', '/today')}
          {menuRow(<Dumbbell size={20} style={{ color: colors.muted }} />, 'My program', 'Blocks and training plan', '/myprogram')}
          {menuRow(<FileText size={20} style={{ color: colors.muted }} />, 'Program builder', 'Edit your personal program', '/program-builder?personal=1')}
        </div>
        <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
            Nutrition
          </p>
        </Card>
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<UtensilsCrossed size={20} style={{ color: colors.muted }} />, 'Nutrition', 'Logging and daily fuel', '/nutrition')}
          {menuRow(<Target size={20} style={{ color: colors.muted }} />, 'Nutrition targets', 'Calories and macros', '/nutrition-targets')}
        </div>
        <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
            Progress
          </p>
        </Card>
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<ClipboardList size={20} style={{ color: colors.muted }} />, 'Daily check-in', 'Readiness and recovery', '/readiness-checkin')}
          {menuRow(<TrendingUp size={20} style={{ color: colors.muted }} />, 'Progress', 'Trends and consistency', '/progress')}
          {menuRow(<Image size={20} style={{ color: colors.muted }} />, 'Progress photos', 'Photo check-ins', '/progressphotos')}
          {menuRow(<CheckSquare size={20} style={{ color: colors.muted }} />, 'Check-ins', 'History and templates', '/checkins')}
        </div>
        <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
            Account
          </p>
        </Card>
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<Users size={20} style={{ color: colors.muted }} />, 'Work with a coach', 'Browse coaches and matching', '/personal/coach-transition')}
          {menuRow(<UserCircle size={20} style={{ color: colors.muted }} />, 'Profile', 'Goals, units, and preferences', '/profile-account')}
          {menuRow(<Palette size={20} style={{ color: colors.muted }} />, 'Settings', 'Account and app settings', '/settings/account')}
          {menuRow(<Bell size={20} style={{ color: colors.muted }} />, 'Notifications', 'Activity and alerts', '/notifications')}
          {menuRow(<Trophy size={20} style={{ color: colors.muted }} />, 'Achievements', 'Milestones and unlocks', '/achievements')}
          {menuRow(<HelpCircle size={20} style={{ color: colors.muted }} />, 'Help & support', 'Get help and contact support', '/helpsupport')}
        </div>
      </>
    );
  };

  const moreMigration = useMemo(
    () =>
      deriveMorePageSurfaceState({
        signedIn: showContent,
        activeRoleKey: activePreviewRole,
        adminPreview: previewModeActive,
      }),
    [showContent, activePreviewRole, previewModeActive]
  );

  // Single stable root: sign-in prompt when no user, content when ready. Never swap root tree.
  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      {...atlasMigrationDataAttributes(moreMigration.phase, moreMigration.primary)}
      style={showContent ? pageContainer : undefined}
    >
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
        <PersonalSurface variant={showPersonalMoreDesktop ? 'home' : 'default'}>
        <>
      {!showPersonalMoreDesktop ? (
        <>
      <Card style={{ marginBottom: spacing[12], padding: spacing[16] }}>
        <p className="text-[20px] font-semibold" style={{ color: colors.text }}>More</p>
        <p className="text-sm mt-1" style={{ color: colors.muted }}>
          {isPlatformAdmin
            ? 'Preview role wrappers and manage platform controls'
            : 'Directory for tools, settings, and profile — same app, role-specific shortcuts'}
        </p>
      </Card>

      <Card
        style={{
          marginBottom: spacing[16],
          ...(isPlatformAdmin || isSolo ? {} : { cursor: 'pointer' }),
        }}
        onClick={
          isSolo || isPlatformAdmin
            ? undefined
            : () => {
                impactLight();
                navigate('/profile-account');
              }
        }
      >
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0 overflow-hidden"
            style={{ background: colors.primarySubtle, color: colors.text }}
          >
            {trainerProfile?.profileImage ? (
              <img src={trainerProfile.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              (profile?.full_name || profile?.display_name || displayUser?.full_name || displayUser?.name || displayUser?.user_metadata?.full_name || '?').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold truncate" style={{ color: colors.text }}>
              {profile?.full_name || profile?.display_name || displayUser?.full_name || displayUser?.name || displayUser?.user_metadata?.full_name || 'Your profile'}
            </p>
            <p className="text-sm truncate" style={{ color: colors.muted }}>{previewIdentityLine}</p>
            {(displayUser?.email ?? displayUser?.user_metadata?.email) && (
              <p className="text-xs truncate mt-0.5" style={{ color: colors.muted }}>{displayUser?.email ?? displayUser?.user_metadata?.email}</p>
            )}
            {activePreviewRole === 'personal' && (
              <p className="text-xs mt-1.5 font-semibold" style={{ color: colors.primary }}>
                {isPlatformAdmin
                  ? (previewPersonalTier === 'enhanced' ? 'Enhanced' : 'Basic')
                  : personalPlanBadgeLabel({ profile, user: displayUser })}
              </p>
            )}
          </div>
          {previewModeActive ? (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: colors.primarySubtle, color: colors.primary }}>
              Preview mode
            </span>
          ) : !isSolo && (
            <div className="shrink-0 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: isTrainer ? colors.primarySubtle : authRole === 'client' ? colors.successSubtle : colors.surface1,
                  color: isTrainer ? colors.accent : authRole === 'client' ? colors.success : colors.muted,
                }}
              >
                {roleLabel}
              </span>
              <ChevronRight size={16} style={{ color: colors.muted }} />
            </div>
          )}
        </div>
        {activePreviewRole === 'personal' ? (
          <p className="text-xs mt-3 leading-relaxed" style={{ color: colors.muted }}>
            {personalMoreHubHelperText({ profile, user: displayUser })}
          </p>
        ) : (
          <p className="text-xs mt-2" style={{ color: colors.primary, fontWeight: 600 }}>
            Edit profile
          </p>
        )}
      </Card>
        </>
      ) : activePreviewRole === 'personal' ? (
        <Card style={{ marginBottom: spacing[16], padding: spacing[14] }}>
          <p className="text-[18px] font-semibold m-0" style={{ color: colors.text }}>Account</p>
          <p className="text-sm mt-1 m-0" style={{ color: colors.muted }}>
            {isPlatformAdmin ? 'Preview as Personal · manage platform controls below' : 'Settings and preferences'}
          </p>
        </Card>
      ) : null}

      {isPlatformAdmin ? (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <p className="text-xs font-semibold mb-2" style={{ color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Role preview
          </p>
          <p className="text-xs mb-2" style={{ color: colors.muted }}>Preview wrapper as</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {['coach', 'client', 'personal', 'admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPreviewRole(r)}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                style={{
                  background: previewRole === r ? colors.primary : colors.surface1,
                  color: previewRole === r ? '#fff' : colors.text,
                  border: 'none',
                }}
              >
                {r === 'coach' ? 'Coach' : r === 'client' ? 'Client' : r === 'personal' ? 'Personal' : 'Admin'}
              </button>
            ))}
          </div>

          {previewRole === 'coach' && (
            <>
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Coach subtype</p>
              <div className="flex flex-wrap gap-2">
                {['transformation', 'competition', 'integrated'].map((focus) => (
                  <button
                    key={focus}
                    type="button"
                    onClick={() => setPreviewCoachSubtype(focus)}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                    style={{
                      background: previewCoachSubtype === focus ? colors.primary : colors.surface1,
                      color: previewCoachSubtype === focus ? '#fff' : colors.text,
                      border: 'none',
                    }}
                  >
                    {focus.charAt(0).toUpperCase() + focus.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs font-medium mt-4 mb-2" style={{ color: colors.muted }}>Coach tier</p>
              <div className="flex flex-wrap gap-2">
                {PLAN_TIER_IDS.map((tierId) => (
                  <button
                    key={tierId}
                    type="button"
                    onClick={() => setPreviewCoachTier(tierId)}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                    style={{
                      background: previewCoachTier === tierId ? colors.primary : colors.surface1,
                      color: previewCoachTier === tierId ? '#fff' : colors.text,
                    }}
                  >
                    {tierId.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}

          {previewRole === 'client' && (
            <>
              <p className="text-xs font-medium mt-4 mb-2" style={{ color: colors.muted }}>Client subtype</p>
              <div className="flex flex-wrap gap-2">
                {['transformation', 'competition'].map((ctx) => (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => setPreviewClientSubtype(ctx)}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                    style={{
                      background: previewClientSubtype === ctx ? colors.primary : colors.surface1,
                      color: previewClientSubtype === ctx ? '#fff' : colors.text,
                      border: 'none',
                    }}
                  >
                    {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}

          {previewRole === 'personal' && (
            <>
              <p className="text-xs font-medium mt-4 mb-2" style={{ color: colors.muted }}>Personal tier</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'basic', label: 'Basic' },
                  { id: 'enhanced', label: 'Enhanced' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewPersonalTier(t.id)}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90"
                    style={{
                      background: previewPersonalTier === t.id ? colors.primary : colors.surface1,
                      color: previewPersonalTier === t.id ? '#fff' : colors.text,
                      border: 'none',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {previewModeActive && (
            <button
              type="button"
              onClick={() => setPreviewRole(realRoleKey)}
              className="mt-2 text-sm font-medium"
              style={{ color: colors.muted, background: 'none', border: 'none' }}
            >
              Use my real role
            </button>
          )}
        </Card>
      ) : null}

      {renderRolePreviewMenus()}

      {showPersonalMoreDesktop && activePreviewRole === 'personal' ? (
        <PersonalMoreDesktopLayout
          displayUser={displayUser}
          profile={profile}
          trainerProfile={trainerProfile}
          personalTierLabel={personalTierLabelDesktop}
          isBasicTier={isBasicTierDesktop}
          onUpgrade={() => navigate('/pricing')}
          previewIdentityLine={previewIdentityLine}
          previewModeActive={previewModeActive}
          navigate={navigate}
          onOpenConsultation={() => setConsultationModalOpen(true)}
          onLogout={logout}
        />
      ) : null}

      {isPlatformAdmin ? (
        <Card style={{ marginBottom: spacing[12], padding: spacing[12], border: `1px solid ${colors.border}`, background: colors.surface2 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Owner tools</p>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: colors.primarySubtle, color: colors.primary }}>Internal only</span>
          </div>
          <div className="app-card overflow-hidden">
            <Row left={<LayoutDashboard size={20} style={{ color: colors.muted }} />} title="Platform admin" showChevron onPress={() => navigate('/admin')} />
            <Row left={<Zap size={20} style={{ color: colors.muted }} />} title="Sandbox tools" showChevron onPress={() => setSandboxToolsOpen(true)} />
            <Row left={<Building2 size={20} style={{ color: colors.muted }} />} title="Navigation audit" showChevron onPress={() => navigate('/navigation-audit')} />
            <Row left={<Users size={20} style={{ color: colors.muted }} />} title="Role select (internal)" showChevron onPress={() => navigate('/role-select')} />
          </div>
          <div style={{ marginTop: spacing[10] }}>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Dev role switcher (real)</p>
            <div style={{ display: 'flex', gap: 0, background: colors.surface1, borderRadius: 10, padding: 2 }}>
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
          </div>
        </Card>
      ) : null}

      {!(showPersonalMoreDesktop && activePreviewRole === 'personal') ? (
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
      ) : null}

      {isPlatformAdmin && sandboxToolsOpen && (
        <SandboxToolsSheet
          onClose={() => setSandboxToolsOpen(false)}
          onAdded={() => { setSandboxToolsOpen(false); window.dispatchEvent(new Event('atlas-sandbox-updated')); }}
          getTrainerId={() => getTrainerId(supabaseSession)}
          addClient={addClient}
          seedIfEmpty={seedIfEmpty}
          resetSandbox={resetSandbox}
        />
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
        </PersonalSurface>
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
