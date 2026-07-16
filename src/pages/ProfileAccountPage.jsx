import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronRight, Loader2, User, Target, Shield, UtensilsCrossed } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { PageLoader } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { isCoach, isClient, isPersonal } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getPasswordError } from '@/lib/passwordPolicy';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/notificationPreferences';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { fetchMergedPersonalNutritionTargets, formatPersonalNutritionTargetsSummary, personalNutritionTargetsQueryKey } from '@/lib/personalNutritionProfile';
import { usePresentationMode } from '@/lib/presentationMode';
import TopBar from '@/components/ui/TopBar';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import MeasurementUnitSegments, {
  HEIGHT_SEGMENT_OPTIONS,
  BODYWEIGHT_SEGMENT_OPTIONS,
  LOAD_SEGMENT_OPTIONS,
} from '@/components/measurements/MeasurementUnitSegments';
import {
  normalizeHeightUnit,
  normalizeWeightUnit,
  parseWeightInputsToKg,
  profileCurrentWeightKg,
  profileTargetWeightKg,
  weightKgToFormParts,
  weightUnitShortLabel,
} from '@/lib/bodyMeasurementUnits';
import { defaultLoadUnitForLocale } from '@/lib/localeUnitDefaults';
import { normalizeLoadUnit } from '@/lib/trainingLoadUnits';
import {
  defaultNutritionPrefsForLocale,
  FOOD_QUANTITY_SEGMENT_OPTIONS,
  normalizeFoodQuantityUnit,
  normalizeNutritionLabelDisplay,
  normalizeSodiumUnit,
  normalizeWaterUnit,
  NUTRITION_LABEL_SEGMENT_OPTIONS,
  SODIUM_UNIT_SEGMENT_OPTIONS,
  WATER_UNIT_SEGMENT_OPTIONS,
} from '@/lib/nutritionUnits';
import { deriveProfileAccountSurfaceState, atlasMigrationDataAttributes } from '@/lib/atlasMigrationPhases';
import { humanizeSupabaseError } from '@/lib/supabaseErrorMessage';
import { getNativePref, setNativePref } from '@/lib/nativePreferences';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { trackRecoverableError } from '@/services/frictionTracker';
import {
  CALL_SOUND_PREF_KEYS,
  getCallRingbackVolume,
  getCallSoundEnabled,
  setCallRingbackVolume,
  setCallSoundEnabled,
} from '@/lib/callSoundPrefs';

/** Last-resort: never spin longer than this, whatever is wedged. */
const LOAD_SAFETY_TIMEOUT_MS = 2500;
/** Per-call bound so one slow/hung dependency can't hold the whole screen.
 *  Kept tight: everything here has a usable fallback, so waiting longer buys
 *  nothing but a spinner. */
const LOAD_STEP_TIMEOUT_MS = 1200;

/**
 * Resolve to `fallback` if `promise` doesn't settle in time. Nothing this screen
 * awaits is time-bounded on its own (supabase-js has no default timeout; a
 * native plugin call can wedge), and an unsettled promise skips finally.
 */
function withTimeout(promise, ms = LOAD_STEP_TIMEOUT_MS, fallback = null) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const WEIGHT_UNIT_PREF_KEY = 'atlas_pref_weight_unit';

function FieldEditor({ title, value, onChange, type = 'text', placeholder = '', multiline = false }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
      {multiline ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            borderRadius: radii.button,
            border: `1px solid ${colors.border}`,
            background: colors.surface2,
            color: colors.text,
            padding: `10px 12px`,
            fontSize: 14,
            resize: 'vertical',
          }}
        />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            minHeight: touchTargetMin,
            borderRadius: radii.button,
            border: `1px solid ${colors.border}`,
            background: colors.surface2,
            color: colors.text,
            padding: `10px 12px`,
            fontSize: 14,
          }}
        />
      )}
    </label>
  );
}

function SettingsRow({ icon, title, value, onPress }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        width: '100%',
        minHeight: touchTargetMin + 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[10],
        border: 'none',
        background: 'transparent',
        color: colors.text,
        padding: `${spacing[10]}px 0`,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10], minWidth: 0, flex: 1 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: colors.surface2, color: colors.muted }}>
          <Icon size={15} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{title}</p>
          <p style={{ margin: `${spacing[2]}px 0 0`, fontSize: 12, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'Not set'}</p>
        </div>
      </div>
      <ChevronRight size={16} style={{ color: colors.muted, flexShrink: 0 }} />
    </button>
  );
}

function CompactToggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: touchTargetMin + 2 }}>
      <span style={{ fontSize: 14, color: colors.text }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 28,
          borderRadius: 999,
          border: 'none',
          background: checked ? colors.primary : colors.surface2,
          position: 'relative',
          transition: 'background-color 140ms ease',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 140ms ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
      </button>
    </label>
  );
}

function toDisplayValue(raw) {
  if (raw == null || raw === '') return 'Not set';
  return String(raw);
}

function coachLocalDraftKey(userId) {
  return userId ? `atlas_coach_profile_local:${userId}` : null;
}

function readCoachLocalDraft(userId) {
  if (typeof window === 'undefined') return null;
  const key = coachLocalDraftKey(userId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCoachLocalDraft(userId, draft) {
  if (typeof window === 'undefined') return;
  const key = coachLocalDraftKey(userId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft || {}));
  } catch {
    // ignore local storage failures
  }
}

