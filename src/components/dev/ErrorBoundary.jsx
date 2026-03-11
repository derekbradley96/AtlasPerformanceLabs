import React from 'react';

/**
 * Class-component error boundary. Catches runtime errors in the tree and
 * shows a full-screen dark overlay instead of a blank screen.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    const componentStack = errorInfo?.componentStack ?? '';
    const fallback = (message === '' || message === 'Unknown error') && error != null
      ? (typeof JSON.stringify !== 'undefined' ? JSON.stringify(error) : String(error))
      : '';
    console.error('[ErrorBoundary] message:', message || fallback);
    if (stack) console.error('[ErrorBoundary] stack:', stack);
    if (componentStack) console.error('[ErrorBoundary] componentStack:', componentStack);
    if (fallback) console.error('[ErrorBoundary] error (fallback):', fallback);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
      const stack = err instanceof Error ? (err.stack ?? '') : '';
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0B1220',
            color: '#E5E7EB',
            padding: 24,
            paddingTop: 'max(24px, env(safe-area-inset-top, 0))',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
            overflow: 'auto',
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>App crashed</h1>
          <p style={{ color: 'rgba(229,231,235,0.9)', marginBottom: 12 }}>{message}</p>
          {stack ? (
            <pre
              style={{
                margin: 0,
                padding: 16,
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.4,
                color: 'rgba(229,231,235,0.8)',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {stack}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
