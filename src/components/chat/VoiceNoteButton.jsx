/**
 * MVP voice note: tap to start recording, tap again to stop. Uses MediaRecorder.
 * On done, calls onDone({ audioDataUrl, durationMs }) for persistence and playback.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { colors } from '@/ui/tokens';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function VoiceNoteButton({ onDone, disabled }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    mediaRecorderRef.current = null;
    mr.stop();
    setRecording(false);
  }, []);

  const handleTap = useCallback(async () => {
    if (disabled) return;

    if (recording) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      chunksRef.current = chunks;
      startTimeRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Math.round(Date.now() - startTimeRef.current);
        if (chunks.length === 0 || durationMs < 300) {
          if (typeof onDone === 'function') onDone({ audioDataUrl: null, durationMs: 0 });
          return;
        }
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const audioDataUrl = await blobToDataUrl(blob);
          if (typeof onDone === 'function') onDone({ audioDataUrl, durationMs });
        } catch (_) {
          if (typeof onDone === 'function') onDone({ audioDataUrl: null, durationMs: 0 });
        }
      };

      mr.start(200);
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      if (import.meta.env?.DEV) console.error('[VoiceNote]', err);
      if (typeof onDone === 'function') onDone({ audioDataUrl: null, durationMs: 0 });
    }
  }, [recording, disabled, stopRecording, onDone]);

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={disabled}
      aria-label={recording ? 'Stop recording' : 'Record voice note'}
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: recording ? colors.danger : 'transparent',
        border: 'none',
        color: recording ? '#fff' : colors.muted,
      }}
    >
      <Mic size={18} strokeWidth={2} />
    </button>
  );
}
