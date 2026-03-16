import React, { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getNotificationPreferences, updateNotificationPreference } from '@/lib/notificationPreferences';
import { hasSupabase } from '@/lib/supabaseClient';
import { impactLight } from '@/lib/haptics';

const TOGGLES = [
  { key: 'checkins', label: 'Check-ins', description: 'Check-in due and review notifications' },
  { key: 'messages', label: 'Messages', description: 'New message alerts' },
  { key: 'habits', label: 'Habits', description: 'Daily habit reminders' },
  { key: 'peak_week', label: 'Peak week', description: 'Peak week updates and day instructions' },
  { key: 'payments', label: 'Payments', description: 'Payment due and overdue alerts' },
];

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const profileId = user?.id;
  const [prefs, setPrefs] = useState({
    checkins: true,
    messages: true,
    habits: true,
    peak_week: true,
    payments: true,
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

  if (loading) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
          paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
        }}
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
    >
      <div style={{ marginBottom: spacing[8] }}>
        <p className="text-[13px]" style={{ color: colors.muted }}>
          Choose which notification types you want to receive.
        </p>
      </div>

      <Card style={{ padding: 0, marginBottom: spacing[16] }}>
        {TOGGLES.map((t, idx) => (
          <div
            key={t.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing[16],
              borderBottom: idx < TOGGLES.length - 1 ? `1px solid ${colors.border}` : 'none',
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
