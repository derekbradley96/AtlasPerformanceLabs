import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { seedIfEmpty } from '@/lib/sandboxStore'
import { hasSupabase } from '@/lib/supabaseClient'

if (import.meta.env.DEV) {
  console.log('[ATLAS] Booting', new Date().toISOString(), location.href);
  console.log('[Supabase]', hasSupabase ? 'configured' : 'NOT configured, using local mode');
}
window.__ATLAS_BOOTED__ = true
seedIfEmpty()

/** Last runtime error (message, stack, source, time) for dev/demo debug overlay. */
window.__atlasLastError = null

function safeStringify(x) {
  try {
    if (x instanceof Error) return `Error: ${x.message}`
    if (typeof x === 'object' && x !== null) return JSON.stringify(x)
    return String(x)
  } catch {
    return String(x)
  }
}

function setAtlasLastError(message, stack, source) {
  try {
    window.__atlasLastError = {
      message: message ?? 'unknown',
      stack: stack ?? '',
      source: source ?? 'error',
      time: new Date().toISOString(),
    }
  } catch (_) {}
}

window.addEventListener('error', (e) => {
  const msg = e?.message ?? 'unknown'
  const stack = e?.error?.stack ?? ''
  setAtlasLastError(msg, stack, 'window.error')
  console.error('[window.error] message:', msg)
  console.error('[window.error] filename:', e.filename, 'lineno:', e.lineno, 'colno:', e.colno)
  if (stack) console.error('[window.error] stack:', stack)
  if (e.error != null) console.error('[window.error] error:', safeStringify(e.error))
})

window.addEventListener('unhandledrejection', (e) => {
  const reason = e?.reason
  const msg = reason instanceof Error ? reason.message : safeStringify(reason)
  const stack = reason instanceof Error ? reason.stack : ''
  setAtlasLastError(msg, stack, 'unhandledrejection')
  console.error('[unhandledrejection] reason:', msg)
  if (stack) console.error('[unhandledrejection] stack:', stack)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
