import React from 'react';
import { Capacitor } from '@capacitor/core';
import { colors, spacing } from '@/ui/tokens';
import { saveCrash, getLastCrashJson } from '@/lib/crashLog';
import { captureUiError } from '@/services/errorLogger';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

/** Extract clientId from current location (pathname or hash for HashRouter). */
function getClientIdFromPath(pathname, hash) {
  const path = (pathname || '') + (hash || '');
  if (!path) return undefined;
  const m = path.match(/\/clients\/([^/]+)/);
  return m ? m[1] : undefined;
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorMessage: '',
      errorStack: '',
      componentStack: '',
      detailsExpanded: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    const componentStack = info?.componentStack ?? '';
    const fallback = (message === '' || message === 'Unknown error') && error != null
      ? (typeof JSON.stringify !== 'undefined' ? JSON.stringify(error) : String(error))
      : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const route = typeof window !== 'undefined' ? { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash } : {};
    const clientId = getClientIdFromPath(pathname, hash);
    const isNative = Capacitor?.isNativePlatform?.() ?? false;
    const sessionUserId = typeof this.props.getSessionUserId === 'function' ? this.props.getSessionUserId() : undefined;
    try {
      saveCrash(error, info);
    } catch (_) {}
    try {
      captureUiError('ErrorBoundary', error, { componentStack: info?.componentStack?.slice(0, 200) });
    } catch (_) {}
    let safeErrorJson = '';
    try {
      safeErrorJson = JSON.stringify({ message, name: error?.name, stack: (error && error.stack) || '' }, null, 2);
    } catch (_) {
      safeErrorJson = String(error);
    }
    this.setState({ errorMessage: message || fallback, errorStack: stack, componentStack });
    if (typeof console !== 'undefined' && console.error) {
      console.error('[ErrorBoundary] route:', route);
      console.error('[ErrorBoundary] clientId:', clientId);
      console.error('[ErrorBoundary] isNative:', isNative);
      console.error('[ErrorBoundary] sessionUserId:', sessionUserId);
      console.error('[ErrorBoundary] message:', message || fallback);
      console.error('[ErrorBoundary] full stack:', stack);
      console.error('[ErrorBoundary] componentStack:', componentStack);
      console.error('[ErrorBoundary] error (safe JSON):', safeErrorJson);
      if (fallback) console.error('[ErrorBoundary] error (fallback):', fallback);
    }
  }

  handleRetry = () => {
    this.setState(
      { hasError: false, error: null, errorMessage: '', errorStack: '', componentStack: '', detailsExpanded: false }
    );
    this.props.onReset?.();
  };

  toggleDetails = () => {
    this.setState((s) => ({ detailsExpanded: !s.detailsExpanded }));
  };

  handleCopyErrorDetails = () => {
    const json = getLastCrashJson();
    if (json && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        console.log('[ErrorBoundary] Crash JSON copied to clipboard. Save to file with:');
        console.log('  node scripts/writeCrashLog.mjs \'<paste JSON here>\'');
      }).catch(() => {
        console.log('[ErrorBoundary] Last crash JSON (run writeCrashLog.mjs with this):', json);
      });
    } else {
      console.log('[ErrorBoundary] Last crash JSON (run writeCrashLog.mjs with this):', json);
    }
  };

  render() {
    if (this.state.hasError) {
      if (isDev) {
        const { error, errorMessage, errorStack, componentStack, detailsExpanded } = this.state;
        const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
        return (
          <div style={{ padding: 20, color: 'red', whiteSpace: 'pre-wrap' }}>
            <h2>DEV ERROR</h2>
            <div>{message}</div>
            <button type="button" onClick={this.toggleDetails} style={{ marginTop: 12, marginBottom: 8 }}>
              {detailsExpanded ? 'Hide' : 'Show'} Details
            </button>
            {detailsExpanded && (
              <div style={{ marginTop: 8, padding: 8, background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}><strong>Message:</strong> {message}</div>
                {errorStack ? <div style={{ marginBottom: 8 }}><strong>Stack:</strong>\n{errorStack}</div> : null}
                {componentStack ? <div><strong>Component stack:</strong>\n{componentStack}</div> : null}
              </div>
            )}
            <button type="button" onClick={this.handleRetry} style={{ display: 'block', marginTop: 12 }}>
              Reset (go back)
            </button>
            <button type="button" onClick={this.handleCopyErrorDetails} style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
              Copy error details (then run: node scripts/writeCrashLog.mjs &#39;&lt;paste&gt;&#39;)
            </button>
          </div>
        );
      }
      return (
        <div
          className="min-h-[40vh] flex flex-col items-center justify-center px-6"
          style={{
            background: colors.bg,
            color: colors.text,
            paddingTop: spacing[32],
            paddingBottom: spacing[32],
          }}
        >
          <div
            className="rounded-[20px] border w-full max-w-sm overflow-hidden"
            style={{
              background: colors.card,
              borderColor: colors.border,
              padding: spacing[24],
            }}
          >
            <p className="text-[17px] font-semibold mb-2" style={{ color: colors.text }}>
              Something went wrong
            </p>
            {this.state.errorMessage ? (
              <pre className="text-[12px] mb-4 overflow-auto max-h-24 rounded p-2" style={{ color: colors.muted, background: colors.surface1, border: `1px solid ${colors.border}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {String(this.state.errorMessage).slice(0, 300)}
              </pre>
            ) : null}
            <p className="text-[14px] mb-6" style={{ color: colors.muted }}>
              This screen could not be loaded. Tap below to try again or go back.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full py-3 rounded-xl font-medium text-[15px] border-none"
                style={{
                  background: colors.accent,
                  color: '#fff',
                }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => typeof window !== 'undefined' && window.history.length > 1 && window.history.back()}
                className="w-full py-3 rounded-xl font-medium text-[15px]"
                style={{
                  background: 'transparent',
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    if (window.location.hash != null && window.location.hash.length > 0) {
                      window.location.hash = '#/home';
                    } else {
                      window.location.href = '/home';
                    }
                  }
                }}
                className="w-full py-3 rounded-xl font-medium text-[15px] mt-2"
                style={{
                  background: 'transparent',
                  color: colors.muted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Go home
              </button>
              {isDev && (
                <button
                  type="button"
                  onClick={this.handleCopyErrorDetails}
                  className="w-full py-2 rounded-xl font-medium text-[13px]"
                  style={{
                    background: 'transparent',
                    color: colors.muted,
                    border: `1px solid ${colors.border}`,
                    marginTop: 8,
                  }}
                >
                  Copy error details
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
