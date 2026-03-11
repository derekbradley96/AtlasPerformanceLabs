/**
 * Client Detail – Overview segment: Health Summary + Phase Snapshot + Contact & Session + quick links.
 * Contact: device-aware audio/video preferences; validation for phone and video link.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { ListChecks, History, Phone, Video, Copy, MessageSquare, TrendingUp } from 'lucide-react';
import { getAudioMethodOptionsForSettings, getVideoMethodOptionsForSettings } from '@/lib/contact/launchCall';

const PHONE_PATTERN = /^[\d\s\-+()]{0,30}$/;
function isValidPhone(value) {
  if (!value || !String(value).trim()) return true;
  return PHONE_PATTERN.test(String(value).trim());
}
function isValidUrl(value) {
  if (!value || !String(value).trim()) return true;
  try {
    const u = new URL(String(value).trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export default function ClientOverviewPanel({
  clientId,
  healthResult,
  healthBadgeLabel,
  healthPillColor,
  phase,
  lastCheckInAt,
  nextCheckInDue,
  formatRelativeDate,
  onOpenPhaseEdit,
  onOpenHealthSheet,
  onOpenIntervention,
  showIntervention,
  onOpenTimeline,
  phone,
  preferredAudioMethod,
  preferredVideoMethod,
  videoLink,
  onSaveContact,
  onOpenCallPrep,
  onOpenMessage,
}) {
  const navigate = useNavigate();
  const [contactPhone, setContactPhone] = useState(phone ?? '');
  const [audioMethod, setAudioMethod] = useState(preferredAudioMethod ?? '');
  const [videoMethod, setVideoMethod] = useState(preferredVideoMethod ?? '');
  const [videoLinkVal, setVideoLinkVal] = useState(videoLink ?? '');
  const [saving, setSaving] = useState(false);

  const audioOptions = useMemo(() => [
    { value: '', label: 'Not set' },
    ...getAudioMethodOptionsForSettings().map((o) => ({ value: o.value, label: o.label })),
  ], []);
  const videoOptions = useMemo(() => [
    { value: '', label: 'Not set' },
    ...getVideoMethodOptionsForSettings().map((o) => ({ value: o.value, label: o.label })),
  ], []);

  useEffect(() => {
    setContactPhone(phone ?? '');
    setAudioMethod(preferredAudioMethod ?? '');
    setVideoMethod(preferredVideoMethod ?? '');
    setVideoLinkVal(videoLink ?? '');
  }, [phone, preferredAudioMethod, preferredVideoMethod, videoLink]);

  const phoneValid = useMemo(() => isValidPhone(contactPhone), [contactPhone]);
  const videoLinkValid = useMemo(() => isValidUrl(videoLinkVal), [videoLinkVal]);
  const contactValid = phoneValid && videoLinkValid;
  const hasChanges = useMemo(
    () =>
      (contactPhone ?? '') !== (phone ?? '') ||
      (audioMethod ?? '') !== (preferredAudioMethod ?? '') ||
      (videoMethod ?? '') !== (preferredVideoMethod ?? '') ||
      (videoLinkVal ?? '') !== (videoLink ?? ''),
    [contactPhone, phone, audioMethod, preferredAudioMethod, videoMethod, preferredVideoMethod, videoLinkVal, videoLink]
  );

  const handleSaveContact = useCallback(async () => {
    if (typeof onSaveContact !== 'function' || !clientId || !contactValid) return;
    setSaving(true);
    try {
      const patch = {
        phone: contactPhone.trim() || undefined,
        preferredAudioMethod: audioMethod || null,
        preferredVideoMethod: videoMethod || null,
        videoLink: videoLinkVal.trim() || undefined,
        contactLink: videoLinkVal.trim() || undefined,
      };
      await onSaveContact(clientId, patch);
    } finally {
      setSaving(false);
    }
  }, [clientId, contactPhone, audioMethod, videoMethod, videoLinkVal, contactValid, onSaveContact]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[20] }}>
      {/* Health Summary Card */}
      {healthResult != null && (
        <Card id="health-summary" style={{ padding: spacing[20] }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium" style={{ color: colors.muted }}>Health score</span>
              <span className="text-3xl font-bold tabular-nums" style={{ color: colors.text }}>
                {healthResult.score ?? '—'}
              </span>
            </div>
            <span
              className="px-3 py-1.5 rounded-full text-sm font-medium text-white"
              style={{ background: healthPillColor }}
            >
              {healthBadgeLabel}
            </span>
          </div>
          {healthResult.reasons && healthResult.reasons.length > 0 && (
            <>
              <p className="text-xs font-medium mt-4 mb-1" style={{ color: colors.muted }}>Reasons</p>
              <ul className="list-disc list-inside text-sm" style={{ color: colors.text }}>
                {(healthResult.reasons ?? []).slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={onOpenHealthSheet}>
              View breakdown
            </Button>
            {showIntervention && (
              <Button variant="secondary" onClick={onOpenIntervention}>
                Intervention
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Current Phase Snapshot */}
      <Card style={{ padding: spacing[20] }}>
        <div className="flex items-center justify-between" style={{ marginBottom: spacing[12] }}>
          <div>
            <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 4 }}>Phase</p>
            <p className="text-[17px] font-medium" style={{ color: colors.text }}>{phase}</p>
          </div>
          <Button variant="secondary" onClick={onOpenPhaseEdit}>Change</Button>
        </div>
        <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 4 }}>Last check-in</p>
        <p className="text-[15px]" style={{ color: colors.text, marginBottom: spacing[12] }}>
          {lastCheckInAt ? formatRelativeDate(lastCheckInAt) : 'No check-in yet'}
        </p>
        <p className="text-xs font-medium" style={{ color: colors.muted, marginBottom: 4 }}>Next check-in due</p>
        <p className="text-[15px]" style={{ color: colors.text }}>
          {nextCheckInDue ?? '—'}
        </p>
      </Card>

      {/* Contact & Session: preferred call/video + contact details + quick actions */}
      <Card style={{ padding: spacing[20] }}>
        <h3 className="text-[15px] font-semibold" style={{ color: colors.text, marginBottom: 4 }}>Contact & Session</h3>
        <p className="text-[13px]" style={{ color: colors.muted, marginBottom: spacing[16] }}>Set how check-ins happen for this client.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Preferred call</label>
            <select
              value={audioMethod}
              onChange={(e) => setAudioMethod(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              {audioOptions.map((o) => (
                <option key={o.value || 'none'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Preferred video</label>
            <select
              value={videoMethod}
              onChange={(e) => setVideoMethod(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              {videoOptions.map((o) => (
                <option key={o.value || 'none'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1"
              style={{
                background: colors.surface1,
                border: `1px solid ${!phoneValid ? colors.destructive : colors.border}`,
                color: colors.text,
              }}
              aria-invalid={!phoneValid}
            />
            {!phoneValid && <p className="text-[12px] mt-1" style={{ color: colors.destructive }}>Use digits, spaces, + - ( ) only</p>}
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Meeting link</label>
            <input
              type="url"
              value={videoLinkVal}
              onChange={(e) => setVideoLinkVal(e.target.value)}
              placeholder="https://… (optional)"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1"
              style={{
                background: colors.surface1,
                border: `1px solid ${!videoLinkValid ? colors.destructive : colors.border}`,
                color: colors.text,
              }}
              aria-invalid={!videoLinkValid}
            />
            {!videoLinkValid && <p className="text-[12px] mt-1" style={{ color: colors.destructive }}>Enter a valid http or https URL</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof onOpenMessage === 'function' && clientId && (
              <Button variant="secondary" size="sm" onClick={() => onOpenMessage()} className="flex items-center gap-1.5">
                <MessageSquare size={16} /> Message
              </Button>
            )}
            {typeof onOpenCallPrep === 'function' && (
              <>
                <Button variant="secondary" size="sm" onClick={() => onOpenCallPrep('call')} className="flex items-center gap-1.5" disabled={!contactPhone?.trim()}>
                  <Phone size={16} /> Call
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onOpenCallPrep('video')} className="flex items-center gap-1.5">
                  <Video size={16} /> Video
                </Button>
              </>
            )}
            {videoLinkVal?.trim() && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(videoLinkVal.trim());
                    toast.success('Link copied');
                  } catch (_) {}
                }}
                className="flex items-center gap-1.5"
              >
                <Copy size={16} /> Copy link
              </Button>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={handleSaveContact} disabled={saving || !contactValid || !hasChanges} style={{ width: '100%' }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>

      {/* Quick links: Intake, Timeline */}
      <div className="flex flex-wrap gap-3" style={{ marginTop: spacing[8] }}>
        {clientId && (
          <>
            <button
              type="button"
              onClick={() => navigate(`/clients/${clientId}/progress`)}
              className="flex items-center gap-2 rounded-xl py-2.5 px-4 text-[14px] font-medium active:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', color: colors.text, border: `1px solid ${colors.border}` }}
            >
              <TrendingUp size={18} style={{ color: colors.muted }} />
              Progress
            </button>
            <button
              type="button"
              onClick={() => navigate(`/clients/${clientId}/intake`)}
              className="flex items-center gap-2 rounded-xl py-2.5 px-4 text-[14px] font-medium active:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', color: colors.text, border: `1px solid ${colors.border}` }}
            >
              <ListChecks size={18} style={{ color: colors.muted }} />
              Intake
            </button>
            {typeof onOpenTimeline === 'function' && (
              <button
                type="button"
                onClick={onOpenTimeline}
                className="flex items-center gap-2 rounded-xl py-2.5 px-4 text-[14px] font-medium active:opacity-80"
                style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                <History size={18} style={{ color: colors.muted }} />
                Timeline
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
