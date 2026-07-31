import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { getNotificationPreferences, updateNotificationPreference } from '@/lib/notificationPreferences';
import { hasSupabase } from '@/lib/supabaseClient';
import { impactLight } from '@/lib/haptics';
import { atlasMigrationDataAttributes, deriveNotificationPrefsPageRouteState } from '@/lib/atlasMigrationPhases';

const TOGGLES = [
  { key: 'checkins', label: 'Check-ins', description: 'Check-in due, pose check, and review notifications' },
  { key: 'messages', label: 'Messages', description: 'New message alerts' },
  { key: 'workouts', label: 'Workouts', description: 'Workout reminders when a session is scheduled' },
  { key: 'habits', label: 'Habits', description: 'Daily habit reminders' },
  { key: 'nutrition', label: 'Nutrition & supplements', description: 'Supplement and nutrition reminders' },
  { key: 'peak_week', label: 'Peak week', description: 'Peak week updates and day instructions' },
  { key: 'payments', label: 'Payments', description: 'Payment due and overdue alerts' },
  { key: 'progress_reminders', label: 'Progress prompts', description: 'Occasional prompts to review your progress' },
];

// Personal users get workout reminders + occasional progress prompts. The rest
// (messages, check-in/pose/review, peak week, coaching payments) only fire for
// coach-linked clients, so we don't show — or promise — them here.
const PERSONAL_TOGGLE_KEYS = new Set(['workouts', 'progress_reminders']);

export default function NotificationSettingsPage() {
  const { user, effectiveRole } = useAuth();
  const profileId = user?.id;
  const isPersonalUser = isPersonal(effectiveRole);
  const visibleToggles = useMemo(
    () => (isPersonalUser ? TOGGLES.filter((t) => PERSONAL_TOGGLE_KEYS.has(t.key)) : TOGGLES),
    [isPersonalUser],
  );
  const [prefs, setPrefs] = useState({
    checkins: true,
    messages: true,
    habits: true,
    peak_week: true,
    payments: true,
    workouts: true,
    nutrition: true,
    progress_reminders: true,
  });
  const [loading, setLoading] = useState(!!profileId && hasSupabase);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!profileId || !hasSupabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getNotificationPreferences(profileId).then((data) => {
      if (!cancelled && data) setPrefs(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profileId]);

  const handleToggle = useCallback(async (key, checked) => {
    if (!profileId || !hasSupabase) return;
    setPrefs((prev) => ({ ...prev, [key]: checked }));
    impactLight?.();
    setSaving(key);
    const ok = await updateNotificationPreference(profileId, key, checked);
    setSaving((s) => (s === key ? null : s));
    if (!ok) {
      setPrefs((prev) => ({ ...prev, [key]: !checked }));
    }
  }, [profileId]);

  const prefsPageMigrationAttrs = useMemo(() => {
    const s = deriveNotificationPrefsPageRouteState({ surface: loading ? 'loading' : 'active' });
    return atlasMigrationDataAttributes(s.phase, s.primary);
  }, [loading]);

  if (loading) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
          paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
        }}
        {...prefsPageMigrationAttrs}
      >
        <p style={{ color: colors.muted, fontSize: 14 }}>Loading preferences…</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
      }}
      {...prefsPageMigrationAttrs}
    >
      <div style={{ marginBottom: spacing[8] }}>
        <p className="text-[13px]" style={{ color: colors.muted }}>
          {isPersonalUser
            ? 'Reminders for your solo training.'
            : 'Choose which notification types you want to receive.'}
        </p>
      </div>

      <Card style={{ padding: 0, marginBottom: spacing[16] }}>
        {visibleToggles.map((t, idx) => (
          <div
            key={t.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing[16],
              borderBottom: idx < visibleToggles.length - 1 ? `1px solid ${colors.border}` : 'none',
              minHeight: 68,
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium" style={{ color: colors.text }}>{t.label}</p>
              <p className="text-[13px] mt-0.5" style={{ color: colors.muted }}>{t.description}</p>
            </div>
            <Switch
              checked={prefs[t.key] ?? true}
              onCheckedChange={(checked) => handleToggle(t.key, checked)}
              disabled={saving === t.key}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
