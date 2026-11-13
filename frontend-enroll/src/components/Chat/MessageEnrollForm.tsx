import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api';
import { ProposalSummary } from './chatTypes';
import { MessageProposal } from './MessageProposal';

interface BatchOption { id: string; recurrence: string; instrument_id: string; instrument_name: string; teacher_name?: string | null; is_makeup?: boolean }

interface MessageEnrollFormProps {
  text?: string;
  proposal?: ProposalSummary;
  /** Keeps the raised proposal on the message so the form is replaced by its card */
  onSubmitted: (proposal: ProposalSummary) => void;
}

const FREQUENCIES = [['monthly', 'Monthly'], ['quarterly', 'Quarterly']] as const;

const input: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border, #e5e0d5)', fontSize: 13, boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontSize: 11, color: 'var(--muted, #8a7d65)', marginBottom: 2, display: 'block' };

export function MessageEnrollForm({ text, proposal, onSubmitted }: MessageEnrollFormProps) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [form, setForm] = useState({ first_name: '', last_name: '', dob: '', phone: '', guardian_name: '', email: '', address: '' });
  const [instrumentId, setInstrumentId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly'>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (proposal) return;
    apiGet('/api/batches')
      .then(d => setBatches((d.batches || []).filter((b: BatchOption) => !b.is_makeup)))
      .catch(() => setError('Could not load classes'));
  }, [proposal]);

  if (proposal) return <MessageProposal text={text} proposal={proposal} onChange={onSubmitted} />;

  const instruments = [...new Map(batches.map(b => [b.instrument_id, b.instrument_name])).entries()];
  const options = batches.filter(b => b.instrument_id === instrumentId);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // At most two weekly classes per instrument, matching the enrollment rules.
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < 2 ? [...p, id] : p));
  const pickInstrument = (id: string) => { setInstrumentId(id); setPicked([]); };

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name are required'); return; }
    if (!picked.length) { setError('Choose at least one class'); return; }
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost('/api/proposals', {
        action_type: 'enroll.student',
        source_channel: 'chat',
        params: { ...form, batches: picked.map(batch_id => ({ batch_id, payment_frequency: frequency })) },
      });
      // The create response has no per-user flag; the detail view does.
      const detail = await apiGet(`/api/proposals/${created.proposal.id}`);
      onSubmitted({
        id: detail.proposal.id, action_type: detail.proposal.action_type, summary: detail.proposal.summary,
        status: detail.proposal.status, can_decide: detail.proposal.can_decide, is_money: detail.proposal.is_money,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise the request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderLeft: '3px solid var(--accent-strong, #ff904e)', borderRadius: 8, padding: 12, width: '100%' }}>
      {text && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><span style={label}>First name *</span><input style={input} value={form.first_name} onChange={set('first_name')} /></div>
        <div><span style={label}>Last name *</span><input style={input} value={form.last_name} onChange={set('last_name')} /></div>
        <div><span style={label}>Date of birth</span><input style={input} type="date" value={form.dob} onChange={set('dob')} /></div>
        <div><span style={label}>Phone</span><input style={input} type="tel" value={form.phone} onChange={set('phone')} /></div>
        <div><span style={label}>Guardian name</span><input style={input} value={form.guardian_name} onChange={set('guardian_name')} /></div>
        <div><span style={label}>Email</span><input style={input} type="email" value={form.email} onChange={set('email')} /></div>
      </div>
      <div style={{ marginTop: 8 }}><span style={label}>Address</span><input style={input} value={form.address} onChange={set('address')} /></div>

      <div style={{ marginTop: 8 }}>
        <span style={label}>Instrument *</span>
        <select style={input} value={instrumentId} onChange={e => pickInstrument(e.target.value)}>
          <option value="">Choose…</option>
          {instruments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      {options.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={label}>Weekly classes (up to 2) *</span>
          {options.map(b => (
            <label key={b.id} style={{ display: 'flex', gap: 6, fontSize: 12, padding: '3px 0', alignItems: 'center' }}>
              <input type="checkbox" checked={picked.includes(b.id)} onChange={() => toggle(b.id)} />
              <span>{b.recurrence}{b.teacher_name ? ` · ${b.teacher_name}` : ''}</span>
            </label>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <span style={label}>Plan</span>
        <select style={input} value={frequency} onChange={e => setFrequency(e.target.value as 'monthly' | 'quarterly')}>
          {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {error && <div role="alert" style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{error}</div>}
      <button type="button" disabled={busy} onClick={submit} style={{
        marginTop: 10, width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', background: 'var(--accent-strong, #ff904e)',
        color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
      }}>{busy ? 'Sending…' : 'Send for approval'}</button>
    </div>
  );
}