export default function ProfileAccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDesktopWeb } = usePresentationMode();
  const { keyboardInset } = useKeyboardInset();
  const queryClient = useQueryClient();
  const { user, profile, effectiveRole, updateProfile, refreshProfile, signOut } = useAuth();
  const notificationsSectionRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveNotice, setSaveNotice] = useState('');
  const [password, setPassword] = useState('');
  const [activeSheet, setActiveSheet] = useState(null);
  const [notifications, setNotifications] = useState({
    checkins: true,
    messages: true,
    habits: true,
    peak_week: true,
    payments: true,
    workouts: true,
    nutrition: true,
    progress_reminders: true,
  });
  const [callSoundEnabled, setCallSoundEnabledState] = useState(true);
  const [callRingbackVolume, setCallRingbackVolumeState] = useState(0.45);
  const [form, setForm] = useState({
    full_name: '',
    display_name: '',
    email: '',
    goal: '',
    training_focus: '',
    current_weight: '',
    target_weight: '',
    units: 'kg',
    training_days: '',
    injuries: '',
    coaching_focus: '',
    coaching_style: '',
    business_name: '',
    avatar_url: '',
    taking_clients: true,
  });

  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const roleType = isCoach(effectiveRole) ? 'coach' : isClient(effectiveRole) ? 'client' : isPersonal(effectiveRole) ? 'personal' : 'personal';
  const inviteLink = useMemo(
    () => (user?.id ? getCoachClientJoinLinkPrimary(profile?.referral_code || '', user.id) : ''),
    [profile?.referral_code, user?.id]
  );

  const profileAccountMigration = useMemo(
    () => deriveProfileAccountSurfaceState({ roleType }),
    [roleType]
  );

  const { data: personalNutritionMerged } = useQuery({
    queryKey: personalNutritionTargetsQueryKey(user?.id),
    queryFn: () => fetchMergedPersonalNutritionTargets(user?.id),
    enabled: roleType === 'personal' && !!user?.id,
  });
  const nutritionTargetsSummary = formatPersonalNutritionTargetsSummary(personalNutritionMerged) || 'Not set';

  const personalNotificationRows = [
    { key: 'workouts', label: 'Workout reminders' },
    { key: 'habits', label: 'Habit reminders' },
    { key: 'nutrition', label: 'Nutrition reminders' },
    { key: 'checkins', label: 'Check-in reminders' },
    { key: 'progress_reminders', label: 'Progress reminders' },
  ];
  // Clients receive workout and nutrition reminders too — without these the
  // inline toggles disagreed with the dedicated Notifications page (which has
  // all 8). Coaches don't get client-facing reminders, so their set stays lean.
  const clientNotificationRows = [
    { key: 'checkins', label: 'Check-ins' },
    { key: 'messages', label: 'Messages' },
    { key: 'workouts', label: 'Workout reminders' },
    { key: 'habits', label: 'Habits' },
    { key: 'nutrition', label: 'Nutrition & supplements' },
    { key: 'peak_week', label: 'Peak week' },
    { key: 'payments', label: 'Payments' },
    { key: 'progress_reminders', label: 'Progress prompts' },
  ];
  const defaultNotificationRows = [
    { key: 'checkins', label: 'Check-ins' },
    { key: 'messages', label: 'Messages' },
    { key: 'habits', label: 'Habits' },
    { key: 'peak_week', label: 'Peak week' },
    { key: 'payments', label: 'Payments' },
  ];
  const visibleNotificationRows =
    roleType === 'personal'
      ? personalNotificationRows
      : roleType === 'client'
        ? clientNotificationRows
        : defaultNotificationRows;

  /**
   * Hard backstop for "Loading profile…".
   *
   * try/catch/finally only covers a *throw*. It cannot help when an await never
   * settles — and nothing here is time-bounded: supabase-js has no default
   * timeout, and a wedged native Preferences call never resolves either. A
   * single hung promise left this screen spinning forever with no error. This
   * guarantees the screen always resolves; worst case the form renders with the
   * values we already have from AuthContext.
   */
  useEffect(() => {
    if (!loading) return undefined;
    const t = setTimeout(() => setLoading(false), LOAD_SAFETY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Every exit path below resolves `loading`. Previously a bare `return`
      // here (no user yet), or a throw from any await, skipped setLoading(false)
      // entirely and the spinner ran forever with no error shown.
      if (!user?.id) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
      // In parallel: these are independent, and awaiting them one after another
      // meant a slow/wedged Preferences bridge cost 3x the timeout (~7.5s) before
      // the screen could even continue — which is why the profile took 5-8s.
      const [preferredWeightUnit, preferredCallSoundEnabled, preferredCallRingbackVolume] =
        await Promise.all([
          withTimeout(getNativePref(WEIGHT_UNIT_PREF_KEY, null)),
          withTimeout(getNativePref(CALL_SOUND_PREF_KEYS.enabled, null)),
          withTimeout(getNativePref(CALL_SOUND_PREF_KEYS.ringbackVolume, null)),
        ]);
      const supabase = hasSupabase ? getSupabase() : null;
      // Use AuthContext profile as source-of-truth. It already handles legacy
      // schema fallbacks and missing-column retries, which avoids silent resets
      // when a direct select includes unavailable columns.
      const profileRow = profile || null;
      const wU = normalizeWeightUnit(preferredWeightUnit || profileRow?.bodyweight_unit || profileRow?.weight_unit || profileRow?.units);
      const loadU = profileRow?.load_unit != null && String(profileRow.load_unit).trim() !== ''
        ? normalizeLoadUnit(profileRow.load_unit)
        : normalizeLoadUnit(defaultLoadUnitForLocale());
      const nutDef = defaultNutritionPrefsForLocale();
      const fqU =
        profileRow?.food_quantity_unit != null && String(profileRow.food_quantity_unit).trim() !== ''
          ? normalizeFoodQuantityUnit(profileRow.food_quantity_unit)
          : nutDef.food_quantity_unit;
      const nlU =
        profileRow?.nutrition_label_display != null && String(profileRow.nutrition_label_display).trim() !== ''
          ? normalizeNutritionLabelDisplay(profileRow.nutrition_label_display)
          : nutDef.nutrition_label_display;
      const wtrU =
        profileRow?.water_unit != null && String(profileRow.water_unit).trim() !== ''
          ? normalizeWaterUnit(profileRow.water_unit)
          : nutDef.water_unit;
      const naU =
        profileRow?.sodium_unit != null && String(profileRow.sodium_unit).trim() !== ''
          ? normalizeSodiumUnit(profileRow.sodium_unit)
          : nutDef.sodium_unit;
      const hU = normalizeHeightUnit(profileRow?.height_unit);
      const cwKg = profileCurrentWeightKg(profileRow);
      const twKg = profileTargetWeightKg(profileRow);
      const cwParts = weightKgToFormParts(cwKg, wU);
      const twParts = weightKgToFormParts(twKg, wU);
      const base = {
        full_name: profileRow?.full_name || profile?.full_name || profileRow?.display_name || profile?.display_name || '',
        display_name: profileRow?.display_name || profile?.display_name || '',
        email: profileRow?.email || profile?.email || user?.email || '',
        goal: profileRow?.goal || '',
        training_focus: profileRow?.training_focus || '',
        current_weight: wU === 'st_lb' ? '' : (cwParts.primary || ''),
        target_weight: wU === 'st_lb' ? '' : (twParts.primary || ''),
        current_weight_st: wU === 'st_lb' ? (cwParts.primary || '') : '',
        current_weight_lbrem: wU === 'st_lb' ? (cwParts.secondary || '') : '',
        target_weight_st: wU === 'st_lb' ? (twParts.primary || '') : '',
        target_weight_lbrem: wU === 'st_lb' ? (twParts.secondary || '') : '',
        units: wU === 'lb' ? 'lb' : 'kg',
        height_unit: hU,
        bodyweight_unit: wU,
        load_unit: loadU,
        food_quantity_unit: fqU,
        nutrition_label_display: nlU,
        water_unit: wtrU,
        sodium_unit: naU,
        training_days: '',
        injuries: '',
        coaching_focus: profileRow?.coach_focus || profile?.coach_focus || 'transformation',
        coaching_style: profileRow?.coaching_style || profile?.coaching_style || '',
        business_name: profileRow?.business_name || '',
        avatar_url: profileRow?.avatar_url || profile?.avatar_url || '',
        taking_clients: profileRow?.taking_clients !== false,
      };
      const coachLocalDraft = roleType === 'coach' ? readCoachLocalDraft(user.id) : null;
      if (coachLocalDraft) {
        if (!base.coaching_style && coachLocalDraft.coaching_style) base.coaching_style = coachLocalDraft.coaching_style;
        if (!base.business_name && coachLocalDraft.business_name) base.business_name = coachLocalDraft.business_name;
        if (!base.avatar_url && coachLocalDraft.avatar_url) base.avatar_url = coachLocalDraft.avatar_url;
      }
      let prefs = notifications;
      if (supabase) {
        if (roleType === 'client') {
          const { data } = (await withTimeout(supabase.from('clients').select('training_days_per_week, injuries').eq('user_id', user.id).maybeSingle(), LOAD_STEP_TIMEOUT_MS, { data: null })) ?? { data: null };
          base.training_days = data?.training_days_per_week != null ? String(data.training_days_per_week) : '';
          base.injuries = data?.injuries || '';
        }
        if (roleType === 'personal') {
          const { data } = (await withTimeout(supabase.from('personal').select('primary_goal').eq('user_id', user.id).maybeSingle(), LOAD_STEP_TIMEOUT_MS, { data: null })) ?? { data: null };
          if (data?.primary_goal && !base.goal) base.goal = data.primary_goal;
        }
        const loadedPrefs = await withTimeout(getNotificationPreferences(user.id));
        if (loadedPrefs) prefs = loadedPrefs;
      }
      if (!cancelled) {
        const resolvedCallSoundEnabled = preferredCallSoundEnabled == null
          ? getCallSoundEnabled()
          : (String(preferredCallSoundEnabled) === '1' || String(preferredCallSoundEnabled) === 'true');
        const resolvedRingbackVolume = preferredCallRingbackVolume == null
          ? getCallRingbackVolume()
          : Math.max(0, Math.min(1, Number(preferredCallRingbackVolume) || 0.45));
        setForm(base);
        setNotifications(prefs);
        setCallSoundEnabledState(resolvedCallSoundEnabled);
        setCallRingbackVolumeState(resolvedRingbackVolume);
        setInitialSnapshot(JSON.stringify({
          form: base,
          notifications: prefs,
          callSoundEnabled: resolvedCallSoundEnabled,
          callRingbackVolume: resolvedRingbackVolume,
        }));
      }
      } catch (e) {
        // Show the form with whatever we have rather than a dead spinner.
        if (typeof console !== 'undefined') console.error('[ProfileAccountPage] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile, roleType]);

  useEffect(() => {
    if (location.state?.focus !== 'notifications') return;
    const t = setTimeout(() => {
      notificationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(t);
  }, [location.state?.focus]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setTimeout(() => {
      setSaveNotice('');
      setSaveState('idle');
    }, 4000);
    return () => clearTimeout(t);
  }, [saveState]);

  const markEdited = () => {
    if (saveNotice) setSaveNotice('');
    if (saveState === 'saved' || saveState === 'error') setSaveState('idle');
  };
  const patch = (k, v) => {
    markEdited();
    setForm((s) => ({ ...s, [k]: v }));
  };
  const hasChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    return JSON.stringify({ form, notifications, callSoundEnabled, callRingbackVolume }) !== initialSnapshot;
  }, [form, notifications, callSoundEnabled, callRingbackVolume, initialSnapshot]);

  const saveAll = async () => {
    if (!user?.id || !hasChanges) return;

    const wUSave = normalizeWeightUnit(form.bodyweight_unit);
    const loadSave = normalizeLoadUnit(form.load_unit);
    const hasCW =
      String(form.current_weight || '').trim()
      || String(form.current_weight_st || '').trim()
      || String(form.current_weight_lbrem || '').trim();
    const hasTW =
      String(form.target_weight || '').trim()
      || String(form.target_weight_st || '').trim()
      || String(form.target_weight_lbrem || '').trim();
    const cwKgParsed = parseWeightInputsToKg({
      weightUnit: wUSave,
      kgText: wUSave === 'kg' ? form.current_weight : '',
      lbText: wUSave === 'lb' ? form.current_weight : '',
      stoneText: wUSave === 'st_lb' ? form.current_weight_st : '',
      poundText: wUSave === 'st_lb' ? form.current_weight_lbrem : '',
    });
    const twKgParsed = parseWeightInputsToKg({
      weightUnit: wUSave,
      kgText: wUSave === 'kg' ? form.target_weight : '',
      lbText: wUSave === 'lb' ? form.target_weight : '',
      stoneText: wUSave === 'st_lb' ? form.target_weight_st : '',
      poundText: wUSave === 'st_lb' ? form.target_weight_lbrem : '',
    });
    if (hasCW && cwKgParsed == null) {
      toast.error('Please enter a valid current weight');
      return;
    }
    if (hasTW && twKgParsed == null) {
      toast.error('Please enter a valid target weight');
      return;
    }
    if (roleType === 'client' && form.training_days !== '') {
      const td = Number(form.training_days);
      if (!Number.isFinite(td) || td < 0 || td > 7) {
        toast.error('Training days must be between 0 and 7');
        return;
      }
    }

    setSaving(true);
    setSaveState('saving');
    try {
      const supabase = hasSupabase ? getSupabase() : null;
      const cw = cwKgParsed != null ? Math.min(320, Math.max(15, cwKgParsed)) : null;
      const tw = twKgParsed != null ? Math.min(320, Math.max(15, twKgParsed)) : null;
      const profilePatch = {
        full_name: form.full_name?.trim() ? form.full_name.trim() : null,
        display_name: form.display_name || null,
        goal: form.goal || null,
        training_focus: form.training_focus || null,
        current_weight: hasCW && cw != null ? cw : null,
        target_weight: hasTW && tw != null ? tw : null,
        units: wUSave === 'lb' ? 'lb' : 'kg',
        height_unit: normalizeHeightUnit(form.height_unit),
        bodyweight_unit: wUSave,
        load_unit: loadSave,
        food_quantity_unit: normalizeFoodQuantityUnit(form.food_quantity_unit),
        nutrition_label_display: normalizeNutritionLabelDisplay(form.nutrition_label_display),
        water_unit: normalizeWaterUnit(form.water_unit),
        sodium_unit: normalizeSodiumUnit(form.sodium_unit),
      };
      // Fire-and-forget: this is a local cache (and setNativePref writes
      // localStorage synchronously before touching native), so the real save
      // must never wait on it. Awaiting it here is what left "saving…" spinning
      // forever when the native Preferences bridge stopped responding.
      void setNativePref(WEIGHT_UNIT_PREF_KEY, wUSave);
      const coachOptionalPatch =
        roleType === 'coach'
          ? {
              business_name: form.business_name || null,
              avatar_url: form.avatar_url || null,
              coach_focus: form.coaching_focus || null,
              coaching_style: form.coaching_style || null,
              taking_clients: form.taking_clients !== false,
            }
          : null;
      if (roleType === 'coach') {
        // Keep coach optional fields out of the primary patch so missing optional
        // columns cannot block saving core account/profile fields.
      }
      if (import.meta.env.DEV) {
        console.info('[ProfileAccount] save payload', {
          userId: user.id,
          profileId: profile?.id ?? null,
          names: { full_name: form.full_name, display_name: form.display_name },
          profilePatch,
        });
      }
      let profileRes = await updateProfile(profilePatch);
      let optionalCoachRes = null;
      if (import.meta.env.DEV) console.info('[ProfileAccount] profile response', JSON.stringify(profileRes));
      if (profileRes?.error && supabase) {
        // Fallback explicit update path to avoid transient context/session drift.
        const fallback = await supabase
          .from('profiles')
          .update(profilePatch)
          .eq('id', user.id)
          .select()
          .single();
        if (import.meta.env.DEV) console.info('[ProfileAccount] fallback profile response', JSON.stringify(fallback));
        if (fallback.error) throw fallback.error;
        profileRes = { error: null, data: fallback.data ?? null };
      }
      if (profileRes?.error) throw profileRes.error;

      if (supabase && roleType === 'coach' && coachOptionalPatch) {
        optionalCoachRes = await supabase
          .from('profiles')
          .update(coachOptionalPatch)
          .eq('id', user.id)
          .select('business_name, avatar_url, coach_focus, coaching_style, taking_clients')
          .maybeSingle();
        if (optionalCoachRes?.error && import.meta.env.DEV) {
          console.warn('[ProfileAccount] optional coach field save failed', optionalCoachRes.error);
        }
      }

      if (supabase && form.email && form.email !== (profile?.email || user?.email || '')) {
        const { error } = await supabase.auth.updateUser({ email: form.email.trim() });
        if (error) throw error;
      }
      if (supabase && password.trim()) {
        const pwError = getPasswordError(password.trim());
        if (pwError) throw new Error(pwError);
        const { error } = await supabase.auth.updateUser({ password: password.trim() });
        if (error) throw error;
        setPassword('');
      }
      if (supabase && roleType === 'client') {
        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            training_days_per_week: form.training_days ? Number(form.training_days) : null,
            injuries: form.injuries || null,
          })
          .eq('user_id', user.id);
        if (clientErr) throw clientErr;
      }
      if (supabase && roleType === 'personal') {
        const personalPayload = { user_id: user.id, primary_goal: form.goal || null, updated_at: new Date().toISOString() };
        if (import.meta.env.DEV) {
          console.info('[ProfileAccount] personal upsert payload', personalPayload);
        }
        const { data: personalRow, error: personalErr } = await supabase
          .from('personal')
          .upsert(personalPayload, { onConflict: 'user_id' })
          .select('user_id, primary_goal')
          .single();
        if (import.meta.env.DEV) {
          console.info('[ProfileAccount] personal upsert response', { data: personalRow ?? null, error: personalErr ?? null });
        }
        if (personalErr) throw personalErr;
      }
      const notificationOk = await updateNotificationPreferences(user.id, notifications);
      if (!notificationOk) throw new Error('Failed to save notification preferences');
      setCallSoundEnabled(callSoundEnabled);
      setCallRingbackVolume(callRingbackVolume);
      await setNativePref(CALL_SOUND_PREF_KEYS.enabled, callSoundEnabled ? '1' : '0');
      await setNativePref(CALL_SOUND_PREF_KEYS.ringbackVolume, String(callRingbackVolume));
      const refreshRes = await refreshProfile();
      if (refreshRes?.error && import.meta.env.DEV) {
        console.warn('[ProfileAccount] refreshProfile failed', refreshRes.error);
      }
      const authoritativeProfile = refreshRes?.data || profileRes?.data || null;
      const optionalCoachData = optionalCoachRes?.data || null;
      if (authoritativeProfile) {
        if (import.meta.env.DEV) {
          console.info('[ProfileAccount] local profile sync', {
            profileId: authoritativeProfile.id,
            full_name: authoritativeProfile.full_name ?? null,
            display_name: authoritativeProfile.display_name ?? null,
          });
        }
        setForm((prev) => ({
          ...prev,
          full_name: authoritativeProfile.full_name ?? '',
          display_name: authoritativeProfile.display_name ?? '',
          goal: authoritativeProfile.goal ?? prev.goal,
          training_focus: authoritativeProfile.training_focus ?? prev.training_focus,
          current_weight: (() => {
            const u = normalizeWeightUnit(
              authoritativeProfile.bodyweight_unit || authoritativeProfile.weight_unit || authoritativeProfile.units
            );
            const parts = weightKgToFormParts(profileCurrentWeightKg(authoritativeProfile), u);
            return u === 'st_lb' ? '' : (parts.primary || '');
          })(),
          target_weight: (() => {
            const u = normalizeWeightUnit(
              authoritativeProfile.bodyweight_unit || authoritativeProfile.weight_unit || authoritativeProfile.units
            );
            const parts = weightKgToFormParts(profileTargetWeightKg(authoritativeProfile), u);
            return u === 'st_lb' ? '' : (parts.primary || '');
          })(),
          current_weight_st: (() => {
            const u = normalizeWeightUnit(
              authoritativeProfile.bodyweight_unit || authoritativeProfile.weight_unit || authoritativeProfile.units
            );
            const parts = weightKgToFormParts(profileCurrentWeightKg(authoritativeProfile), u);
            return u === 'st_lb' ? (parts.primary || '') : '';
          })(),
          current_weight_lbrem: (() => {
            const u = normalizeWeightUnit(
              authoritativeProfile.bodyweight_unit || authoritativeProfile.weight_unit || authoritativeProfile.units
            );
            const parts = weightKgToFormParts(profileCurrentWeightKg(authoritativeProfile), u);
            return u === 'st_lb' ? (parts.secondary || '') : '';
          })(),
          target_weight_st: (() => {
            const u = normalizeWeightUnit(
              authoritativeProfile.bodyweight_unit || authoritativeProfile.weight_unit || authoritativeProfile.units
            );
            const parts = weightKgToFormParts(profileTargetWeightKg(authoritativeProfile), u);
            return u === 'st_lb' ? (parts.primary || '') : '';
          })(),
          target_weight_lbrem: (() => {
            const u = normalizeWeightUnit(
              authoritativeProfile.bodyweight_unit || authoritativeProfile.weight_unit || authoritativeProfile.units
            );
            const parts = weightKgToFormParts(profileTargetWeightKg(authoritativeProfile), u);
            return u === 'st_lb' ? (parts.secondary || '') : '';
          })(),
          units: authoritativeProfile.units ?? prev.units,
          height_unit: normalizeHeightUnit(authoritativeProfile.height_unit ?? prev.height_unit),
          bodyweight_unit: normalizeWeightUnit(
            authoritativeProfile.bodyweight_unit ?? authoritativeProfile.weight_unit ?? prev.bodyweight_unit
          ),
          load_unit: normalizeLoadUnit(authoritativeProfile.load_unit ?? prev.load_unit),
          food_quantity_unit: normalizeFoodQuantityUnit(
            authoritativeProfile.food_quantity_unit ?? prev.food_quantity_unit
          ),
          nutrition_label_display: normalizeNutritionLabelDisplay(
            authoritativeProfile.nutrition_label_display ?? prev.nutrition_label_display
          ),
          water_unit: normalizeWaterUnit(authoritativeProfile.water_unit ?? prev.water_unit),
          sodium_unit: normalizeSodiumUnit(authoritativeProfile.sodium_unit ?? prev.sodium_unit),
          business_name: optionalCoachData?.business_name ?? authoritativeProfile.business_name ?? prev.business_name,
          avatar_url: optionalCoachData?.avatar_url ?? authoritativeProfile.avatar_url ?? prev.avatar_url,
          coaching_focus: optionalCoachData?.coach_focus ?? authoritativeProfile.coach_focus ?? prev.coaching_focus,
          coaching_style: optionalCoachData?.coaching_style ?? authoritativeProfile.coaching_style ?? prev.coaching_style,
          taking_clients: (optionalCoachData?.taking_clients ?? authoritativeProfile.taking_clients) !== false,
        }));
      }

      if (roleType === 'coach') {
        writeCoachLocalDraft(user.id, {
          business_name: form.business_name || '',
          avatar_url: form.avatar_url || '',
          coaching_style: form.coaching_style || '',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['client-profile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile', user.id] });
      if (roleType === 'personal') {
        queryClient.invalidateQueries({ queryKey: personalNutritionTargetsQueryKey(user.id) });
      }

      if (import.meta.env.DEV) {
        console.info('[ProfileAccount] UI state after save', {
          saveState: 'saved',
          full_name: profileRes?.data?.full_name ?? form.full_name,
        });
      }

      toast.success('Saved');
      setSaveState('saved');
      setSaveNotice('All changes saved');
      setInitialSnapshot(JSON.stringify({
        form: {
          ...form,
          full_name: profileRes?.data?.full_name ?? form.full_name,
          display_name: profileRes?.data?.display_name ?? form.display_name,
        },
        notifications,
        callSoundEnabled,
        callRingbackVolume,
      }));
    } catch (error) {
      console.error('[ProfileAccount] save failed', error);
      trackRecoverableError('ProfileAccountPage', 'saveProfile', error);
      const notice = humanizeSupabaseError(error);
      toast.error(notice);
      setSaveState('error');
      setSaveNotice(notice);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader message="Loading profile…" />;

  const identityRows = [
    { key: 'full_name', icon: User, title: 'Full name', value: toDisplayValue(form.full_name), type: 'text' },
    { key: 'display_name', icon: User, title: 'Display name', value: toDisplayValue(form.display_name), type: 'text' },
    { key: 'email', icon: Shield, title: 'Email', value: toDisplayValue(form.email), type: 'email' },
    { key: 'password', icon: Shield, title: 'Password', value: password ? 'Ready to update password' : 'Change password', type: 'password' },
  ];

  const personalTrainingRows = [
    { key: 'goal', icon: Target, title: 'Primary goal', value: toDisplayValue(form.goal), type: 'text' },
    { key: 'training_focus', icon: Target, title: 'Training focus', value: toDisplayValue(form.training_focus), type: 'text' },
    {
      key: 'current_weight',
      icon: Target,
      title: 'Current weight',
      value:
        normalizeWeightUnit(form.bodyweight_unit) === 'st_lb'
          ? toDisplayValue(`${form.current_weight_st} st ${form.current_weight_lbrem} lb`.trim() || 'Not set')
          : toDisplayValue(form.current_weight ? `${form.current_weight} ${weightUnitShortLabel(form.bodyweight_unit)}` : ''),
      type: 'number',
    },
    {
      key: 'target_weight',
      icon: Target,
      title: 'Target weight',
      value:
        normalizeWeightUnit(form.bodyweight_unit) === 'st_lb'
          ? toDisplayValue(`${form.target_weight_st} st ${form.target_weight_lbrem} lb`.trim() || 'Not set')
          : toDisplayValue(form.target_weight ? `${form.target_weight} ${weightUnitShortLabel(form.bodyweight_unit)}` : ''),
      type: 'number',
    },
  ];
  const clientTrainingRows = [
    { key: 'goal', icon: Target, title: 'Goal', value: toDisplayValue(form.goal), type: 'text' },
    {
      key: 'current_weight',
      icon: Target,
      title: 'Current weight',
      value:
        normalizeWeightUnit(form.bodyweight_unit) === 'st_lb'
          ? toDisplayValue(`${form.current_weight_st} st ${form.current_weight_lbrem} lb`.trim() || 'Not set')
          : toDisplayValue(form.current_weight ? `${form.current_weight} ${weightUnitShortLabel(form.bodyweight_unit)}` : ''),
      type: 'number',
    },
    {
      key: 'target_weight',
      icon: Target,
      title: 'Target weight',
      value:
        normalizeWeightUnit(form.bodyweight_unit) === 'st_lb'
          ? toDisplayValue(`${form.target_weight_st} st ${form.target_weight_lbrem} lb`.trim() || 'Not set')
          : toDisplayValue(form.target_weight ? `${form.target_weight} ${weightUnitShortLabel(form.bodyweight_unit)}` : ''),
      type: 'number',
    },
    { key: 'training_days', icon: Target, title: 'Training days per week', value: toDisplayValue(form.training_days), type: 'number' },
    { key: 'injuries', icon: Target, title: 'Injuries / limitations', value: toDisplayValue(form.injuries), type: 'text' },
  ];
  const coachTrainingRows = [
    { key: 'coaching_focus', icon: Target, title: 'Coaching focus', value: toDisplayValue(form.coaching_focus), type: 'text' },
    { key: 'coaching_style', icon: Target, title: 'Bio / coaching style', value: toDisplayValue(form.coaching_style), type: 'text', multiline: true },
    { key: 'business_name', icon: Target, title: 'Business name', value: toDisplayValue(form.business_name), type: 'text' },
    { key: 'avatar_url', icon: Target, title: 'Profile image URL', value: toDisplayValue(form.avatar_url), type: 'text' },
  ];
  const roleRows = roleType === 'personal' ? personalTrainingRows : roleType === 'client' ? clientTrainingRows : coachTrainingRows;
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/more', { replace: true });
  };

  const activeField = activeSheet ? roleRows.find((r) => r.key === activeSheet) || identityRows.find((r) => r.key === activeSheet) : null;

  const memberSince =
    profile?.created_at || user?.created_at
      ? new Date(profile?.created_at || user?.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      : null;

  return (
    <PersonalCanvas>
    <div
      style={{ minHeight: '100%', background: roleType === 'personal' ? 'transparent' : colors.bg, color: colors.text }}
      {...atlasMigrationDataAttributes(profileAccountMigration.phase, profileAccountMigration.primary)}
    >
      <TopBar title="Account" onBack={handleBack} />
      <PersonalColumn variant={roleType === 'personal' ? 'narrow' : 'default'}>
    <div
      style={
        roleType === 'personal'
          ? {
              paddingBottom: `calc(${spacing[32]}px + 96px + env(safe-area-inset-bottom, 0px))`,
              color: colors.text,
            }
          : {
              ...pageContainer,
              maxWidth: isDesktopWeb ? 640 : undefined,
              margin: '0 auto',
              paddingBottom: `calc(${spacing[32]}px + 96px + env(safe-area-inset-bottom, 0px))`,
              color: colors.text,
            }
      }
    >
      {roleType === 'personal' && (
        <Card style={{ ...standardCard, padding: spacing[16], marginBottom: spacing[12] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12] }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: colors.primarySubtle,
                color: colors.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(form.full_name || profile?.display_name || user?.email || '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>{form.full_name || profile?.display_name || 'Your name'}</p>
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.muted, wordBreak: 'break-word' }}>{form.email || user?.email}</p>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile & sign-in</p>
        <div style={{ marginTop: spacing[8] }}>
          {identityRows.map((row, index) => (
            <div key={row.key} style={{ borderBottom: index === identityRows.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
              <SettingsRow icon={row.icon} title={row.title} value={row.value} onPress={() => setActiveSheet(row.key)} />
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body metrics</p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
          Height and bodyweight display only. Stored as cm / kg; we convert for display. Independent of training loads.
        </p>
        <div style={{ marginTop: spacing[12] }}>
          <MeasurementUnitSegments
            label="Height unit"
            options={HEIGHT_SEGMENT_OPTIONS}
            value={normalizeHeightUnit(form.height_unit)}
            onChange={(id) => {
              markEdited();
              patch('height_unit', id);
            }}
          />
          <MeasurementUnitSegments
            label="Bodyweight unit"
            options={BODYWEIGHT_SEGMENT_OPTIONS}
            value={normalizeWeightUnit(form.bodyweight_unit)}
            onChange={(id) => {
              markEdited();
              const w = normalizeWeightUnit(id);
              patch('bodyweight_unit', w);
              patch('units', w === 'lb' ? 'lb' : 'kg');
              void setNativePref(WEIGHT_UNIT_PREF_KEY, w);
            }}
          />
        </div>
      </Card>

      <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Training</p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
          Bar and machine loads in workouts (kg or lb only). Does not change how bodyweight is shown.
        </p>
        <div style={{ marginTop: spacing[12] }}>
          <MeasurementUnitSegments
            label="Load unit"
            options={LOAD_SEGMENT_OPTIONS}
            value={normalizeLoadUnit(form.load_unit)}
            onChange={(id) => {
              markEdited();
              patch('load_unit', normalizeLoadUnit(id));
            }}
          />
        </div>
      </Card>

      <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nutrition units</p>
        <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
          Food logging, packaged labels, hydration, and sodium — separate from bodyweight and bar load. Macros stay in grams; calories stay kcal.
        </p>
        <div style={{ marginTop: spacing[12] }}>
          <MeasurementUnitSegments
            label="Food quantity"
            options={FOOD_QUANTITY_SEGMENT_OPTIONS}
            value={normalizeFoodQuantityUnit(form.food_quantity_unit)}
            onChange={(id) => {
              markEdited();
              patch('food_quantity_unit', normalizeFoodQuantityUnit(id));
            }}
          />
          <MeasurementUnitSegments
            label="Nutrition label default"
            options={NUTRITION_LABEL_SEGMENT_OPTIONS}
            value={normalizeNutritionLabelDisplay(form.nutrition_label_display)}
            onChange={(id) => {
              markEdited();
              patch('nutrition_label_display', normalizeNutritionLabelDisplay(id));
            }}
          />
          <MeasurementUnitSegments
            label="Water"
            options={WATER_UNIT_SEGMENT_OPTIONS}
            value={normalizeWaterUnit(form.water_unit)}
            onChange={(id) => {
              markEdited();
              patch('water_unit', normalizeWaterUnit(id));
            }}
          />
          <MeasurementUnitSegments
            label="Sodium"
            options={SODIUM_UNIT_SEGMENT_OPTIONS}
            value={normalizeSodiumUnit(form.sodium_unit)}
            onChange={(id) => {
              markEdited();
              patch('sodium_unit', normalizeSodiumUnit(id));
            }}
          />
        </div>
      </Card>

      <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {roleType === 'personal' ? 'Goals & training' : 'Training / role setup'}
        </p>
        <div style={{ marginTop: spacing[8] }}>
          {roleRows.map((row, index) => (
            <div key={row.key} style={{ borderBottom: index === roleRows.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
              <SettingsRow icon={row.icon} title={row.title} value={row.value} onPress={() => setActiveSheet(row.key)} />
            </div>
          ))}
        </div>
        {roleType === 'coach' ? (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[12],
              marginTop: spacing[12],
              paddingTop: spacing[12],
              borderTop: `1px solid ${colors.border}`,
              cursor: 'pointer',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>Taking new clients</p>
              <p style={{ margin: `${spacing[2]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>
                Public /coach page shows “currently taking clients” or waitlist-only.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.taking_clients !== false}
              onChange={(e) => {
                markEdited();
                patch('taking_clients', e.target.checked);
              }}
              style={{ width: 22, height: 22, flexShrink: 0 }}
              aria-label="Taking new clients"
            />
          </label>
        ) : null}
        {roleType === 'coach' && (
          <div style={{ display: 'grid', gap: 8, marginTop: spacing[12] }}>
            <button type="button" onClick={() => navigate('/onboarding-link')} style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}>Coach code / invite tools</button>
            <button type="button" onClick={() => navigate('/earnings')} style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}>Billing / payouts</button>
            {inviteLink && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(inviteLink);
                  toast.success('Invite link copied');
                }}
                style={{ minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}
              >
                Copy invite link
              </button>
            )}
          </div>
        )}
      </Card>

      {roleType === 'personal' && (
        <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nutrition targets</p>
          <div style={{ marginTop: spacing[8] }}>
            <div style={{ borderBottom: 'none' }}>
              <SettingsRow
                icon={UtensilsCrossed}
                title="Nutrition targets"
                value={nutritionTargetsSummary}
                onPress={() => navigate('/nutrition-targets')}
              />
            </div>
          </div>
        </Card>
      )}

      <div ref={notificationsSectionRef}>
        <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[10] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notifications</p>
        {roleType === 'personal' && (
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            Reminder toggles sync when you save. Open Activity & alerts on the More tab for your inbox.
          </p>
        )}
        <div style={{ display: 'grid', gap: 8, marginTop: spacing[10] }}>
          {visibleNotificationRows.map(({ key, label }) => (
            <CompactToggle key={key} label={label} checked={!!notifications[key]} onChange={(next) => {
              markEdited();
              setNotifications((s) => ({ ...s, [key]: next }));
            }}
            />
          ))}
        </div>
        <div style={{ marginTop: spacing[12], paddingTop: spacing[10], borderTop: `1px solid ${colors.border}` }}>
          <CompactToggle
            label="Call sounds"
            checked={!!callSoundEnabled}
            onChange={(next) => {
              markEdited();
              setCallSoundEnabledState(next);
            }}
          />
          <div style={{ marginTop: spacing[8] }}>
            <label style={{ display: 'block', fontSize: 12, color: colors.muted, marginBottom: 6 }}>
              Ringback volume: {Math.round(callRingbackVolume * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(callRingbackVolume * 100)}
              onChange={(e) => {
                markEdited();
                setCallRingbackVolumeState(Math.max(0, Math.min(1, Number(e.target.value) / 100)));
              }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        </Card>
      </div>

      <Card style={{ ...standardCard, padding: spacing[14], marginBottom: spacing[12] }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</p>
        <div style={{ marginTop: spacing[10], fontSize: 14, color: colors.text, lineHeight: 1.5 }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>Signed in as</p>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontWeight: 600, wordBreak: 'break-word' }}>{form.email || user?.email}</p>
          {memberSince && (
            <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 13, color: colors.muted }}>
              Member since {memberSince}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut('/login')}
          style={{
            marginTop: spacing[14],
            width: '100%',
            minHeight: touchTargetMin,
            borderRadius: radii.button,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.destructive,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </Card>

      {!activeSheet && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            padding: `${spacing[12]}px ${spacing[16]}px calc(${spacing[12]}px + env(safe-area-inset-bottom, 0px))`,
            background: `linear-gradient(to top, ${colors.bg} 85%, transparent)`,
            borderTop: `1px solid ${colors.border}`,
            maxWidth: isDesktopWeb ? 640 : undefined,
            margin: '0 auto',
          }}
        >
          {!!saveNotice && (
            <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, fontWeight: 700, color: saveState === 'error' ? colors.destructive : colors.success }}>
              {saveNotice}
            </p>
          )}
          <button
            type="button"
            onClick={saveAll}
            disabled={saving || !hasChanges}
            style={{
              width: '100%',
              minHeight: touchTargetMin + 2,
              borderRadius: radii.button,
              border: 'none',
              background: saveState === 'saved' ? colors.success : colors.primary,
              color: '#fff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: saving || !hasChanges ? 0.55 : 1,
              cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
            }}
          >
            {saveState === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {saveState === 'saved' && <Check size={14} />}
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save changes'}
          </button>
        </div>
      )}

      {activeField && (
        <div
          role="button"
          tabIndex={-1}
          onClick={() => setActiveSheet(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: colors.overlay,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 60,
            // Lift above the keyboard. This sheet is position:fixed, so the
            // shell's scroll-focused-field-into-view can't help it — without
            // this the keyboard sits straight on top of the field you're
            // editing. When the keyboard is up it also covers the home
            // indicator, so the safe-area inset must not be added as well or a
            // dead gap appears between sheet and keyboard.
            paddingBottom: keyboardInset > 0 ? `${keyboardInset}px` : 'env(safe-area-inset-bottom, 0px)',
            transition: 'padding-bottom 140ms ease-out',
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              borderRadius: 16,
              margin: spacing[12],
              padding: spacing[14],
              maxHeight: keyboardInset > 0 ? '50vh' : '72vh',
              overflowY: 'auto',
            }}
          >
            {activeField.key === 'current_weight' || activeField.key === 'target_weight' ? (
              <>
                <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{activeField.title}</p>
                <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                  Enter in {weightUnitShortLabel(form.bodyweight_unit)}. We store weight as kg under the hood.
                </p>
                {normalizeWeightUnit(form.bodyweight_unit) === 'st_lb' ? (
                  <div style={{ marginTop: spacing[12], display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
                    <FieldEditor
                      title="Stone"
                      value={activeField.key === 'current_weight' ? form.current_weight_st : form.target_weight_st}
                      onChange={(val) => patch(activeField.key === 'current_weight' ? 'current_weight_st' : 'target_weight_st', val)}
                      type="number"
                      placeholder="e.g. 11"
                    />
                    <FieldEditor
                      title="Pounds"
                      value={activeField.key === 'current_weight' ? form.current_weight_lbrem : form.target_weight_lbrem}
                      onChange={(val) => patch(activeField.key === 'current_weight' ? 'current_weight_lbrem' : 'target_weight_lbrem', val)}
                      type="number"
                      placeholder="e.g. 4"
                    />
                  </div>
                ) : (
                  <div style={{ marginTop: spacing[12] }}>
                    <FieldEditor
                      title={`${activeField.title} (${weightUnitShortLabel(form.bodyweight_unit)})`}
                      value={form[activeField.key]}
                      onChange={(val) => patch(activeField.key, val)}
                      type="number"
                      placeholder={normalizeWeightUnit(form.bodyweight_unit) === 'lb' ? 'e.g. 175' : 'e.g. 79'}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: spacing[12] }}>
                  <button type="button" onClick={() => setActiveSheet(null)} style={{ flex: 1, minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text }}>Done</button>
                </div>
              </>
            ) : (
              <>
                <FieldEditor
                  title={activeField.title}
                  value={activeField.key === 'password' ? password : form[activeField.key]}
                  onChange={(val) => {
                    if (activeField.key === 'password') {
                      markEdited();
                      setPassword(val);
                    }
                    else patch(activeField.key, val);
                  }}
                  type={activeField.type}
                  multiline={!!activeField.multiline}
                  placeholder={activeField.key === 'password' ? 'Enter new password' : 'Update value'}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: spacing[12] }}>
                  <button type="button" onClick={() => setActiveSheet(null)} style={{ flex: 1, minHeight: touchTargetMin, borderRadius: radii.button, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text }}>Done</button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

    </div>
      </PersonalColumn>
    </div>
    </PersonalCanvas>
  );
}
