/**
 * Call Prep sheet (trainer-only): Snapshot, Coach notes, Summary preview.
 * Device-aware: Audio (phone/WhatsApp/FaceTime audio) vs Video (FaceTime/Zoom/Meet/WhatsApp).
 * Both actions open this sheet first; Start Call = audio, Start Video = video check-in.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import Button from '@/ui/Button';
import { colors, spacing, radii } from '@/ui/tokens';
import { formatClientSummary } from '@/lib/chatContextSnapshot';
import { buildSummaryCardPayload } from '@/lib/coach/weeklySnapshot';
import {
  launchAudioCall,
  launchVideoCall,
  getAvailableCallMethods,
} from '@/lib/contact/launchCall';

const ERROR_MESSAGES = {
  NO_PHONE: 'Add a phone number in Contact Settings to enable call.',
  NO_PHONE_WHATSAPP: 'Add phone number to use WhatsApp.',
  NO_LINK: 'No video link set. Add a link in Contact Settings for Zoom/Meet.',
  FACETIME_IOS_ONLY: 'FaceTime is only available on iOS. Set another method in Contact Settings.',
  FAILED: 'Could not start. Try again.',
  UNKNOWN_METHOD: 'Contact method not set. Choose one in Contact Settings.',
};

function clientLike(client) {
  if (!client) return {};
  return {
    phone: client.phone ?? client.phone_number ?? '',
    email: client.email ?? '',
    whatsappPhone: client.whatsappPhone ?? client.phone ?? client.phone_number ?? '',
    videoLink: (client.videoLink ?? client.contactLink ?? client.contact_link ?? '').trim(),
    contactLink: (client.contactLink ?? client.contact_link ?? '').trim(),
    preferredAudioMethod: client.preferredAudioMethod ?? null,
    preferredVideoMethod: client.preferredVideoMethod ?? client.preferredContactMethod ?? client.preferred_contact_method ?? null,
  };
}

export default function CallPrepSheet({
  open,
  onOpenChange,
  client,
  clientId,
  clientName,
  snapshot,
  prepNotes,
  onPrepNotesChange,
  onSendSummaryCard,
  onRequestCheckIn,
  onViewClient,
  onPaymentReminder,
  lightHaptic,
}) {
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [callError, setCallError] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);

  const clientData = useMemo(() => clientLike(client), [client]);
  const available = useMemo(() => getAvailableCallMethods(clientData), [clientData]);
  const { audioMethods, videoMethods, suggestedAudio, suggestedVideo } = available;

  const suggestedLabel = useMemo(() => {
    if (audioMethods.length === 0 && videoMethods.length === 0) {
      return null;
    }
    const a = suggestedAudio ? audioMethods.find((m) => m.value === suggestedAudio)?.label : null;
    const v = suggestedVideo ? videoMethods.find((m) => m.value === suggestedVideo)?.label : null;
    const parts = [];
    if (v) parts.push(`${v} (Video)`);
    if (a) parts.push(`${a} (Audio)`);
    return parts.length ? `Suggested: ${parts.join(', ')}` : null;
  }, [audioMethods, videoMethods, suggestedAudio, suggestedVideo]);

  const summaryText = formatClientSummary(snapshot ?? {}, clientName);

  const handleStartAudio = useCallback(() => {
    lightHaptic?.();
    const result = launchAudioCall(clientData);
    if (result.ok) {
      onOpenChange?.(false);
    } else if (result.needPicker) {
      setAudioPickerOpen(true);
    } else {
      setCallError(result.error ?? 'NO_PHONE');
    }
  }, [clientData, lightHaptic, onOpenChange]);

  const handleStartVideo = useCallback(async () => {
    lightHaptic?.();
    const result = await launchVideoCall(clientData);
    if (result.ok) {
      onOpenChange?.(false);
    } else if (result.needPicker) {
      setVideoPickerOpen(true);
    } else {
      setVideoError(result.error ?? 'NO_LINK');
    }
  }, [clientData, lightHaptic, onOpenChange]);

  const handlePickAudioMethod = useCallback((picked) => {
    setAudioPickerOpen(false);
    lightHaptic?.();
    const result = launchAudioCall(clientData, picked);
    if (result.ok) {
      onOpenChange?.(false);
    } else {
      setCallError(result.error ?? 'NO_PHONE');
    }
  }, [clientData, lightHaptic, onOpenChange]);

  const handlePickVideoMethod = useCallback(async (picked) => {
    setVideoPickerOpen(false);
    lightHaptic?.();
    const result = await launchVideoCall(clientData, picked);
    if (result.ok) {
      onOpenChange?.(false);
    } else {
      setVideoError(result.error ?? 'NO_LINK');
    }
  }, [clientData, lightHaptic, onOpenChange]);

  const handleSendSummary = useCallback(() => {
    lightHaptic?.();
    setShowSummaryPreview(false);
    onOpenChange?.(false);
    const payload = buildSummaryCardPayload(
      { wins: snapshot?.wins, slips: snapshot?.slips, lastCheckinLabel: snapshot?.lastCheckIn, checkinDueLabel: snapshot?.checkInDue },
      clientName
    );
    onSendSummaryCard?.(payload);
  }, [lightHaptic, onOpenChange, onSendSummaryCard, snapshot, clientName]);

  const hasAnyCallOption = audioMethods.length > 0 || videoMethods.length > 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0"
          style={{ background: colors.bg, borderColor: colors.border }}
        >
          {/* Header row: title left, close right (close is built into SheetContent) */}
          <div
            className="flex items-center justify-between flex-shrink-0 pl-4 pr-12 pt-4 pb-3"
            style={{ borderBottom: `1px solid ${colors.border}` }}
          >
            <h2 className="text-[17px] font-semibold" style={{ color: colors.text }}>Call Prep</h2>
          </div>

          {/* Muted info box: guidance / suggested method */}
          <div
            className="mx-4 mt-3 mb-4 px-3 py-2 rounded-lg"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.muted, fontSize: 12 }}
          >
            {hasAnyCallOption && suggestedLabel ? (
              <span>{suggestedLabel}</span>
            ) : !hasAnyCallOption ? (
              <span>Add phone number or meeting link in Contact Settings (client profile) to start a call or video check-in.</span>
            ) : null}
            {hasAnyCallOption && (
              <span className="block mt-1" style={{ opacity: 0.85 }}>Audio check-in is fine; video is optional.</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-6">
            {/* 1) This week snapshot */}
            <section style={{ marginBottom: spacing[20] }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>This week snapshot</h3>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 rounded-xl border"
                  style={{ background: colors.card, borderColor: colors.border }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Wins</p>
                  <ul className="text-[13px] space-y-0.5" style={{ color: colors.text }}>
                    {(snapshot?.wins ?? []).slice(0, 3).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {(snapshot?.wins ?? []).length === 0 && (
                      <li className="text-[12px]" style={{ color: colors.muted }}>—</li>
                    )}
                  </ul>
                </div>
                <div
                  className="p-3 rounded-xl border"
                  style={{ background: colors.card, borderColor: colors.border }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Slips</p>
                  <ul className="text-[13px] space-y-0.5" style={{ color: colors.text }}>
                    {(snapshot?.slips ?? []).slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                    {(snapshot?.slips ?? []).length === 0 && (
                      <li className="text-[12px]" style={{ color: colors.muted }}>—</li>
                    )}
                  </ul>
                </div>
              </div>
              {(snapshot?.flags ?? []).length > 0 && (
                <div className="mt-2 p-2 rounded-lg border" style={{ background: colors.card, borderColor: colors.border }}>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: colors.muted }}>Flags</p>
                  <ul className="text-[12px] space-y-0.5" style={{ color: colors.text }}>
                    {snapshot.flags.slice(0, 3).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-4 mt-2 text-[12px]" style={{ color: colors.muted }}>
                <span>Check-in due: {snapshot?.checkInDue ?? '—'}</span>
                <span>Last check-in: {snapshot?.lastCheckIn ?? '—'}</span>
              </div>

              {/* Quick actions: Request check-in (primary), View client (secondary), Payment (link) */}
              {(typeof onRequestCheckIn === 'function' || typeof onViewClient === 'function' || typeof onPaymentReminder === 'function') && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {onRequestCheckIn && (
                    <Button variant="primary" size="sm" onClick={() => { lightHaptic?.(); onRequestCheckIn(); onOpenChange?.(false); }}>Request check-in</Button>
                  )}
                  {onViewClient && (
                    <Button variant="secondary" size="sm" onClick={() => { lightHaptic?.(); onViewClient(); onOpenChange?.(false); }}>View client</Button>
                  )}
                  {onPaymentReminder && (
                    <button
                      type="button"
                      className="text-[12px] font-medium active:opacity-80"
                      style={{ color: colors.muted }}
                      onClick={() => { lightHaptic?.(); onPaymentReminder(); onOpenChange?.(false); }}
                    >
                      Payment reminder
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* 2) Coach prep notes */}
            <section style={{ marginBottom: spacing[20] }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Coach prep notes</h3>
              <p className="text-[11px] mb-2" style={{ color: colors.muted }}>Private notes (not visible to client)</p>
              <textarea
                value={prepNotes ?? ''}
                onChange={(e) => onPrepNotesChange?.(e.target.value)}
                placeholder="Notes for this conversation…"
                className="w-full rounded-xl px-3 py-2.5 text-[13px] resize-none focus:outline-none focus:ring-1"
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  minHeight: 72,
                  borderRadius: radii.button,
                }}
                rows={3}
              />
            </section>

            {/* 3) Client summary */}
            <section style={{ marginBottom: spacing[20] }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Client summary</h3>
              <p className="text-[11px] mb-3" style={{ color: colors.muted }}>Preview or send a summary card into chat.</p>
              {showSummaryPreview && (
                <div
                  className="mb-3 p-3 rounded-xl border whitespace-pre-wrap text-[13px]"
                  style={{ background: colors.card, borderColor: colors.border, color: colors.text, borderRadius: radii.button }}
                >
                  {summaryText}
                </div>
              )}
              <div className="flex flex-col gap-2 w-full">
                <Button variant="primary" className="w-full" size="sm" onClick={handleSendSummary} style={{ borderRadius: radii.button }}>
                  Send summary to chat
                </Button>
                <Button variant="secondary" className="w-full" size="sm" onClick={() => { lightHaptic?.(); setShowSummaryPreview((v) => !v); }} style={{ borderRadius: radii.button }}>
                  {showSummaryPreview ? 'Hide preview' : 'Show summary preview'}
                </Button>
              </div>

              {/* Start call / Start video */}
              <div className="flex flex-col gap-2 pt-4 mt-4 border-t w-full" style={{ borderColor: colors.border }}>
                <Button variant="primary" className="w-full" onClick={handleStartAudio} disabled={audioMethods.length === 0} style={{ borderRadius: radii.button }}>
                  Start call (audio)
                </Button>
                <Button variant="primary" className="w-full" onClick={handleStartVideo} disabled={videoMethods.length === 0} style={{ borderRadius: radii.button }}>
                  Start video
                </Button>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Audio error modal */}
      {callError && (
        <>
          <div role="presentation" className="fixed inset-0 z-50" style={{ background: colors.overlay }} onClick={() => setCallError(null)} />
          <div className="fixed left-4 right-4 z-50 rounded-2xl p-4 border" style={{ top: '50%', transform: 'translateY(-50%)', background: colors.bg, borderColor: colors.border }}>
            <p className="text-[15px] font-medium mb-2" style={{ color: colors.text }}>Can’t start audio call</p>
            <p className="text-[13px] mb-4" style={{ color: colors.muted }}>{ERROR_MESSAGES[callError] ?? ERROR_MESSAGES.NO_PHONE}</p>
            <p className="text-[12px] mb-4" style={{ color: colors.muted }}>Add in Contact Settings on the client profile.</p>
            <Button variant="primary" onClick={() => setCallError(null)}>OK</Button>
          </div>
        </>
      )}

      {/* Video error modal */}
      {videoError && (
        <>
          <div role="presentation" className="fixed inset-0 z-50" style={{ background: colors.overlay }} onClick={() => setVideoError(null)} />
          <div className="fixed left-4 right-4 z-50 rounded-2xl p-4 border" style={{ top: '50%', transform: 'translateY(-50%)', background: colors.bg, borderColor: colors.border }}>
            <p className="text-[15px] font-medium mb-2" style={{ color: colors.text }}>Can’t start video</p>
            <p className="text-[13px] mb-4" style={{ color: colors.muted }}>{ERROR_MESSAGES[videoError] ?? ERROR_MESSAGES.NO_LINK}</p>
            <p className="text-[12px] mb-4" style={{ color: colors.muted }}>Add method and link in Contact Settings on the client profile.</p>
            <Button variant="primary" onClick={() => setVideoError(null)}>OK</Button>
          </div>
        </>
      )}

      {/* Audio method picker */}
      {audioPickerOpen && (
        <>
          <div role="presentation" className="fixed inset-0 z-50" style={{ background: colors.overlay }} onClick={() => setAudioPickerOpen(false)} />
          <div className="fixed left-4 right-4 z-50 rounded-2xl p-4 border max-h-[70vh] overflow-y-auto" style={{ top: '50%', transform: 'translateY(-50%)', background: colors.bg, borderColor: colors.border }}>
            <p className="text-[15px] font-medium mb-2" style={{ color: colors.text }}>Choose audio method</p>
            <p className="text-[13px] mb-4" style={{ color: colors.muted }}>Set a preferred audio method in Contact Settings to skip this step.</p>
            <div className="flex flex-col gap-2">
              {audioMethods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handlePickAudioMethod(m.value)}
                  className="text-left py-3 px-3 rounded-xl text-[14px] font-medium active:opacity-80"
                  style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setAudioPickerOpen(false)}>Cancel</Button>
          </div>
        </>
      )}

      {/* Video method picker */}
      {videoPickerOpen && (
        <>
          <div role="presentation" className="fixed inset-0 z-50" style={{ background: colors.overlay }} onClick={() => setVideoPickerOpen(false)} />
          <div className="fixed left-4 right-4 z-50 rounded-2xl p-4 border max-h-[70vh] overflow-y-auto" style={{ top: '50%', transform: 'translateY(-50%)', background: colors.bg, borderColor: colors.border }}>
            <p className="text-[15px] font-medium mb-2" style={{ color: colors.text }}>Choose video method</p>
            <p className="text-[13px] mb-4" style={{ color: colors.muted }}>Set a preferred video method in Contact Settings to skip this step.</p>
            <div className="flex flex-col gap-2">
              {videoMethods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handlePickVideoMethod(m.value)}
                  className="text-left py-3 px-3 rounded-xl text-[14px] font-medium active:opacity-80"
                  style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setVideoPickerOpen(false)}>Cancel</Button>
          </div>
        </>
      )}
    </>
  );
}
