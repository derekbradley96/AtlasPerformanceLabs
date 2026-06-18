/**
 * Get Clients — production coach acquisition & activation (not a settings screen).
 * Truth: athletes join via Atlas coach code + private join link; manual roster add is non-production.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { navigateToThread } from '@/lib/messagesPath';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  Copy,
  Check,
  Share2,
  UserPlus,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  QrCode,
  MessageSquare,
  ClipboardCheck,
  UtensilsCrossed,
  Dumbbell,
  Store,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing, radii } from '@/ui/tokens';
import { pageContainer } from '@/ui/pageLayout';
import { safeDate } from '@/lib/format';
import { addPendingInvite, getPendingInvites } from '@/lib/inviteCodeStore';
import * as atlasRepo from '@/data/repos/atlasRepo';
import { useAuth } from '@/lib/AuthContext';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { trackFirstCoachLinkCopied } from '@/services/firstSessionTracker';
import { derivePendingInviteLifecycle, deriveCoachClientLifecycle } from '@/lib/coachClientLifecycle';
import { getClients } from '@/data/clientsService';
import { listForTrainer as listCheckInsForTrainer } from '@/data/checkInsService';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getActiveProgramAssignmentForClient } from '@/lib/programAssignments';
import { getActiveNutritionPlan } from '@/data/nutritionPlansService';
import { showCoachManualClientAcquisitionTools } from '@/lib/coachClientAcquisition';
import { usePresentationMode } from '@/lib/presentationMode';
import { coachFocusAllowsPrepFeatures } from '@/lib/coachFocus';

const BORDER = 'rgba(255,255,255,0.08)';

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

function formatDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const ACTIVATION_SCAN_LIMIT = 20;

async function loadClientsNeedingActivation(trainerId, isDemoMode) {
  const clients = await getClients(trainerId, { isDemoMode });
  const list = Array.isArray(clients) ? clients : [];
  const sorted = [...list].sort((a, b) => {
    const da = new Date(a.created_at ?? a.created_date ?? 0).getTime();
    const db = new Date(b.created_at ?? b.created_date ?? 0).getTime();
    return db - da;
  }).slice(0, ACTIVATION_SCAN_LIMIT);

  const [checkIns, threads] = await Promise.all([
    listCheckInsForTrainer(trainerId),
    atlasRepo.getThreadsForTrainer(trainerId, isDemoMode),
  ]);
  const checkInCountByClientId = {};
  (checkIns ?? []).forEach((ci) => {
    const cid = ci?.client_id;
    if (!cid) return;
    checkInCountByClientId[cid] = (checkInCountByClientId[cid] ?? 0) + 1;
  });

  const supabase = getSupabase();
  const rows = await Promise.all(
    sorted.map(async (c) => {
      if (!c?.id) return null;
      const thread = threads.find((t) => t.client_id === c.id) ?? null;
      const hasMessage = Boolean(thread?.last_message_at || (thread?.unread_count ?? 0) > 0);
      let hasProgram = false;
      let hasNutrition = false;
      if (hasSupabase && supabase) {
        const [p, n] = await Promise.all([
          getActiveProgramAssignmentForClient(supabase, c.id),
          getActiveNutritionPlan(trainerId, c.id),
        ]);
        hasProgram = Boolean(p);
        hasNutrition = Boolean(n);
      }
      const lifecycle = deriveCoachClientLifecycle(c, {
        checkInCount: checkInCountByClientId[c.id] ?? 0,
        hasMessage,
        hasProgram,
        hasNutrition,
      });
      return { client: c, lifecycle };
    })
  );

  return rows.filter(Boolean).filter((r) => r.lifecycle.key === 'joined_unset');
}

export default function GetClientsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isDemoMode, isAdminBypass, supabaseUser } = useAuth();
  const { isDesktopWeb } = usePresentationMode();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';

  const showDevImport = showCoachManualClientAcquisitionTools({
    isDemoMode,
    isAdminBypass,
    profile,
    supabaseUser,
  });
  const prepCoach = coachFocusAllowsPrepFeatures(profile?.coach_focus);

  const [inviteCode, setInviteCode] = useState(() => (profile?.referral_code ?? '').trim() || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [activationRows, setActivationRows] = useState([]);
  const [loadingActivation, setLoadingActivation] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const code = (profile?.referral_code ?? '').trim();
    if (code) setInviteCode(code);
  }, [profile?.referral_code]);

  useEffect(() => {
    const focus = new URLSearchParams(location.search).get('focus');
    if (focus !== 'code') return;
    const t = requestAnimationFrame(() => {
      document.getElementById('atlas-coach-code')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(t);
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      atlasRepo.ensureCoachInviteCode(trainerId, isDemoMode, { retries: 5 }),
      atlasRepo.getPendingInvitesList(trainerId, isDemoMode),
    ]).then(([code, list]) => {
      if (!cancelled) {
        if (code) setInviteCode(code);
        setPendingInvites(Array.isArray(list) ? list : []);
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainerId, isDemoMode]);

  useEffect(() => {
    let cancelled = false;
    setLoadingActivation(true);
    loadClientsNeedingActivation(trainerId, isDemoMode)
      .then((rows) => {
        if (!cancelled) setActivationRows(rows);
      })
      .catch(() => { if (!cancelled) setActivationRows([]); })
      .finally(() => { if (!cancelled) setLoadingActivation(false); });
    return () => { cancelled = true; };
  }, [trainerId, isDemoMode]);

  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    QRCode.toDataURL(inviteCode, { width: 200, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [inviteCode]);

  const coachingLink = useMemo(() => getCoachClientJoinLinkPrimary(inviteCode, trainerId), [inviteCode, trainerId]);

  const inviteMessage = coachingLink
    ? `Hey! Join my coaching on Atlas — open this link to sign up with me:\n${coachingLink}`
    : `Hey! I'd like to invite you to join my coaching on Atlas. I'll send your join link as soon as you're set up.`;

  const handleCopyCode = useCallback(async () => {
    await lightHaptic();
    const payload = (inviteCode || '').trim();
    if (!payload) {
      toast.error('Coach code not ready yet');
      return;
    }
    try {
      await navigator.clipboard?.writeText(payload);
      setCopiedCode(true);
      toast.success('Coach code copied');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  }, [inviteCode]);

  const handleCopyLink = useCallback(async () => {
    await lightHaptic();
    if (!coachingLink) {
      toast.error('Join link not ready');
      return;
    }
    try {
      await navigator.clipboard?.writeText(coachingLink);
      setCopiedLink(true);
      if (user?.id && !isDemoMode) trackFirstCoachLinkCopied(user.id, { source: 'get_clients_copy_link' });
      toast.success('Join link copied');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  }, [coachingLink, user?.id, isDemoMode]);

  const handleShare = useCallback(async () => {
    await lightHaptic();
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Share } = await import(/* @vite-ignore */ '@capacitor/share');
          await Share.share({
            title: 'Join my coaching',
            text: inviteMessage,
            dialogTitle: 'Share invite',
          });
          toast.success('Share sheet opened');
          if ((inviteCode || '').trim()) {
            addPendingInvite(inviteCode);
            setPendingInvites(getPendingInvites());
          }
          atlasRepo.getPendingInvitesList(trainerId, isDemoMode).then((list) => setPendingInvites(Array.isArray(list) ? list : []));
          return;
        } catch (_) {}
      }
      if (typeof navigator.share === 'function' && navigator.canShare?.({ text: inviteMessage })) {
        await navigator.share({ title: 'Join my coaching', text: inviteMessage });
        toast.success('Shared!');
        if ((inviteCode || '').trim()) {
          addPendingInvite(inviteCode);
          setPendingInvites(getPendingInvites());
        }
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteMessage);
        if (user?.id && !isDemoMode && coachingLink) {
          trackFirstCoachLinkCopied(user.id, { source: 'get_clients_share_clipboard' });
        }
        toast.success('Invite message copied to clipboard');
      } else {
        toast.error('Sharing not available');
      }
    } catch (e) {
      if (e?.name !== 'AbortError' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteMessage);
        if (user?.id && !isDemoMode && coachingLink) {
          trackFirstCoachLinkCopied(user.id, { source: 'get_clients_share_clipboard_fallback' });
        }
        toast.success('Invite message copied to clipboard');
      }
    }
  }, [inviteCode, inviteMessage, coachingLink, user?.id, isDemoMode, trainerId]);

  const maxWidth = isDesktopWeb ? 920 : '100%';

  if (loading && !trainerId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <div style={{ ...pageContainer, maxWidth, margin: '0 auto', paddingTop: spacing[16] }}>
          <Card style={{ padding: spacing[24] }}>
            <div className="animate-pulse space-y-3">
              <div style={{ height: 22, background: colors.surface2, borderRadius: 8, width: '55%' }} />
              <div style={{ height: 120, background: colors.surface2, borderRadius: radii.lg }} />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <div
        style={{
          ...pageContainer,
          maxWidth,
          margin: '0 auto',
          paddingTop: spacing[12],
          paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {/* Hero */}
        <section
          style={{
            borderRadius: radii.lg,
            padding: spacing[20],
            marginBottom: spacing[16],
            border: `1px solid ${colors.primary}44`,
            background: `linear-gradient(145deg, rgba(59,130,246,0.12) 0%, ${colors.surface1} 55%, ${colors.bg} 100%)`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.md,
                background: colors.primarySubtle,
                color: colors.primary,
              }}
            >
              <Sparkles size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight" style={{ color: colors.text }}>
                Get Clients
              </h1>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: colors.muted }}>
                Share your private join link or coach code. Athletes sign up in Atlas, link to you, then land on your roster—no manual roster entry required for production growth.
              </p>
            </div>
          </div>

          <div className={`grid gap-3 ${isDesktopWeb ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div
              id="atlas-coach-code"
              className="rounded-xl p-4 scroll-mt-24"
              style={{ background: colors.surface2, border: `1px solid ${BORDER}` }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                Coach code
              </p>
              {inviteCode ? (
                <p className="text-2xl font-bold font-mono tracking-wider break-all" style={{ color: colors.accent }}>
                  {inviteCode}
                </p>
              ) : (
                <p className="text-sm" style={{ color: colors.muted }}>Generating your code…</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="primary" size="sm" onClick={handleCopyCode} className="min-h-[40px]">
                  {copiedCode ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
                  {copiedCode ? 'Copied' : 'Copy code'}
                </Button>
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: colors.surface2, border: `1px solid ${BORDER}` }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                Private join link
              </p>
              {coachingLink ? (
                <p className="text-xs font-mono break-all leading-relaxed" style={{ color: colors.text }}>
                  {coachingLink}
                </p>
              ) : (
                <p className="text-sm" style={{ color: colors.muted }}>Link loads when your account is ready.</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="secondary" size="sm" onClick={handleCopyLink} disabled={!coachingLink} className="min-h-[40px]">
                  {copiedLink ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
                  {copiedLink ? 'Copied' : 'Copy link'}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleShare} className="min-h-[40px]">
                  <Share2 size={16} className="mr-1.5" />
                  Share
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowQr((v) => !v)} className="min-h-[40px]">
                  <QrCode size={16} className="mr-1.5" />
                  {showQr ? 'Hide QR' : 'QR code'}
                </Button>
              </div>
            </div>
          </div>

          {showQr && qrDataUrl ? (
            <div className="mt-4 flex flex-col items-center rounded-xl py-4" style={{ background: '#fff', border: `1px solid ${BORDER}` }}>
              <img src={qrDataUrl} alt="Coach code QR" style={{ width: 200, height: 200 }} />
              <p className="text-xs mt-2" style={{ color: '#64748b' }}>Scan to copy your coach code on mobile</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/onboarding-documents')}
              className="gap-2"
            >
              <FileText size={16} />
              Client documents (contract, PAR-Q…)
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients')} className="gap-2">
              <UserPlus size={16} />
              Open roster
            </Button>
          </div>
        </section>

        {/* Why */}
        <Card style={{ padding: spacing[16], marginBottom: spacing[16], border: `1px solid ${BORDER}` }}>
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
            Why Atlas works this way
          </p>
          <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
            One join path keeps attribution clean: you always know which clients chose you, billing and messaging stay tied to the right profile, and athletes get a consistent onboarding experience. Your code and link are permanent growth assets—reuse them everywhere you promote coaching.
          </p>
          {prepCoach ? (
            <p className="text-xs mt-3 leading-relaxed" style={{ color: colors.muted }}>
              Comp prep clients use the same join flow; prep-specific programming starts after they&apos;re on your roster.
            </p>
          ) : null}
        </Card>

        {/* Pending pipeline */}
        <Card style={{ padding: 0, marginBottom: spacing[16], overflow: 'hidden', border: `1px solid ${BORDER}` }}>
          <div style={{ padding: spacing[16], borderBottom: `1px solid ${BORDER}` }}>
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>Pending joins</h2>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              Invites you&apos;ve shared (demo/local tracking). Production telemetry may expand statuses later.
            </p>
          </div>
          {pendingInvites.length === 0 ? (
            <div style={{ padding: spacing[20] }}>
              <EmptyState
                icon={UserPlus}
                title="No pending rows yet"
                subtext="When you share your link or code from this screen, entries appear here so you can follow up."
              />
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: BORDER }}>
              {pendingInvites.map((inv) => {
                const life = derivePendingInviteLifecycle(inv);
                const tone =
                  life.tone === 'success'
                    ? { bg: 'rgba(34,197,94,0.15)', color: colors.success }
                    : life.tone === 'warning'
                      ? { bg: 'rgba(245,158,11,0.15)', color: colors.warning }
                      : { bg: 'rgba(255,255,255,0.06)', color: colors.muted };
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3"
                    style={{ padding: spacing[14] }}
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-medium truncate" style={{ color: colors.text }}>{inv.code}</p>
                      <p className="text-xs" style={{ color: colors.muted }}>{formatDate(inv.created_date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: tone.bg, color: tone.color }}>
                        {life.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={async () => {
                          const payload = (inv?.code ?? '').toString().trim() || inviteCode;
                          if (!payload) return;
                          try {
                            await navigator.clipboard?.writeText(payload);
                            toast.success('Code copied');
                          } catch {
                            toast.error('Could not copy');
                          }
                        }}
                      >
                        Copy
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleShare}>
                        Reshare
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Activation */}
        <Card style={{ padding: 0, marginBottom: spacing[16], overflow: 'hidden', border: `1px solid ${BORDER}` }}>
          <div style={{ padding: spacing[16], borderBottom: `1px solid ${BORDER}` }}>
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>New clients — finish setup</h2>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              Recently joined athletes who still need training, nutrition, messaging, or a first check-in. Connect acquisition to activation.
            </p>
          </div>
          {loadingActivation ? (
            <div className="text-sm" style={{ padding: spacing[24], color: colors.muted }}>
              Loading roster signals…
            </div>
          ) : activationRows.length === 0 ? (
            <div style={{ padding: spacing[20] }}>
              <EmptyState
                icon={ClipboardCheck}
                title="No activation gaps"
                subtext="When a new client needs programs or first touchpoints, they’ll show here with quick actions."
              />
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: BORDER }}>
              {activationRows.map(({ client, lifecycle }) => {
                const name = client.full_name ?? client.name ?? 'Client';
                const tasks = lifecycle.setupTasks ?? {};
                const cid = client.id;
                return (
                  <li key={cid} style={{ padding: spacing[16] }}>
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-medium" style={{ color: colors.text }}>{name}</p>
                        <p className="text-[11px]" style={{ color: colors.muted }}>
                          {tasks.trainingAssigned && tasks.nutritionAssigned && tasks.firstMessageSent && tasks.firstCheckinSubmitted
                            ? '—'
                            : 'Setup incomplete'}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => navigate(`/clients/${cid}`)}>
                        Open client
                        <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 text-xs"
                        disabled={tasks.trainingAssigned}
                        onClick={() => navigate(`/program-builder?clientId=${encodeURIComponent(cid)}`)}
                      >
                        <Dumbbell size={14} className="mr-1" />
                        {tasks.trainingAssigned ? 'Training assigned' : 'Assign training'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 text-xs"
                        disabled={tasks.nutritionAssigned}
                        onClick={() => navigate(`/coach/nutrition/${encodeURIComponent(cid)}`)}
                      >
                        <UtensilsCrossed size={14} className="mr-1" />
                        {tasks.nutritionAssigned ? 'Nutrition set' : 'Assign nutrition'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 text-xs"
                        disabled={tasks.firstMessageSent}
                        onClick={() => navigateToThread(navigate, cid)}
                      >
                        <MessageSquare size={14} className="mr-1" />
                        {tasks.firstMessageSent ? 'Messaged' : 'First message'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 text-xs"
                        disabled={tasks.firstCheckinSubmitted}
                        onClick={() => navigate(`/checkintemplates`)}
                      >
                        <ClipboardCheck size={14} className="mr-1" />
                        {tasks.firstCheckinSubmitted ? 'Check-in in flight' : 'Check-in templates'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Growth */}
        <Card style={{ padding: spacing[16], marginBottom: spacing[16], border: `1px solid ${BORDER}` }}>
          <div className="flex items-start gap-3">
            <Store size={20} className="shrink-0 mt-0.5" style={{ color: colors.accent }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: colors.text }}>Grow visibility</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: colors.muted }}>
                Tune your marketplace listing so athletes who discover Atlas can find you after they download the app.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="secondary" size="sm" onClick={() => navigate('/marketplace-setup')}>
                  Marketplace listing
                  <ExternalLink size={14} className="ml-1" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/discover')}>
                  Discovery preview
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {showDevImport ? (
          <Card style={{ padding: spacing[14], marginBottom: spacing[16], border: `1px dashed ${colors.border}` }}>
            <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: colors.warning }}>Advanced / non-production</p>
            <p className="text-xs mb-2" style={{ color: colors.muted }}>
              CSV import and manual roster tools are for migration and internal testing—not how live clients join.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/import-clients')}>
              Open import (dev / admin)
            </Button>
          </Card>
        ) : null}

        {/* Help */}
        <button
          type="button"
          className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium"
          style={{ background: colors.surface2, border: `1px solid ${BORDER}`, color: colors.text }}
          onClick={() => setHelpOpen((o) => !o)}
        >
          How client joining works
          {helpOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {helpOpen ? (
          <Card style={{ padding: spacing[16], marginTop: spacing[10], border: `1px solid ${BORDER}` }}>
            <ol className="list-decimal pl-4 space-y-2 text-sm" style={{ color: colors.text }}>
              <li>You share your private link or coach code (QR optional).</li>
              <li>They create an Atlas account and complete client onboarding tied to you.</li>
              <li>They appear on your roster; you assign programs, nutrition, and first check-ins from Clients or this screen.</li>
            </ol>
            <p className="text-xs mt-3" style={{ color: colors.muted }}>
              Manual “Add client” in dev tools bypasses this flow—use only for testing or migration.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
