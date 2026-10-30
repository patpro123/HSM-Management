import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  error: Error | null;
}

const STORAGE_KEY = 'hsm_chat_session_v1';

// A chat rendering error must never blank the whole app. This keeps the page alive and shows
// what went wrong, with a way to clear the saved conversation and try again.
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[chat] render error:', error);
  }

  private reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001, background: '#fff',
          borderRadius: '16px 16px 0 0', boxShadow: '0 -6px 30px rgba(0,0,0,0.25)',
          padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Cleff hit a problem</div>
        <div style={{ fontSize: 12, color: '#721c24', marginBottom: 12, wordBreak: 'break-word' }}>{this.state.error.message}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" onClick={this.reset}
            style={{ flex: 1, height: 44, border: 'none', borderRadius: 10, fontWeight: 700, background: 'var(--accent-strong, #ff904e)', color: '#1b1307', cursor: 'pointer' }}
          >
            Clear chat and retry
          </button>
          <button
            type="button" onClick={this.props.onClose}
            style={{ height: 44, padding: '0 16px', border: '1px solid var(--border, #e5e0d5)', borderRadius: 10, fontWeight: 600, background: '#fff', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }
}
