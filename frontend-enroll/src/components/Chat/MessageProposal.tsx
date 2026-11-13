import { useState } from 'react';
import { apiGet, apiPost } from '../../api';
import { ProposalSummary } from './chatTypes';

interface MessageProposalProps {
  text?: string;
  proposal: ProposalSummary;
  /** Called with the new state so the message keeps it (and it is saved with the chat) */
  onChange: (proposal: ProposalSummary) => void;
}

const STATUS: Record<ProposalSummary['status'], { label: string; color: string }> = {
  pending: { label: 'Waiting for approval', color: '#b45309' },
  executed: { label: 'Approved and done', color: '#15803d' },
  rejected: { label: 'Rejected', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
  failed: { label: 'Approved but could not run', color: '#b91c1c' },
};

export function MessageProposal({ text, proposal, onChange }: MessageProposalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = STATUS[proposal.status] ?? STATUS.pending;

  const decide = async (verb: 'approve' | 'reject') => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost(`/api/proposals/${proposal.id}/${verb}`, {});
      onChange({ ...proposal, status: res.proposal.status, can_decide: false, error: res.proposal.error });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your decision');
    } finally {
      setBusy(false);
    }
  };

  // Someone else may have decided it since this card was drawn.
  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiGet(`/api/proposals/${proposal.id}`);
      onChange({ ...proposal, status: res.proposal.status, can_decide: res.proposal.can_decide, error: res.proposal.error });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the status');
    } finally {
      setBusy(false);
    }
  };

  const button = (bg: string, color: string): React.CSSProperties => ({
    flex: 1, padding: '8px 10px', borderRadius: 8, border: bg === '#fff' ? '1px solid var(--border, #e5e0d5)' : 'none',
    background: bg, color, fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
  });

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderLeft: '3px solid var(--accent-strong, #ff904e)',
      borderRadius: 8, padding: 12, width: '100%',
    }}>
      {text && <div style={{ fontSize: 12, color: 'var(--muted, #8a7d65)', marginBottom: 4 }}>{text}</div>}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{proposal.summary}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: status.color, marginBottom: proposal.status === 'pending' ? 8 : 0 }}>
        {status.label}{proposal.error ? `: ${proposal.error}` : ''}
      </div>

      {proposal.status === 'pending' && proposal.can_decide && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => decide('approve')} style={button('#15803d', '#fff')}>Approve</button>
          <button type="button" disabled={busy} onClick={() => decide('reject')} style={button('#fff', '#b91c1c')}>Reject</button>
        </div>
      )}
      {proposal.status === 'pending' && !proposal.can_decide && (
        <button type="button" disabled={busy} onClick={refresh} style={{
          background: 'none', border: 'none', padding: 0, color: 'var(--accent-strong, #ff904e)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>Check status</button>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>{error}</div>}
    </div>
  );
}
