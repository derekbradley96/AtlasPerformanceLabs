import { getCallRingbackVolume, getCallSoundEnabled } from '@/lib/callSoundPrefs';

function getAudioContextCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function createTone(audioContext, frequency, durationMs, gainValue = 0.04) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + (durationMs / 1000));
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + (durationMs / 1000));
}

function createLoopPlayer(patternFn, intervalMs) {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return { start: () => {}, stop: () => {} };
  }
  let audioContext = null;
  let intervalId = null;
  const timeouts = new Set();

  const clearAllTimers = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    for (const timeoutId of timeouts) {
      clearTimeout(timeoutId);
    }
    timeouts.clear();
  };

  const stop = () => {
    clearAllTimers();
    if (audioContext) {
      try {
        audioContext.close();
      } catch (_) {}
      audioContext = null;
    }
  };

  const start = async () => {
    if (intervalId) return;
    if (!audioContext) audioContext = new AudioContextCtor();
    try {
      if (audioContext.state === 'suspended') await audioContext.resume();
    } catch (_) {}
    patternFn(audioContext, timeouts);
    intervalId = setInterval(() => {
      patternFn(audioContext, timeouts);
    }, intervalMs);
  };

  return { start, stop };
}

export function createIncomingRingtonePlayer() {
  return createLoopPlayer((audioContext, timeouts) => {
    if (!getCallSoundEnabled()) return;
    createTone(audioContext, 880, 140, 0.045);
    const secondTone = setTimeout(() => {
      createTone(audioContext, 740, 160, 0.04);
    }, 260);
    timeouts.add(secondTone);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([90, 80, 120]);
      } catch (_) {}
    }
  }, 1800);
}

export function createRingbackPlayer() {
  return createLoopPlayer((audioContext) => {
    if (!getCallSoundEnabled()) return;
    createTone(audioContext, 460, 800, Math.max(0.01, getCallRingbackVolume() * 0.08));
  }, 2200);
}

