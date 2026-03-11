/**
 * Chat composer with press-and-hold voice: paperclip | input | send or mic.
 * Slide left to cancel, slide up to lock. Uses tokens (Atlas blue, no teal).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, Send, Mic, Square, Trash2 } from 'lucide-react';
import { colors, spacing } from '@/ui/tokens';
import { startVoiceRecording } from '@/lib/messaging/voiceRecorder';
import { putVoiceBlob } from '@/lib/messaging/voiceStore';

const CANCEL_THRESHOLD = 80;
const LOCK_THRESHOLD = 70;

async function hapticLight() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}
async function hapticMedium() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    else if (navigator.vibrate) navigator.vibrate(15);
  } catch (_) {}
}
async function hapticHeavy() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    else if (navigator.vibrate) navigator.vibrate(20);
  } catch (_) {}
}

function formatTimer(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VoiceNoteComposer({
  disabled,
  onSendText,
  onSendVoice,
  placeholder = 'Message...',
  clientId = '',
  onAttach,
  inputRef: externalInputRef,
  value,
  onChange,
}) {
  const [internalText, setInternalText] = useState('');
  const text = value !== undefined ? value : internalText;
  const setText = onChange || setInternalText;
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [readyBlob, setReadyBlob] = useState(null);
  const [readyMeta, setReadyMeta] = useState(null);
  const [recordStartMs, setRecordStartMs] = useState(0);
  const [timerMs, setTimerMs] = useState(0);
  const [slideHint, setSlideHint] = useState(null);

  const recorderRef = useRef(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const lockHapticRef = useRef(false);
  const cancelHapticRef = useRef(false);
  const intentRef = useRef(null);
  const internalInputRef = useRef(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const timerIdRef = useRef(null);

  const hasText = (text || '').trim().length > 0;

  useEffect(() => {
    if (!recording && !locked) return;
    const start = recordStartMs || Date.now();
    setRecordStartMs(start);
    timerIdRef.current = setInterval(() => setTimerMs(Date.now() - start), 100);
    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, [recording, locked]);

  const cancelRecording = useCallback(async () => {
    const rec = recorderRef.current;
    if (rec?.cancel) await rec.cancel();
    recorderRef.current = null;
    setRecording(false);
    setLocked(false);
    setReadyBlob(null);
    setReadyMeta(null);
    setRecordStartMs(0);
    setTimerMs(0);
    setSlideHint(null);
    lockHapticRef.current = false;
    cancelHapticRef.current = false;
    if (timerIdRef.current) clearInterval(timerIdRef.current);
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || hasText || recorderRef.current) return;
    pointerStartRef.current = { x: 0, y: 0 };
    lockHapticRef.current = false;
    cancelHapticRef.current = false;
    setSlideHint(null);
    try {
      const rec = await startVoiceRecording();
      recorderRef.current = rec;
      setRecording(true);
      setRecordStartMs(Date.now());
      setTimerMs(0);
      await hapticLight();
    } catch (err) {
      if (import.meta.env?.DEV) console.error('[VoiceNote]', err);
    }
  }, [disabled, hasText]);

  const handlePointerDown = useCallback(
    async (e) => {
      if (disabled || hasText) return;
      e.preventDefault();
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      lockHapticRef.current = false;
      cancelHapticRef.current = false;
      setSlideHint(null);
      try {
        const rec = await startVoiceRecording();
        recorderRef.current = rec;
        setRecording(true);
        setRecordStartMs(Date.now());
        setTimerMs(0);
        await hapticLight();
      } catch (err) {
        if (import.meta.env?.DEV) console.error('[VoiceNote]', err);
      }
    },
    [disabled, hasText]
  );

  const handleMicClick = useCallback(
    (e) => {
      if (disabled || hasText) return;
      e.preventDefault();
      if (recording || locked) return;
      startRecording();
    },
    [disabled, hasText, recording, locked, startRecording]
  );

  const handlePointerMove = useCallback((e) => {
    if (!recording && !locked) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = pointerStartRef.current.y - e.clientY;
    if (dx < -CANCEL_THRESHOLD) {
      intentRef.current = 'cancel';
      setSlideHint('cancel');
      if (!cancelHapticRef.current) {
        cancelHapticRef.current = true;
        hapticHeavy();
      }
    } else if (dy > LOCK_THRESHOLD) {
      intentRef.current = 'lock';
      setSlideHint(null);
      if (!locked) {
        setLocked(true);
        if (!lockHapticRef.current) {
          lockHapticRef.current = true;
          hapticMedium();
        }
      }
    } else {
      if (!locked) intentRef.current = dx < -20 ? 'cancel' : null;
      setSlideHint(locked ? null : (dx < -20 ? 'cancel' : null));
    }
  }, [recording, locked]);

  const handlePointerUp = useCallback(
    async (e) => {
      e.preventDefault();
      if (!recording) return;
      const rec = recorderRef.current;
      if (intentRef.current === 'cancel') {
        intentRef.current = null;
        await cancelRecording();
        return;
      }
      if (locked) return;
      intentRef.current = null;
      try {
        const result = await rec?.stop?.();
        recorderRef.current = null;
        setRecording(false);
        if (result?.blob && result.durationMs >= 300) {
          const key = await putVoiceBlob(result.blob, clientId);
          if (key && typeof onSendVoice === 'function') {
            onSendVoice({ audioKey: key, mimeType: result.mimeType || 'audio/webm', durationMs: result.durationMs, blob: result.blob });
          }
        }
        setRecordStartMs(0);
        setTimerMs(0);
        setSlideHint(null);
      } catch (_) {}
    },
    [recording, locked, clientId, onSendVoice, cancelRecording]
  );

  useEffect(() => {
    const onUp = (e) => {
      if (recording || locked) handlePointerUp(e);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [recording, locked, handlePointerUp]);

  const stopAndSend = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      const result = await rec.stop?.();
      recorderRef.current = null;
      setLocked(false);
      setRecording(false);
      setRecordStartMs(0);
      setTimerMs(0);
      setSlideHint(null);
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      if (result?.blob && result.durationMs >= 300 && typeof onSendVoice === 'function') {
        const key = await putVoiceBlob(result.blob, clientId);
        if (key) onSendVoice({ audioKey: key, mimeType: result.mimeType || 'audio/webm', durationMs: result.durationMs, blob: result.blob });
      }
    } catch (_) {}
  }, [clientId, onSendVoice]);

  const handleStopThenReady = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      const result = await rec.stop?.();
      recorderRef.current = null;
      setLocked(false);
      setRecording(false);
      if (result?.blob) {
        setReadyBlob(result.blob);
        setReadyMeta({ mimeType: result.mimeType || 'audio/webm', durationMs: result.durationMs });
      }
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    } catch (_) {}
  }, []);

  const handleSendReady = useCallback(async () => {
    if (!readyBlob || !readyMeta) return;
    try {
      const key = await putVoiceBlob(readyBlob, clientId);
      if (key && typeof onSendVoice === 'function') {
        onSendVoice({ audioKey: key, mimeType: readyMeta.mimeType, durationMs: readyMeta.durationMs, blob: readyBlob });
      }
      setReadyBlob(null);
      setReadyMeta(null);
      setTimerMs(0);
    } catch (_) {}
  }, [readyBlob, readyMeta, clientId, onSendVoice]);

  const handleDiscardReady = useCallback(() => {
    setReadyBlob(null);
    setReadyMeta(null);
    setTimerMs(0);
  }, []);

  const handleSendText = useCallback(() => {
    const t = (text || '').trim();
    if (!t || typeof onSendText !== 'function') return;
    onSendText(t);
    if (value === undefined) setText('');
  }, [text, onSendText, value]);

  const showRecordingUI = recording || locked;
  const showReadyUI = readyBlob && readyMeta;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[12],
        minHeight: 44,
        height: 44,
        background: colors.surface2,
        borderRadius: 9999,
        paddingLeft: 6,
        paddingRight: 6,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
      }}
    >
      {!showRecordingUI && !showReadyUI && (
        <>
          <button
            type="button"
            onClick={() => typeof onAttach === 'function' && onAttach()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.primary,
              border: 'none',
              color: '#fff',
            }}
            aria-label="Attach"
          >
            <Paperclip size={18} strokeWidth={2} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            placeholder={placeholder}
            className="flex-1 min-w-0 placeholder:opacity-60 focus:outline-none"
            style={{
              minHeight: 32,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: colors.text,
              paddingLeft: 4,
              paddingRight: 4,
            }}
          />
          {hasText ? (
            <button
              type="button"
              onClick={handleSendText}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: colors.primary,
                border: 'none',
                color: '#fff',
              }}
              aria-label="Send"
            >
              <Send size={18} strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMicClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={(e) => { if (slideHint === 'cancel') handlePointerUp(e); }}
              disabled={disabled}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: colors.muted,
              }}
              aria-label="Tap or hold to record"
            >
              <Mic size={18} strokeWidth={2} />
            </button>
          )}
        </>
      )}

      {(showRecordingUI || showReadyUI) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], flex: 1, minWidth: 0 }}>
          {showRecordingUI && (
            <>
              <span style={{ fontSize: 13, color: colors.muted, whiteSpace: 'nowrap' }}>
                {locked ? 'Recording…' : slideHint === 'cancel' ? 'Release to cancel' : 'Recording… slide to cancel'} {formatTimer(timerMs)}
              </span>
              {(locked || recording) && (
                <button
                  type="button"
                  onClick={locked ? handleStopThenReady : stopAndSend}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.primary,
                    border: 'none',
                    color: '#fff',
                  }}
                  aria-label={locked ? 'Stop' : 'Stop and send'}
                >
                  <Square size={16} fill="currentColor" />
                </button>
              )}
              {!locked && recording && (
                <button
                  type="button"
                  onPointerUp={(e) => { e.preventDefault(); if (intentRef.current === 'cancel') cancelRecording(); else handlePointerUp(e); }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: slideHint === 'cancel' ? colors.danger : colors.surface1,
                    border: 'none',
                    color: '#fff',
                  }}
                  aria-label="Release to send or slide to cancel"
                >
                  <Mic size={18} />
                </button>
              )}
            </>
          )}
          {showReadyUI && (
            <>
              <span style={{ fontSize: 13, color: colors.muted }}>Voice note {formatTimer(readyMeta.durationMs)}</span>
              <button
                type="button"
                onClick={handleDiscardReady}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: colors.danger,
                  border: 'none',
                  color: '#fff',
                }}
                aria-label="Discard"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                onClick={handleSendReady}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: colors.primary,
                  border: 'none',
                  color: '#fff',
                }}
                aria-label="Send"
              >
                <Send size={18} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
