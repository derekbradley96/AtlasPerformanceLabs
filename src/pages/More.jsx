import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useAlertStatus } from '@/components/hooks/useAlertStatus';
import { UserCircle, Palette, HelpCircle, Trophy, Phone, Users, Award, TrendingUp, FileText, Image, CreditCard, UsersRound, Package, RefreshCw, Zap, Store, Bell, Gift, Calendar, Building2, LayoutDashboard, ChevronRight, UtensilsCrossed, Crosshair, UserPlus, ClipboardList, Dumbbell, LineChart, Target, Share2, UserMinus, Clock, Inbox, Pill } from 'lucide-react';
import { seedIfEmpty, resetSandbox, addClient } from '@/lib/sandboxStore';
import { getTrainerId } from '@/lib/getTrainerId';
import { getTrainerProfile } from '@/lib/trainerFoundation/trainerProfileRepo';
import { PLANS, PLAN_TIER_IDS, isEliteTier, resolveCoachPlanTier } from '@/config/plans';
import { getAchievementsList, getShownAchievementIds } from '@/lib/milestonesStore';
import { evaluateUserMilestones } from '@/lib/milestoneEngine';
import {
  loadDismissedMilestones,
  markMilestoneDismissed,
  makeMilestoneKey,
  shouldShowMilestone,
} from '@/lib/milestoneDismissedStore';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';
import { isCoach, isClient, isPersonal, displayRoleLabel } from '@/lib/roles';
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
import { personalMoreHubHelperText } from '@/lib/personalAccountUx';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { usePresentationMode } from '@/lib/presentationMode';
import PersonalMoreDesktopLayout from '@/components/personal/PersonalMoreDesktopLayout';
import { deriveMorePageSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { showCoachManualClientAcquisitionTools } from '@/lib/coachClientAcquisition';
import { copyReferralLinkToClipboard, getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { leaveCoach } from '@/lib/clientCoachRelationship';

const CLIENT_LEAVE_REASON_OPTIONS = [
  "I've completed my goals with this coach",
  'I want to find a different coach',
  "I'm taking a break from coached training",
  "The coaching style isn't right for me",
  "I can't afford coaching right now",
  'I had a negative experience',
  'Other',
];

const MORE_SCROLL_KEY = 'atlas_more_scroll_pos';

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
  const { setHeaderTitle } = useOutletContext() || {};
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();
  const { openFeedback, openSupport } = useFeedbackModal();
  const {
    user: authUser,
    profile,
    signOut,
    role: authRole,
    effectiveRole,
    selectRole,
    setFakeSession,
    supabaseSession,
    resolvedAccess,
    isAdmin,
    isDemoMode,
    isAdminBypass,
    clientLinkedRow,
    refreshProfile,
  } = useAuth();
  const showManualClientTools = showCoachManualClientAcquisitionTools({
    isDemoMode,
    isAdminBypass,
    profile,
    isAdmin,
  });
  const isPlatformAdmin = isAdmin;
  const [achievementModalRecord, setAchievementModalRecord] = useState(null);
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [sandboxToolsOpen, setSandboxToolsOpen] = useState(false);
  const [leaveCoachSheetOpen, setLeaveCoachSheetOpen] = useState(false);
  const [leaveCoachReason, setLeaveCoachReason] = useState('');
  const [leaveCoachReasonDetail, setLeaveCoachReasonDetail] = useState('');
  const [isLeavingCoach, setIsLeavingCoach] = useState(false);
  const shownThisSessionRef = useRef(new Set());
  const dismissedMapRef = useRef(loadDismissedMilestones());
  const markAlertsSeenCalledRef = useRef(false);

  const displayUser = authUser;
  const userId = displayUser?.id ?? null;
  const trainerProfile = (isCoach(authRole) && userId) ? getTrainerProfile(userId) : null;
  const { canAccessTeam, isAssistant } = useTrainerPermissions();
  const planId = resolvedAccess?.coachPlanTier || 'basic';
  const fallbackPlan = PLANS.find((p) => p.id === 'pro') || PLANS[0] || { id: 'pro', name: 'Pro', price: 0, commission: null };
  const currentPlan = PLANS.find((p) => p.id === planId) || fallbackPlan;
  const rosterClientId = clientLinkedRow?.id ?? null;
  const { data: checkInsForUser = [] } = useQuery({
    queryKey: ['more-my-checkins', rosterClientId],
    queryFn: async () => {
      if (!hasSupabase || !rosterClientId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('checkins')
        .select('id, submitted_at, status, coach_reviewed_at')
        .eq('client_id', rosterClientId)
        .order('submitted_at', { ascending: false })
        .limit(10);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(hasSupabase && rosterClientId && !isCoach(authRole)),
    staleTime: 5 * 60 * 1000,
  });
  const achievements = userId ? getAchievementsList(userId, { byUser: true }) : [];
  const shownIds = getShownAchievementIds();

  const { markAlertsSeen } = useAlertStatus(authUser);
  const linkedCoachId = clientLinkedRow?.coach_id || clientLinkedRow?.trainer_id || null;
  const linkedClientId = clientLinkedRow?.id || null;
  const { data: linkedCoachProfile } = useQuery({
    queryKey: ['linked-coach-profile', linkedCoachId],
    queryFn: async () => {
      if (!hasSupabase || !linkedCoachId) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, display_name')
        .eq('id', linkedCoachId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: Boolean(linkedCoachId),
  });
  const linkedCoachName = linkedCoachProfile?.full_name || linkedCoachProfile?.display_name || 'your coach';
  const leaveReasonNeedsDetails = leaveCoachReason === 'Other' || leaveCoachReason === 'I had a negative experience';

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      sessionStorage.setItem(MORE_SCROLL_KEY, String(el.scrollTop));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      handleScroll();
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(MORE_SCROLL_KEY);
    if (!saved || !scrollRef.current) return;
    const pos = Number(saved);
    if (Number.isFinite(pos) && pos > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: pos });
      });
    }
  }, [location.key]);

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
  const roleLabel = displayRoleLabel(effectiveRole);
  const isTrainer = resolvedAccess?.isCoach ?? isCoach(effectiveRole);
  const isSolo = resolvedAccess?.isPersonal ?? isPersonal(effectiveRole);
  const showContent = !!displayUser;

  const coachFocusEffective = resolvedAccess?.coachFocus || 'transformation';
  const personalTier = resolvedAccess?.personalPlanTier || 'basic';
  const realRoleKey = isCoach(effectiveRole) ? 'coach' : isClient(effectiveRole) ? 'client' : 'personal';

  // Admin: really switch the account role (profiles.role + reload) — the old
  // card only previewed this page's menus, which read as "does nothing".
  const [switchingRole, setSwitchingRole] = useState(false);
  const handleRealRoleSwitch = async (newRole) => {
    const uid = profile?.id ?? supabaseSession?.user?.id;
    if (switchingRole || newRole === realRoleKey || !uid) return;
    impactLight();
    setSwitchingRole(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', uid);
      if (error) {
        toast.error(error.message || 'Could not switch role');
        return;
      }
      toast.success(`Switched to ${newRole} — reloading…`);
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setSwitchingRole(false);
    }
  };
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
    selectRole(newRole);
    setFakeSession(newRole, displayUser?.email || '');
  };

  const handleCoachQuickShareReferralLink = async () => {
    const coachId = displayUser?.id;
    if (!coachId) {
      toast.error('Sign in as a coach first');
      return;
    }
    try {
      const code = await atlasRepo.ensureCoachInviteCode(coachId, !!isDemoMode, { retries: 5 });
      const link = getCoachClientJoinLinkPrimary(code, coachId);
      if (!link) {
        toast.error('Referral link not ready yet');
        return;
      }
      const message = `I'm using Atlas Performance Labs to manage my coaching business — check it out: ${link}`;
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import(/* @vite-ignore */ '@capacitor/share');
        await Share.share({
          title: 'Atlas Performance Labs',
          text: message,
          dialogTitle: 'Share your referral link',
        });
        toast.success('Share sheet opened');
        return;
      }
      const copied = await copyReferralLinkToClipboard(link);
      if (!copied) {
        toast.error('Could not copy link');
        return;
      }
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Could not share link');
    }
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
      return `Personal`;
    }
    return 'Admin / Owner';
  }, [isPlatformAdmin, previewRole, previewCoachSubtype, previewCoachTier, previewClientSubtype, previewPersonalTier, roleLabel]);

  const previewModeActive = isPlatformAdmin && previewRole && previewRole !== realRoleKey;
  const activePreviewRole = isPlatformAdmin ? previewRole : realRoleKey;

  // AJB tester feedback: for coaches this tab is "Create", not "More" — the
  // shell header title follows the tab label. Coach role only.
  const isCoachCreateSurface = activePreviewRole === 'coach';
  useEffect(() => {
    if (typeof setHeaderTitle !== 'function' || !isCoachCreateSurface) return undefined;
    setHeaderTitle('Create');
    return () => setHeaderTitle(null);
  }, [setHeaderTitle, isCoachCreateSurface]);
  /** Website shell: wide Personal More uses sidebar + sections (not mobile list). */
  const showPersonalMoreDesktop =
    isWideWeb && activePreviewRole === 'personal' && (isSolo || isPlatformAdmin);

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
      const coachSubtype = isPlatformAdmin && previewRole === 'coach'
        ? previewCoachSubtype
        : String(coachFocusEffective || 'transformation');
      const includePrepTools = coachSubtype === 'competition' || coachSubtype === 'integrated';
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {/* AJB tester feedback: creation tools lead — this tab is "Create". */}
          <div className="md:col-span-2">
            <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>CREATE</p>
            </Card>
            <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
              {menuRow(<FileText size={20} style={{ color: colors.muted }} />, 'Programs', 'Build and assign training plans', '/programs')}
              {menuRow(<Package size={20} style={{ color: colors.muted }} />, 'Methodology packages', 'Save and deploy your coaching system', '/methodology-packages')}
              {menuRow(<UtensilsCrossed size={20} style={{ color: colors.muted }} />, 'Nutrition plans', 'Create per-client nutrition plans', '/coach/nutrition')}
              {menuRow(<ClipboardList size={20} style={{ color: colors.muted }} />, 'Check-in templates', 'Design reusable client check-ins', '/checkintemplates')}
              {menuRow(<Pill size={20} style={{ color: colors.muted }} />, 'Supplement stacks', 'Assign supplement protocols to clients', '/supplement-stacks')}
              {menuRow(<Phone size={20} style={{ color: colors.muted }} />, 'Services', 'Define your offers and pricing', '/services')}
              {includePrepTools ? menuRow(<Award size={20} style={{ color: colors.muted }} />, 'Pose library', 'Competition posing references', '/comp-prep/pose-library') : null}
              {includePrepTools ? menuRow(<Crosshair size={20} style={{ color: colors.muted }} />, 'Prep tools', 'Peak week and prep command tools', '/prep-dashboard') : null}
            </div>
          </div>

          <div>
            <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>GROW</p>
            </Card>
            <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
              {menuRow(<UserPlus size={20} style={{ color: colors.muted }} />, 'Get clients', 'Invite link, code, and client joins', '/get-clients')}
              {menuRow(<Store size={20} style={{ color: colors.muted }} />, 'Marketplace', 'Public profile and marketplace settings', '/marketplace-setup')}
              {menuRow(<Inbox size={20} style={{ color: colors.muted }} />, 'Client inquiries', 'Applications from the marketplace', '/inquiry-inbox')}
              {menuRow(<Share2 size={20} style={{ color: colors.muted }} />, 'Referrals', 'Share links and referral tracking', '/referrals')}
              {menuRow(<Image size={20} style={{ color: colors.muted }} />, 'Result stories', 'Before/after proof for growth', '/results-gallery')}
            </div>
          </div>

          <div>
            <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>BUSINESS</p>
            </Card>
            <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
              {menuRow(<CreditCard size={20} style={{ color: colors.muted }} />, 'Earnings', 'Payouts, subscriptions, and invoices', '/earnings')}
              {menuRow(<Clock size={20} style={{ color: colors.muted }} />, 'Time report', 'Estimated coaching time vs client value', '/time-report')}
              {menuRow(<LineChart size={20} style={{ color: colors.muted }} />, 'Revenue analytics', 'Revenue trends and forecasting', '/revenue-analytics')}
              {menuRow(<Gift size={20} style={{ color: colors.muted }} />, 'Plan & billing', 'Manage subscription and billing', '/plan')}
              {isEliteTier(resolveCoachPlanTier(profile, displayUser))
                ? menuRow(<Zap size={20} style={{ color: colors.muted }} />, 'Client branding', 'Elite white-label and custom join page', '/settings/branding')
                : null}
              {menuRow(<UsersRound size={20} style={{ color: colors.muted }} />, 'Team', 'Seats, members, and permissions', '/team')}
            </div>
          </div>

          <div>
            <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>COMMUNITY</p>
            </Card>
            <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
              {menuRow(<Users size={20} style={{ color: colors.muted }} />, 'Community room', 'Group space for your clients', '/community')}
            </div>
          </div>

          <div>
            <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>ACCOUNT</p>
            </Card>
            <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
              {menuRow(<UserCircle size={20} style={{ color: colors.muted }} />, 'Profile', 'Photo, name, and coach details', '/profile-account')}
              {menuRow(<Palette size={20} style={{ color: colors.muted }} />, 'Settings', 'Account, app, and privacy settings', '/settings/account')}
              {menuRow(<Bell size={20} style={{ color: colors.muted }} />, 'Notifications', 'Manage alerts and delivery', '/notifications')}
              {menuRow(<HelpCircle size={20} style={{ color: colors.muted }} />, 'Help', 'Support docs and contact support', '/helpsupport')}
            </div>
          </div>
        </div>
      );
    }
    if (activePreviewRole === 'client') {
      const clientSubtype = isPlatformAdmin && previewRole === 'client'
        ? previewClientSubtype
        : String(resolvedAccess?.clientDeliveryContext || 'transformation');
      const showPoseLibrary = clientSubtype === 'competition' || resolvedAccess?.hasCompetitionPrep === true;
      return (
        <>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Community
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<Users size={20} style={{ color: colors.muted }} />, 'Community room', "Connect with your coach's community", '/community')}
          </div>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              My Coaching
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<Image size={20} style={{ color: colors.muted }} />, 'Progress photos', 'Track visual changes over time', '/progressphotos')}
            {showPoseLibrary ? menuRow(<Award size={20} style={{ color: colors.muted }} />, 'Pose library', 'Prep posing references and cues', '/comp-prep/pose-library') : null}
            {menuRow(<Trophy size={20} style={{ color: colors.muted }} />, 'Milestones', 'Wins and long-term consistency markers', '/achievements')}
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
            {menuRow(<CreditCard size={20} style={{ color: colors.muted }} />, 'Payment', 'Billing and payment details', '/settings/account')}
          </div>
          <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
              Support
            </p>
          </Card>
          <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
            {menuRow(<HelpCircle size={20} style={{ color: colors.muted }} />, 'Help', 'Get help and contact support', '/helpsupport')}
            {menuRow(<Users size={20} style={{ color: colors.muted }} />, 'My coach profile', 'View your coach information', '/mytrainer')}
          </div>
          {!isPlatformAdmin ? (
            <>
              <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
                  Coaching
                </p>
              </Card>
              <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
                <Row
                  left={<UserMinus size={20} style={{ color: colors.danger }} />}
                  title="Leave my coach"
                  subtitle="End your coaching relationship"
                  titleColor={colors.danger}
                  showChevron
                  onPress={() => {
                    if (!linkedClientId || !linkedCoachId) {
                      toast.error('No active coaching relationship found.');
                      return;
                    }
                    setLeaveCoachSheetOpen(true);
                  }}
                />
              </div>
            </>
          ) : null}
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
    const personalHasComp = resolvedAccess?.personalHasCompGoal === true;
    return (
      <>
        <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
            Training
          </p>
        </Card>
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<Calendar size={20} style={{ color: colors.muted }} />, 'Today', "Today's session and plan", '/today')}
          {menuRow(<Dumbbell size={20} style={{ color: colors.muted }} />, 'My program', 'Blocks and training plan', '/personal-my-program')}
          {menuRow(<FileText size={20} style={{ color: colors.muted }} />, 'Program builder', 'Edit your personal program', '/program-builder?personal=1')}
        </div>
        {personalHasComp ? (
          <>
            <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
                Competition Prep
              </p>
            </Card>
            <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
              {menuRow(<Award size={20} style={{ color: colors.muted }} />, 'Pose library', 'Posing references and stage cues', '/comp-prep/pose-library')}
              {menuRow(<Crosshair size={20} style={{ color: colors.muted }} />, 'Prep protocols', 'Peak week and depletion protocols', '/prep-protocols')}
              {menuRow(<Users size={20} style={{ color: colors.muted }} />, 'Pose self-assessment', 'Review and self-score your poses', '/pose-self-assessment')}
            </div>
          </>
        ) : null}
        <Card style={{ marginBottom: spacing[8], padding: spacing[12] }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: colors.muted }}>
            Nutrition
          </p>
        </Card>
        <div className="app-card overflow-hidden" style={{ marginBottom: spacing[12] }}>
          {menuRow(<UtensilsCrossed size={20} style={{ color: colors.muted }} />, 'Nutrition', 'Logging and daily fuel', '/nutrition')}
          {menuRow(<Target size={20} style={{ color: colors.muted }} />, 'Nutrition targets', 'Calories and macros', '/nutrition-targets')}
          {/* Supplements is a coach-assigned client feature ("your coach can add
              your plan") — omitted from the personal menu so a coachless user isn't
              sent to a dead-end. It returns via the coach-conversion handoff. */}
          {menuRow(<RefreshCw size={20} style={{ color: colors.muted }} />, 'Import from MyFitnessPal', 'Bring your diary history into Atlas', '/import/mfp')}
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

  const handleConfirmLeaveCoach = async () => {
    if (!linkedClientId || !linkedCoachId || !leaveCoachReason) return;
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Leave-coach flow is unavailable right now.');
      return;
    }
    try {
      setIsLeavingCoach(true);
      const result = await leaveCoach({
        supabase,
        clientId: linkedClientId,
        coachId: linkedCoachId,
        reason: leaveCoachReason,
        reasonDetail: leaveCoachReasonDetail,
      });
      if (!result?.ok) {
        throw new Error(result?.error || 'Could not leave coach right now.');
      }
      toast.success(
        `You've left ${linkedCoachName}'s coaching. Your training history and progress data are still yours.`
      );
      setLeaveCoachSheetOpen(false);
      setLeaveCoachReason('');
      setLeaveCoachReasonDetail('');
      await queryClient.invalidateQueries({ queryKey: ['auth-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['client-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['today-workout'] });
      await queryClient.invalidateQueries({ queryKey: ['today-page'] });
      await queryClient.invalidateQueries({ queryKey: ['coach-connection'] });
      await queryClient.invalidateQueries({ queryKey: ['program-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-targets'] });
      await queryClient.invalidateQueries({ queryKey: ['habit-list'] });
      await queryClient.invalidateQueries({ queryKey: ['linked-coach-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      navigate('/today');
    } catch (err) {
      toast.error(err?.message || 'Could not leave coach right now.');
    } finally {
      setIsLeavingCoach(false);
    }
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
      ref={scrollRef}
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
      {/* No in-page title card: the shell header already names this tab. */}
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
            {activePreviewRole === 'personal' && isPlatformAdmin && (
              <p className="text-xs mt-1.5 font-semibold" style={{ color: colors.primary }}>
                Personal (preview)
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
            Switch role
          </p>
          <p className="text-xs mb-3" style={{ color: colors.muted }}>
            Changes your account role for the whole app, then reloads. Coach focus, tier, and client delivery are in Settings → Account.
          </p>
          <div className="flex flex-wrap gap-2">
            {['coach', 'client', 'personal'].map((r) => (
              <button
                key={r}
                type="button"
                disabled={switchingRole}
                onClick={() => handleRealRoleSwitch(r)}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity active:opacity-90 disabled:opacity-60"
                style={{
                  background: realRoleKey === r ? colors.primary : colors.surface1,
                  color: realRoleKey === r ? '#fff' : colors.text,
                  border: 'none',
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {renderRolePreviewMenus()}

      {showPersonalMoreDesktop && activePreviewRole === 'personal' ? (
        <PersonalMoreDesktopLayout
          displayUser={displayUser}
          profile={profile}
          trainerProfile={trainerProfile}
          previewIdentityLine={previewIdentityLine}
          previewModeActive={previewModeActive}
          navigate={navigate}
          onOpenConsultation={() => setConsultationModalOpen(true)}
          onLogout={() => signOut('/login')}
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
            onClick={() => signOut('/login')}
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
      <LeaveCoachSheet
        open={leaveCoachSheetOpen}
        coachName={linkedCoachName}
        reason={leaveCoachReason}
        setReason={setLeaveCoachReason}
        reasonDetail={leaveCoachReasonDetail}
        setReasonDetail={setLeaveCoachReasonDetail}
        reasonNeedsDetails={leaveReasonNeedsDetails}
        isSubmitting={isLeavingCoach}
        onLeaveReview={() => {
          if (!linkedCoachId) {
            toast.error('Coach profile unavailable for review.');
            return;
          }
          navigate(`/review/coach/${linkedCoachId}`);
        }}
        onCancel={() => {
          if (isLeavingCoach) return;
          setLeaveCoachSheetOpen(false);
        }}
        onConfirm={handleConfirmLeaveCoach}
      />
        </>
        </PersonalSurface>
      )}
    </div>
  );
}

function LeaveCoachSheet({
  open,
  coachName,
  reason,
  setReason,
  reasonDetail,
  setReasonDetail,
  reasonNeedsDetails,
  isSubmitting,
  onLeaveReview,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ background: colors.overlay, paddingTop: 'env(safe-area-inset-top)' }}
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: colors.bg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Leave my coach</h2>
          <button type="button" onClick={onCancel} className="text-sm" style={{ color: colors.accent }}>Cancel</button>
        </div>
        <div style={{ padding: spacing[16] }}>
          <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Why do you want to leave your coach?</p>
          <div className="flex flex-col gap-2" style={{ marginBottom: spacing[14] }}>
            {CLIENT_LEAVE_REASON_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className="w-full text-left rounded-xl px-3 py-2.5"
                style={{
                  border: `1px solid ${reason === option ? colors.primary : colors.border}`,
                  background: reason === option ? colors.primarySubtle : colors.surface1,
                  color: colors.text,
                }}
              >
                {option}
              </button>
            ))}
          </div>

          {reasonNeedsDetails ? (
            <>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Tell us a bit more</label>
              <textarea
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                rows={3}
                className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
                style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                placeholder="Optional details"
              />
            </>
          ) : null}

          <div className="rounded-xl mt-4" style={{ padding: spacing[12], border: `1px solid ${colors.border}`, background: colors.surface2 }}>
            <p className="text-sm font-semibold" style={{ color: colors.text, marginBottom: spacing[8] }}>Important note</p>
            <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[6] }}>Leaving your coach will:</p>
            <ul className="text-sm" style={{ color: colors.muted, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>End your current coaching programme access</li>
              <li>Keep all your training history and progress data</li>
              <li>Not affect your Atlas account - you can find a new coach anytime from Discover</li>
            </ul>
          </div>

          <div className="rounded-xl mt-4" style={{ padding: spacing[12], border: `1px solid ${colors.border}`, background: colors.surface1 }}>
            <p className="text-sm font-semibold" style={{ color: colors.text, marginBottom: spacing[6] }}>Before you go</p>
            <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[10] }}>
              Would you like to leave a review for your coach? It helps other athletes find the right fit.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" style={{ flex: 1 }} onClick={onLeaveReview}>Leave a review</Button>
              <Button variant="secondary" style={{ flex: 1 }} onClick={onConfirm} disabled={!reason || isSubmitting}>
                Skip and leave
              </Button>
            </div>
          </div>

          <Button
            variant="primary"
            style={{ width: '100%', marginTop: spacing[16], background: colors.danger }}
            onClick={onConfirm}
            disabled={!reason || isSubmitting}
          >
            {isSubmitting ? 'Leaving...' : `Leave ${coachName}'s coaching`}
          </Button>
        </div>
      </div>
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
