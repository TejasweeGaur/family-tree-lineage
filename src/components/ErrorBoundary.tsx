import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_VERSION, AUTHOR_EMAIL } from '../config/app';

interface State { error: Error | null; }

/**
 * Last line of defence: without it, any unexpected render error blanks the
 * whole page with no explanation. Error boundaries still have to be class
 * components — React has no hook equivalent.
 *
 * Only render errors land here. Failed saves and network errors are already
 * reported through the notice toast.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const report = `Version ${APP_VERSION}\nPage: ${location.href}\n\n${error.name}: ${error.message}\n\n${(error.stack ?? '').slice(0, 1200)}`;
    const mailto = `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent('Family Tree: something went wrong')}&body=${encodeURIComponent(report)}`;

    return (
      <div role="alert" style={{
        minHeight: '100vh', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, background: '#F7F5F2', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#1C1917',
      }}>
        <div style={{
          width: '100%', maxWidth: 440, background: '#FFFDFB', border: '1px solid #E7E2DC', borderRadius: 20,
          boxShadow: '0 26px 60px rgba(28,25,23,.12)', padding: '28px 26px 24px',
        }}>
          <img src="/favicon.svg" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', margin: '16px 0 0' }}>Something went wrong</h1>
          <p style={{ fontSize: 13.5, color: '#57534E', lineHeight: 1.6, margin: '8px 0 0' }}>
            The page hit an unexpected error. Your family's data is safe — it's stored on the server,
            not in this page. Reloading usually fixes it.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <button type="button" onClick={() => location.reload()} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none', background: '#C2410C', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Reload the page</button>
            <a href={mailto} style={{
              padding: '10px 14px', borderRadius: 10, border: '1px solid #E7E2DC', background: '#fff',
              fontSize: 13, fontWeight: 700, color: '#44403C', textDecoration: 'none',
            }}>Report the problem</a>
          </div>
          <details style={{ marginTop: 18 }}>
            <summary style={{ fontSize: 12, color: '#A8A29E', cursor: 'pointer' }}>Technical details</summary>
            <pre style={{
              marginTop: 8, padding: 10, borderRadius: 10, background: '#F5F1EC', fontSize: 11, color: '#57534E',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto',
            }}>{report}</pre>
          </details>
        </div>
      </div>
    );
  }
}
