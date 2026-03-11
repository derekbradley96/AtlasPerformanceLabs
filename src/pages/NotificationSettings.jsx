import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Switch } from '@/components/ui/switch';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getNotificationSettings, setNotificationSetting } from '@/lib/notificationSettingsStorage';
import { getTrainerAutoOpenReview, setTrainerAutoOpenReview, getTrainerSilentMode, setTrainerSilentMode } from '@/lib/trainerPreferencesStorage';
import { useAuth } from '@/lib/AuthContext';
import { impactLight } from '@/lib/haptics';

const TOGGLES = [
  { key: 'checkin_reminders', label: 'Check-in due reminders', description: 'Remind when client check-ins are due' },
  { key: 'new_message_alerts', label: 'New message alerts', description: 'Notify when you receive a message' },
  { key: 'payment_overdue_alerts', label: 'Payment overdue alerts', description: 'Alert when a payment is overdue' },
];

export default function NotificationSettings() {
  const { role } = useAuth();
  const isTrainer = role === 'trainer';
  const [settings, setSettings] = useState(() => getNotificationSettings());
  const [autoOpenReview, setAutoOpenReview] = useState(() => getTrainerAutoOpenReview());
  const [silentMode, setSilentMode] = useState(() => getTrainerSilentMode());

  useEffect(() => {
    setSettings(getNotificationSettings());
  }, []);
  useEffect(() => {
    setAutoOpenReview(getTrainerAutoOpenReview());
  }, []);
  useEffect(() => {
    setSilentMode(getTrainerSilentMode());
  }, []);

  const handleAutoOpenReview = useCallback((checked) => {
    setTrainerAutoOpenReview(checked);
    setAutoOpenReview(checked);
  }, []);

  const handleSilentMode = useCallback(async (checked) => {
    await impactLight();
    setTrainerSilentMode(checked);
    setSilentMode(checked);
  }, []);

  const handleToggle = useCallback(async (key, checked) => {
    const next = setNotificationSetting(key, checked);
    setSettings(next);

    if (key === 'checkin_reminders' && checked && Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = await import(/* @vite-ignore */ '@capacitor/local-notifications');
        const permission = await LocalNotifications.requestPermissions();
        if (permission?.display === 'granted') {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: 1,
                title: 'Check-in reminder',
                body: 'Sample: A client check-in is due soon.',
                schedule: { at: new Date(Date.now() + 60 * 1000) },
              },
            ],
          });
        }
      } catch (_) {
        /* Plugin not installed or permission denied */
      }
    }
  }, []);

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
          Choose which alerts you want. Push notifications coming soon.
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
              checked={settings[t.key] ?? true}
              onCheckedChange={(checked) => handleToggle(t.key, checked)}
            />
          </div>
        ))}
      </Card>

      {isTrainer && (
        <>
          <Card style={{ padding: 0, marginBottom: spacing[16] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing[16],
                minHeight: 68,
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium" style={{ color: colors.text }}>Auto-open Global Review</p>
                <p className="text-[13px] mt-0.5" style={{ color: colors.muted }}>If you have active items, Atlas opens Review Center first.</p>
              </div>
              <Switch
                checked={autoOpenReview}
                onCheckedChange={handleAutoOpenReview}
              />
            </div>
          </Card>
          <Card style={{ padding: 0, marginBottom: spacing[16] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing[16],
                minHeight: 68,
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium" style={{ color: colors.text }}>Silent Mode</p>
                <p className="text-[13px] mt-0.5" style={{ color: colors.muted }}>Show only critical items by default.</p>
              </div>
              <Switch
                checked={silentMode}
                onCheckedChange={handleSilentMode}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
