/**
 * Voice recording engine: MediaRecorder, returns stop/cancel with blob + duration.
 * Prefer audio/webm;codecs=opus, fallback audio/mp4 or audio/webm.
 */

const MIME_OPTIONS = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function getSupportedMime() {
  for (const m of MIME_OPTIONS) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return 'audio/webm';
}

/**
 * Start voice recording. Returns { stop, cancel }.
 * stop() => Promise<{ blob, mimeType, durationMs }>
 * cancel() => Promise<void>
 */
export async function startVoiceRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = getSupportedMime();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  const startTime = performance.now();

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstart = () => {
      resolve({
        stop: () =>
          new Promise((res, rej) => {
            try {
              recorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                const durationMs = Math.round(performance.now() - startTime);
                const blob = chunks.length ? new Blob(chunks, { type: mimeType }) : null;
                res({ blob, mimeType, durationMs });
              };
              if (recorder.state === 'recording') recorder.stop();
            } catch (err) {
              stream.getTracks().forEach((t) => t.stop());
              rej(err);
            }
          }),
        cancel: () =>
          new Promise((res) => {
            try {
              if (recorder.state === 'recording') recorder.stop();
              stream.getTracks().forEach((t) => t.stop());
            } finally {
              res();
            }
          }),
      });
    };

    try {
      recorder.start(100);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      reject(err);
    }
  });
}
