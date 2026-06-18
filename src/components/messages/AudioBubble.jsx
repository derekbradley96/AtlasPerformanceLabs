/**
 * Voice message bubble: play/pause, progress, duration.
 * Supports media_url (Supabase signed URL) or audioKey (local voiceStore). Only one bubble plays at a time globally.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { getVoiceBlob } from '@/lib/messaging/voiceStore';
import { getSupabase } from '@/lib/supabaseClient';

let globalPlayingId = null;
const globalListeners = new Set();

/** Total length: unknown or non-positive → '--:--' (not '0:00'). */
function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '--:--';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Current playback position: 0 is valid → '0:00'. */
function formatPlaybackPosition(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '--:--';
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
  const [audioSrc, setAudioSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let cleanupBlobUrl = null;

    async function resolveAudioSrc() {
      if (!mediaUrl && !audioKey) {
        setLoading(false);
        return;
      }

      if (mediaUrl) {
        // Check if it's a 'path:...' fallback from sendVoiceMessage
        if (mediaUrl.startsWith('path:')) {
          const storagePath = mediaUrl.slice(5); // remove 'path:'
          try {
            const supabase = getSupabase();
            if (!supabase) throw new Error('no supabase');
            const { data, error: signErr } = await supabase.storage
              .from('message_media')
              .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
            if (signErr || !data?.signedUrl) throw new Error('sign failed');
            if (!cancelled) {
              setAudioSrc(data.signedUrl);
              setObjectUrl(data.signedUrl);
              setLoading(false);
              setError(false);
            }
          } catch (err) {
            console.error('[AudioBubble] Failed to sign path media URL', err);
            if (!cancelled) {
              setLoading(false);
              setError(true);
            }
          }
          return;
        }

        // Normal signed URL — use directly
        if (!cancelled) {
          setAudioSrc(mediaUrl);
          setObjectUrl(mediaUrl);
          setLoading(false);
          setError(false);
        }
        return;
      }

      // No mediaUrl — load from local IndexedDB (optimistic/sender)
      if (!audioKey) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const blob = await getVoiceBlob(audioKey);
        if (blob) {
          cleanupBlobUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setObjectUrl(cleanupBlobUrl);
            setError(false);
          }
        } else {
          if (!cancelled) setError(true);
        }
      } catch (err) {
        console.error('[AudioBubble] Failed to load local voice blob', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolveAudioSrc();
    return () => {
      cancelled = true;
      if (cleanupBlobUrl) URL.revokeObjectURL(cleanupBlobUrl);
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

  // When objectUrl changes, reload the audio element
  // so the browser fetches the new src.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !objectUrl) return;
    el.load();
  }, [objectUrl]);

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
        }}
      >
        <button
          type="button"
          disabled
          aria-label="Play"
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
            opacity: 0.8,
          }}
        >
          <Play size={18} style={{ marginLeft: 2 }} />
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
            <div style={{ height: '100%', width: '0%', background: '#fff', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4, display: 'inline-block' }}>
            0:00 / {formatDuration(typeof durationMs === 'number' && durationMs > 0 ? durationMs : undefined)}
          </span>
        </div>
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
      <audio
        ref={audioRef}
        src={audioSrc || objectUrl}
        preload="metadata"
        onError={async () => {
          if (!audioSrc) return;
          try {
            const supabase = getSupabase();
            if (!supabase) return;

            let storagePath = null;

            if (audioSrc.startsWith('path:')) {
              // Already a raw path with our prefix
              storagePath = audioSrc.slice(5);
            } else {
              try {
                // Try to extract path from an expired signed URL
                // Supabase signed URL format:
                // .../object/sign/BUCKET/PATH?token=...
                const url = new URL(audioSrc);
                const match = url.pathname.match(
                  /\/object\/sign\/message_media\/(.+)/
                );
                if (match) {
                  storagePath = decodeURIComponent(match[1]);
                }
              } catch (_) {
                // audioSrc is not a valid URL at all — give up
                setError(true);
                return;
              }
            }

            if (!storagePath) {
              setError(true);
              return;
            }

            const { data, error: signErr } = await supabase.storage
              .from('message_media')
              .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

            if (signErr || !data?.signedUrl) {
              setError(true);
              return;
            }

            setAudioSrc(data.signedUrl);
            setObjectUrl(data.signedUrl);
            setError(false);
          } catch (err) {
            console.error('[AudioBubble] Failed to recover audio source', err);
            setError(true);
          }
        }}
      />
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
          {formatPlaybackPosition(currentSec * 1000)} / {formatDuration(
            typeof durationMs === 'number' && durationMs > 0
              ? durationMs
              : undefined
          )}
        </span>
      </div>
    </div>
  );
}
