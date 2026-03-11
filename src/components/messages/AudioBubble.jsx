/**
 * Voice message bubble: play/pause, progress, duration.
 * Supports media_url (Supabase signed URL) or audioKey (local voiceStore). Only one bubble plays at a time globally.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { getVoiceBlob } from '@/lib/messaging/voiceStore';

let globalPlayingId = null;
const globalListeners = new Set();

function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioBubble({ audioKey, mimeType, durationMs, isMine, mediaUrl, messageId }) {
  const id = messageId ?? audioKey ?? 'audio';
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [objectUrl, setObjectUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (mediaUrl) {
      setObjectUrl(mediaUrl);
      setLoading(false);
      setError(!mediaUrl);
      return;
    }
    if (!audioKey) {
      setLoading(false);
      return;
    }
    let url = null;
    getVoiceBlob(audioKey)
      .then((blob) => {
        if (blob) {
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        }
        setError(!blob);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioKey, mediaUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTimeUpdate = () => setProgress(el.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [objectUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      globalPlayingId = id;
      globalListeners.forEach((fn) => fn(id));
      el.play().catch(() => setPlaying(false));
    } else {
      if (globalPlayingId === id) globalPlayingId = null;
      el.pause();
    }
  }, [playing, objectUrl, id]);

  useEffect(() => {
    const stopIfOther = (playingId) => {
      if (playingId !== id && playing) setPlaying(false);
    };
    globalListeners.add(stopIfOther);
    return () => globalListeners.delete(stopIfOther);
  }, [id, playing]);

  const toggle = () => {
    if (playing) setPlaying(false);
    else setPlaying(true);
  };

  const totalSec = typeof durationMs === 'number' && durationMs > 0 ? durationMs / 1000 : 1;
  const currentSec = progress;
  const pct = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;

  const bubbleBg = isMine ? colors.primary : colors.surface1;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: '76%',
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          padding: '10px 12px',
          borderRadius: 18,
          background: bubbleBg,
          fontSize: 12,
          color: colors.muted,
        }}
      >
        Loading…
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div
        style={{
          maxWidth: '76%',
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          padding: '10px 12px',
          borderRadius: 18,
          background: bubbleBg,
          fontSize: 12,
          color: colors.muted,
        }}
      >
        Voice note (unavailable)
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: '76%',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        padding: '10px 12px',
        borderRadius: 18,
        background: bubbleBg,
      }}
    >
      <audio ref={audioRef} src={objectUrl} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.25)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: '#fff',
              borderRadius: 2,
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4, display: 'inline-block' }}>
          {formatDuration(currentSec * 1000)} / {formatDuration(durationMs)}
        </span>
      </div>
    </div>
  );
}
