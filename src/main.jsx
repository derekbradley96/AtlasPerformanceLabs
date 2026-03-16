import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { seedIfEmpty } from '@/lib/sandboxStore'
import { hasSupabase } from '@/lib/supabaseClient'
import { getRequiredEnvError } from '@/lib/envGuard'

// Fail loudly if VITE_APP_MODE=real but required env vars are missing
const envError = getRequiredEnvError()
if (envError) {
  console.error('[ATLAS] Boot blocked:', envError)
}

if (import.meta.env.DEV) {
  console.log('[ATLAS] Booting', new Date().toISOString(), location.href);
  console.log('[Supabase]', hasSupabase ? 'configured' : 'NOT configured, using local mode');
}
window.__ATLAS_BOOTED__ = true
if (!envError) seedIfEmpty()

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

/** Root error boundary: catches crashes outside Router (e.g. AuthProvider) so we never show a black screen. */
class RootErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary]', error?.message ?? error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error instanceof Error ? this.state.error.message : String(this.state.error ?? 'Unknown error')
      return (
        <div
          style={{
            minHeight: '100vh',
            minHeight: '100dvh',
            background: '#0B1220',
            color: '#E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>Something went wrong</p>
          <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 24, textAlign: 'center', maxWidth: 320 }}>{msg}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              background: '#3B82F6',
              border: 'none',
              borderRadius: 12,
            }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function BootContent() {
  if (envError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          minHeight: '100dvh',
          background: '#0B1220',
          color: '#E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Configuration required</p>
        <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 16, maxWidth: 360 }}>{envError}</p>
        <p style={{ fontSize: 13, color: '#64748B' }}>Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
      </div>
    )
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <BootContent />
  </RootErrorBoundary>
)
