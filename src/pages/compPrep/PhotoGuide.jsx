import React, { useState, useMemo } from 'react';
import { Camera, Sun, Ruler, Clock, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getClientByUserId } from '@/data/selectors';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { getPhotoGuideUnderstood, setPhotoGuideUnderstood } from '@/lib/repos/compPrepRepo';
import { impactLight, notificationSuccess } from '@/lib/haptics';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const PHASES = [
  { value: null, label: 'General' },
  { value: 'OFFSEASON', label: 'Off season' },
  { value: 'PREP', label: 'Prep' },
  { value: 'PEAK_WEEK', label: 'Peak week' },
  { value: 'SHOW_DAY', label: 'Show day' },
  { value: 'POST_SHOW', label: 'Post-show' },
];

const SECTIONS = [
  {
    icon: Camera,
    title: 'Camera angles',
    bullets: [
      'Front: face the camera straight on, feet shoulder-width.',
      'Back: turn 180°, same stance.',
      'Sides: left and right 90° so profile is visible.',
      'Keep the same order every time for consistent comparison.',
    ],
  },
  {
    icon: Ruler,
    title: 'Distance',
    bullets: [
      'Stand 2–3 metres from the camera for full-body shots.',
      'Far enough to capture head to feet without cropping.',
      'Avoid wide-angle distortion by not standing too close.',
    ],
  },
  {
    icon: Sun,
    title: 'Lighting',
    bullets: [
      'Use even, front-facing light (e.g. window or soft lamp in front).',
      'Avoid harsh shadows and backlight.',
      'Same lighting each week so progress is clear.',
    ],
  },
  {
    icon: Clock,
    title: 'Same time and day',
    bullets: [
      'Take photos at the same time of day (e.g. morning after waking).',
      'Same day each week if possible (e.g. every Sunday).',
      'Consistency makes week-to-week comparison meaningful.',
    ],
  },
  {
    icon: User,
    title: 'Neutral pose',
    bullets: [
      'Relaxed stance unless your coach asks for a specific pose.',
      'Arms at sides or one hand on hip if that’s your standard.',
      'No flexing unless you’re logging a posing shot.',
    ],
  },
  {
    icon: Sparkles,
    title: 'Lens tips',
    bullets: [
      'Phone at chest to waist height, level with the body.',
      'Slightly above can shorten legs; too low distorts proportions.',
      'Use the main camera, not ultra-wide, for check-ins.',
    ],
  },
];

export default function PhotoGuide() {
  const { user, role } = useAuth();
  const userId = user?.id ?? '';

  const clientId = useMemo(() => {
    if (role !== 'client' || !user?.id) return null;
    const c = getClientByUserId(user.id);
    return c?.id ?? null;
  }, [role, user?.id]);
  const profile = useMemo(() => (clientId ? getClientCompProfile(clientId) : null), [clientId]);
  const currentPhase = profile?.prepPhase ?? null;

  const [selectedPhase, setSelectedPhase] = useState(currentPhase);
  const phaseForStorage = selectedPhase === '' ? null : selectedPhase;
  const effectiveClientId = clientId ?? (user?.id ? `solo-${user.id}` : null);
  const understood = useMemo(
    () => (effectiveClientId ? getPhotoGuideUnderstood(effectiveClientId, phaseForStorage) : null),
    [effectiveClientId, phaseForStorage]
  );
  const [justMarked, setJustMarked] = useState(false);

  const handleMarkUnderstood = () => {
    if (!effectiveClientId) return;
    impactLight();
    setPhotoGuideUnderstood(effectiveClientId, selectedPhase === '' ? null : selectedPhase);
    setJustMarked(true);
    notificationSuccess();
    setTimeout(() => setJustMarked(false), 2000);
  };

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <h1 className="text-lg font-semibold mb-1">How to take your photos</h1>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Follow these guidelines for consistent, comparable check-in photos.
      </p>

      <div className="space-y-4 mb-6">
        {SECTIONS.map((s) => (
          <Card key={s.title} style={{ padding: spacing[16] }}>
            <div className="flex gap-3">
              <s.icon size={20} className="flex-shrink-0 mt-0.5" style={{ color: colors.accent }} />
              <div>
                <h2 className="text-sm font-semibold mb-2">{s.title}</h2>
                <ul className="text-sm space-y-1" style={{ color: colors.muted }}>
                  {s.bullets.map((b, i) => (
                    <li key={i}>• {b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <h3 className="text-sm font-semibold mb-2">Mark as understood</h3>
        <p className="text-xs mb-3" style={{ color: colors.muted }}>
          Confirm once per phase so your coach knows you’ve read the guide.
        </p>
        <select
          value={selectedPhase ?? ''}
          onChange={(e) => setSelectedPhase(e.target.value || null)}
          className="w-full rounded-lg border bg-slate-800 text-white text-sm mb-3"
          style={{ padding: '10px 12px', borderColor: colors.border }}
        >
          {PHASES.map((p) => (
            <option key={p.label} value={p.value ?? ''}>
              {p.label}
            </option>
          ))}
        </select>
        {understood || justMarked ? (
          <p className="text-sm flex items-center gap-2" style={{ color: colors.success }}>
            ✓ Marked as understood
            {understood?.understoodAt && !justMarked && (
              <span className="text-xs" style={{ color: colors.muted }}>
                {new Date(understood.understoodAt).toLocaleDateString()}
              </span>
            )}
          </p>
        ) : (
          <Button onClick={handleMarkUnderstood}>I understand</Button>
        )}
      </Card>
    </div>
  );
}
