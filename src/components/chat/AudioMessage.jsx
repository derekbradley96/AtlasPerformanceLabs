/**
 * Audio message bubble: play/pause, progress, duration. Uses Atlas blue tokens.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { colors } from '@/ui/tokens';

function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioMessage({ message, isOutgoing }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const audioUrl = message?.audioDataUrl ?? message?.audioUrl ?? '';
  const durationMs = message?.durationMs ?? 0;
  const displayDuration = durationMs || duration;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTimeUpdate = () => setProgress(el.currentTime);
    const onDurationChange = () => setDuration(el.duration * 1000);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, audioUrl]);

  const toggle = () => setPlaying((p) => !p);

  const currentMs = progress * 1000;
  const totalMs = duration || durationMs || 1;
  const pct = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

  const bubbleBg = isOutgoing ? colors.primary : colors.surface1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: '76%',
        alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
        padding: '10px 12px',
        borderRadius: 18,
        background: bubbleBg,
      }}
    >
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
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
          {formatDuration(currentMs)} / {formatDuration(displayDuration)}
        </span>
      </div>
    </div>
  );
}
