import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { PageLoader } from '@/components/ui/LoadingState';
import { UserCircle, Mail, Award, MessageSquare, HelpCircle, Store, Trash2, LogOut, Shield, FlaskConical, Download } from 'lucide-react';
import { getRouteTitle } from '@/lib/routeMeta';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { createPageUrl } from '@/utils';
import Row from '@/ui/Row';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';
import { COACH_FOCUS_OPTIONS, coachFocusLabel } from '@/lib/data/coachTypeHelpers';
import { normalizeRole, isCoach } from '@/lib/roles';
import { atlasMigrationDataAttributes, deriveAccountHubRouteState } from '@/lib/atlasMigrationPhases';
import { getSupabase } from '@/lib/supabaseClient';
import { downloadMyData } from '@/lib/accountDataExport';

/**
 * Account hub: iOS list style. No in-page header (AppShell provides back + title).
 * Edit Profile and other account settings linked from here.
 * Coach focus is the single source of truth (transformation | competition | integrated).
 */
export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openFeedback, openSupport } = useFeedbackModal();
  const { user: authUser, role, effectiveRole, profile, coachFocus, updateProfile, isDemoMode, isLoadingAuth, supabaseUser, signOut, isAdmin } = useAuth();
  const displayUser = authUser;
  const [updatingFocus, setUpdatingFocus] = useState(false);
  const [updatingTier, setUpdatingTier] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  const handleDownloadMyData = useCallback(async () => {
    if (exportingData) return;
    impactLight();
    setExportingData(true);
    try {
      const result = await downloadMyData();
      if (result.ok) {
        toast.success('Your data export has been downloaded.');
      } else {
        toast.error(result.error || 'Could not export your data.');
      }
    } finally {
      setExportingData(false);
    }
  }, [exportingData]);
  const canonicalRole = normalizeRole(effectiveRole ?? role ?? null);

  const displayFocus = (profile?.coach_focus ?? coachFocus ?? 'transformation').toLowerCase();
  const effectiveFocus = ['transformation', 'competition', 'integrated'].includes(displayFocus) ? displayFocus : 'transformation';
  const canUpdateProfile = !!supabaseUser?.id && typeof updateProfile === 'function';
  const planTier = profile?.plan_tier ?? 'basic';
  /** Scoped QA capability: same role/tier/focus switching as admin, without platform-admin (Users/Billing/Audit) access. */
  const isQaTester = profile?.beta_group === 'qa_tester';
  const showTesterControls = isAdmin || isQaTester;

  const [clientRow, setClientRow] = useState(null);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);
  useEffect(() => {
    if (!showTesterControls || canonicalRole !== 'client' || !supabaseUser?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data } = await supabase
        .from('clients')
        .select('id, delivery_context')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();
      if (!cancelled) setClientRow(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [showTesterControls, canonicalRole, supabaseUser?.id]);

  const handleDeliveryContextChange = useCallback(async (context) => {
    if (!clientRow?.id || updatingDelivery || context === clientRow?.delivery_context) return;
    impactLight();
    setUpdatingDelivery(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase
        .from('clients')
        .update({ delivery_context: context, client_type: context })
        .eq('id', clientRow.id);
      if (error) {
        toast.error(error.message || 'Could not update delivery context');
        return;
      }
      setClientRow((r) => ({ ...r, delivery_context: context }));
      toast.success(`Client delivery set to ${context} — reloading…`);
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setUpdatingDelivery(false);
    }
  }, [clientRow, updatingDelivery]);

  const handleCoachFocusChange = async (focus) => {
    if (!canUpdateProfile || focus === effectiveFocus) return;
    impactLight();
    setUpdatingFocus(true);
    try {
      const result = await updateProfile({ coach_focus: focus });
      if (result?.error) {
        toast.error(result.error.message || 'Could not update coaching focus');
        return;
      }
      toast.success('Coaching focus updated');
    } finally {
      setUpdatingFocus(false);
    }
  };

  const handlePlanTierChange = async (tier) => {
    if (!canUpdateProfile || tier === planTier || updatingTier) return;
    impactLight();
    setUpdatingTier(true);
    try {
      const result = await updateProfile({ plan_tier: tier });
      if (result?.error) {
        toast.error(result.error.message || 'Could not update plan tier');
        return;
      }
      toast.success(`Switched to ${tier.charAt(0).toUpperCase() + tier.slice(1)} — reloading…`);
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setUpdatingTier(false);
    }
  };

  const handleRoleChange = async (newRole) => {
    if (!canUpdateProfile || newRole === canonicalRole || updatingRole) return;
    impactLight();
    setUpdatingRole(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', supabaseUser.id);
      if (error) {
        toast.error(error.message || 'Could not switch role');
        return;
      }
      toast.success(`Switched to ${newRole} — reloading…`);
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setUpdatingRole(false);
    }
  };

  const accountHubMigrationAttrs = useMemo(() => {
    const surface = !isDemoMode && isLoadingAuth ? 'loading' : 'active';
    const s = deriveAccountHubRouteState({ roleView: canonicalRole, surface });
    return atlasMigrationDataAttributes(s.phase, s.primary);
  }, [isDemoMode, isLoadingAuth, canonicalRole]);

  if (!isDemoMode && isLoadingAuth) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={pageContainer} {...accountHubMigrationAttrs}>
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={pageContainer} {...accountHubMigrationAttrs}>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div className="overflow-hidden" style={standardCard}>
        <Row
          left={<UserCircle size={20} style={{ color: colors.muted }} />}
          title="Edit Profile"
          showChevron={true}
          onPress={() => navigate(createPageUrl('EditProfile'))}
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
        {isCoach(role) && (
          <Row
            left={<Store size={20} style={{ color: colors.muted }} />}
            title="Marketplace listing"
            showChevron={true}
            onPress={() => { impactLight(); navigate('/marketplace-setup'); }}
          />
        )}
        {displayUser?.email && (
          <div
            className="flex items-center gap-3 w-full"
            style={{
              minHeight: 68,
              paddingLeft: 16,
              paddingRight: 16,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <Mail size={20} style={{ color: colors.muted }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: colors.muted }}>Email</p>
              <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{displayUser.email}</p>
            </div>
          </div>
        )}

        {isCoach(role) && (
          <div
            style={{
              padding: spacing[16],
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <Award size={20} style={{ color: colors.muted }} />
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Coaching focus</p>
              </div>
              <p className="text-sm font-medium" style={{ color: colors.text }}>{coachFocusLabel(effectiveFocus)}</p>
            </div>
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
            >
              {COACH_FOCUS_OPTIONS.map(({ focus, label }) => (
                <button
                  key={focus}
                  type="button"
                  disabled={updatingFocus || !canUpdateProfile}
                  aria-label={label}
                  aria-pressed={effectiveFocus === focus}
                  onClick={() => handleCoachFocusChange(focus)}
                  className="flex-1 py-3 text-sm font-medium transition-colors duration-200 disabled:opacity-60"
                  style={{
                    minHeight: touchTargetMin,
                    background: effectiveFocus === focus ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                    color: effectiveFocus === focus ? colors.accent : colors.muted,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Row
          left={<Download size={20} style={{ color: colors.muted }} />}
          title={exportingData ? 'Preparing your export…' : 'Download my data'}
          subtitle="Everything we hold about you, as a JSON file"
          showChevron={false}
          onPress={handleDownloadMyData}
        />
        <Row
          left={<LogOut size={20} style={{ color: colors.muted }} />}
          title="Sign out"
          showChevron={false}
          onPress={() => { impactLight(); void signOut(); }}
        />
        <div
          style={{
            minHeight: 34,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: spacing[16],
            paddingRight: spacing[16],
            borderTop: `1px solid ${colors.border}`,
            borderBottom: `1px solid ${colors.border}`,
            color: colors.danger,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Danger zone
        </div>
        <Row
          left={<Trash2 size={20} style={{ color: colors.danger }} />}
          title="Delete account"
          subtitle="Permanently remove your account and all data"
          titleColor={colors.danger}
          showChevron={true}
          onPress={() => { impactLight(); navigate('/settings/delete-account'); }}
        />
      </div>

      {showTesterControls && (
        <div className="overflow-hidden" style={{ ...standardCard, marginTop: spacing[16], border: '1px solid rgba(99,102,241,0.35)' }}>
          <div
            style={{
              minHeight: 34,
              display: 'flex',
              alignItems: 'center',
              gap: spacing[8],
              paddingLeft: spacing[16],
              paddingRight: spacing[16],
              borderBottom: `1px solid ${colors.border}`,
              color: 'rgba(139,92,246,0.9)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isAdmin ? <Shield size={13} /> : <FlaskConical size={13} />}
            {isAdmin ? 'Admin controls' : 'Tester controls'}
          </div>

          {/* Plan tier */}
          <div style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-medium" style={{ color: colors.muted }}>Plan tier</p>
              <p className="text-sm font-semibold" style={{ color: 'rgba(139,92,246,0.9)' }}>
                {planTier.charAt(0).toUpperCase() + planTier.slice(1)}
              </p>
            </div>
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
            >
              {['basic', 'pro', 'elite'].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  disabled={updatingTier || !canUpdateProfile}
                  onClick={() => handlePlanTierChange(tier)}
                  className="flex-1 py-3 text-sm font-medium transition-colors duration-200 disabled:opacity-60"
                  style={{
                    minHeight: touchTargetMin,
                    background: planTier === tier ? 'rgba(99,102,241,0.25)' : 'transparent',
                    color: planTier === tier ? 'rgba(139,92,246,1)' : colors.muted,
                  }}
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: colors.muted }}>
              Pro/Elite unlocks Revenue Analytics, Command Center &amp; Training Intelligence
            </p>
          </div>

          {/* Role switcher */}
          <div style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-medium" style={{ color: colors.muted }}>View as role</p>
              <p className="text-sm font-semibold" style={{ color: 'rgba(139,92,246,0.9)' }}>
                {canonicalRole ? canonicalRole.charAt(0).toUpperCase() + canonicalRole.slice(1) : '—'}
              </p>
            </div>
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
            >
              {['coach', 'client', 'personal'].map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={updatingRole || !canUpdateProfile}
                  onClick={() => handleRoleChange(r)}
                  className="flex-1 py-3 text-sm font-medium transition-colors duration-200 disabled:opacity-60"
                  style={{
                    minHeight: touchTargetMin,
                    background: canonicalRole === r ? 'rgba(99,102,241,0.25)' : 'transparent',
                    color: canonicalRole === r ? 'rgba(139,92,246,1)' : colors.muted,
                  }}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: colors.muted }}>
              Switches your DB role — reload to see sidebar &amp; routes for that role
            </p>
          </div>

          {/* Client delivery context — only meaningful once viewing as a client */}
          {canonicalRole === 'client' && clientRow ? (
            <div style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}` }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Client delivery</p>
                <p className="text-sm font-semibold" style={{ color: 'rgba(139,92,246,0.9)' }}>
                  {clientRow.delivery_context === 'competition' ? 'Competition' : 'Transformation'}
                </p>
              </div>
              <div
                className="flex rounded-xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
              >
                {['transformation', 'competition'].map((ctx) => (
                  <button
                    key={ctx}
                    type="button"
                    disabled={updatingDelivery}
                    onClick={() => handleDeliveryContextChange(ctx)}
                    className="flex-1 py-3 text-sm font-medium transition-colors duration-200 disabled:opacity-60"
                    style={{
                      minHeight: touchTargetMin,
                      background: clientRow.delivery_context === ctx ? 'rgba(99,102,241,0.25)' : 'transparent',
                      color: clientRow.delivery_context === ctx ? 'rgba(139,92,246,1)' : colors.muted,
                    }}
                  >
                    {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: colors.muted }}>
                Competition unlocks posing, peak week &amp; prep tools on the client side
              </p>
            </div>
          ) : null}

          {/* Admin panel links — platform admin only, not shown to scoped testers */}
          {isAdmin && (
            <>
              <button
                type="button"
                className="flex items-center justify-between w-full"
                style={{ padding: spacing[16], borderBottom: `1px solid ${colors.border}` }}
                onClick={() => { impactLight(); navigate('/admin'); }}
              >
                <div className="flex items-center gap-3">
                  <Shield size={20} style={{ color: 'rgba(139,92,246,0.8)' }} />
                  <div className="text-left">
                    <p className="text-[15px] font-medium" style={{ color: colors.text }}>Admin panel</p>
                    <p className="text-xs" style={{ color: colors.muted }}>Users, billing, analytics, feature flags</p>
                  </div>
                </div>
                <span style={{ color: colors.muted, fontSize: 18 }}>›</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-between w-full"
                style={{ padding: spacing[16] }}
                onClick={() => { impactLight(); navigate('/admin-dev-panel'); }}
              >
                <div className="flex items-center gap-3">
                  <Shield size={20} style={{ color: 'rgba(139,92,246,0.8)' }} />
                  <div className="text-left">
                    <p className="text-[15px] font-medium" style={{ color: colors.text }}>Dev panel</p>
                    <p className="text-xs" style={{ color: colors.muted }}>Role switcher, debug tools, seed data</p>
                  </div>
                </div>
                <span style={{ color: colors.muted, fontSize: 18 }}>›</span>
              </button>
            </>
          )}
        </div>
      )}

      <div
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        style={{ paddingTop: spacing[20], paddingBottom: spacing[16] }}
      >
        <Link to="/privacy" className="text-sm font-medium" style={{ color: colors.primary }}>
          Privacy Policy
        </Link>
        <Link to="/terms" className="text-sm font-medium" style={{ color: colors.primary }}>
          Terms of Service
        </Link>
      </div>
      </div>
    </div>
  );
}
