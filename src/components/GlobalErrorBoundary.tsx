/* ══════════════════════════════════════════════════════════════
   GLOBAL ERROR BOUNDARY — Production-grade crash recovery
   Catches runtime errors in any child component.
   Shows a clean, branded fallback UI with:
   - Error message & stack trace display
   - "Try Again" button (re-renders component tree)
   - "Copy Error Log" button (copies to clipboard)
   - "Reload Page" button (full refresh)
   - Timestamped error for debugging
   ══════════════════════════════════════════════════════════════ */
import { Component, type ReactNode } from 'react';
import { ErrorOutlined, Refresh, ContentCopy, RestartAlt, BugReport } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  /** Optional fallback UI override */
  fallback?: ReactNode;
  /** Called when error occurs (for logging to backend) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  timestamp: string;
  copied: boolean;
}

export default class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
      timestamp: '',
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      timestamp: new Date().toISOString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const stack = errorInfo.componentStack || '';
    console.error('[GlobalErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo: stack });

    /* Report to backend error logging service if available */
    this.props.onError?.(error, errorInfo);

    /* Also log to console for dev debugging */
    console.group('[GlobalErrorBoundary] Error Details');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', stack);
    console.groupEnd();
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: '', timestamp: '', copied: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyLog = async () => {
    const log = [
      '═══ SPORTMEDICAL ERROR REPORT ═══',
      `Timestamp: ${this.state.timestamp}`,
      `Error: ${this.state.error?.message}`,
      '',
      'Stack Trace:',
      this.state.error?.stack || 'N/A',
      '',
      'Component Stack:',
      this.state.errorInfo || 'N/A',
      '═══════════════════════════════════',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(log);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* Fallback: create textarea and copy */
      const ta = document.createElement('textarea');
      ta.value = log;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      /* If a custom fallback is provided, use it */
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            padding: 'var(--space-6)',
            fontFamily: 'var(--font-family)',
          }}
          role="alert"
          aria-live="assertive"
        >
          <div
            style={{
              maxWidth: 560,
              width: '100%',
              background: 'var(--color-bg-paper)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-modal)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '32px 32px 0',
              textAlign: 'center',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 'var(--radius-full)',
                background: 'var(--color-critical-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <ErrorOutlined sx={{ fontSize: 40, color: 'var(--color-critical)' }} />
              </div>

              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}>
                Došlo k neočekávané chybě
              </h1>

              <p style={{
                margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}>
                Aplikace narazila na problém, který nebyl možné vyřešit. Můžete to zkusit znovu nebo obnovit stránku.
              </p>
            </div>

            {/* Error details (collapsible) */}
            <details style={{ margin: '16px 32px', fontSize: 13 }}>
              <summary style={{
                cursor: 'pointer', color: 'var(--color-text-muted)',
                fontWeight: 500, padding: '8px 0',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <BugReport sx={{ fontSize: 16 }} />
                Technické podrobnosti
              </summary>
              <div style={{
                marginTop: 8, padding: 12,
                background: 'var(--color-bg-hover)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace', fontSize: 12,
                color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                <div style={{ marginBottom: 8, color: 'var(--color-text-muted)', fontSize: 11 }}>
                  {this.state.timestamp}
                </div>
                <strong>{this.state.error?.message}</strong>
                {this.state.errorInfo && (
                  <div style={{ marginTop: 8, opacity: 0.7 }}>
                    {this.state.errorInfo}
                  </div>
                )}
              </div>
            </details>

            {/* Actions */}
            <div style={{
              padding: '0 32px 32px',
              display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
            }}>
              <button
                className="btn btn--primary"
                onClick={this.handleRetry}
                style={{ gap: 8 }}
              >
                <Refresh sx={{ fontSize: 18 }} />
                Zkusit znovu
              </button>

              <button
                className="btn btn--ghost"
                onClick={this.handleReload}
                style={{ gap: 8 }}
              >
                <RestartAlt sx={{ fontSize: 18 }} />
                Obnovit stránku
              </button>

              <button
                className="btn btn--ghost"
                onClick={this.handleCopyLog}
                style={{ gap: 8 }}
              >
                <ContentCopy sx={{ fontSize: 18 }} />
                {this.state.copied ? 'Zkopírováno!' : 'Kopírovat chybový log'}
              </button>
            </div>

            {/* Timestamp */}
            <div style={{
              padding: '12px 32px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-hover)',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--color-text-muted)',
            }}>
              Čas chyby: {this.state.timestamp} • SportMedical Diagnostics
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
