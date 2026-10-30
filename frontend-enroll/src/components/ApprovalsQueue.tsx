import React, { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';

interface AuditEntry {
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  timestamp: string;
}

interface Proposal {
  id: string;
  action_type: string;
  summary: string;
  is_money: boolean;
  status: 'pending' | 'executed' | 'rejected' | 'cancelled' | 'failed';
  source_channel: string;
  proposed_by_name: string | null;
  proposed_role: string;
  decided_by_name: string | null;
  decision_note: string | null;
  self_approved: boolean;
  auto_approved: boolean;
  error: string | null;
  created_at: string;
  can_decide: boolean;
  audit?: AuditEntry[];
}

const STATUS_STYLE: Record<Proposal['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  executed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-slate-200 text-slate-700',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<Proposal['status'], string> = {
  pending: 'Pending',
  executed: 'Approved and done',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

const ApprovalsQueue: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [trail, setTrail] = useState<AuditEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiGet(`/api/proposals${filter === 'pending' ? '?status=pending' : ''}`);
      setProposals(data.proposals);
    } catch (e: any) {
      setError(e.message || 'Could not load proposals');
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const toggleTrail = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    const data = await apiGet(`/api/proposals/${id}`);
    setTrail(data.proposal.audit || []);
    setOpenId(id);
  };

  const decide = async (p: Proposal, verb: 'approve' | 'reject') => {
    setBusyId(p.id);
    setError(null);
    try {
      await apiPost(`/api/proposals/${p.id}/${verb}`, {});
      await load();
    } catch (e: any) {
      setError(e.message || `Could not ${verb}`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">Changes proposed by staff or the assistant wait here until you approve them.</p>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setError(null); setFilter(f); }}
              className={`px-3 py-1 rounded-md text-sm font-semibold ${filter === f ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >
              {f === 'pending' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {proposals.length === 0 && !error && (
        <div className="p-10 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          {filter === 'pending' ? 'Nothing is waiting for approval.' : 'No proposals yet.'}
        </div>
      )}

      <ul className="space-y-3">
        {proposals.map(p => (
          <li key={p.id} data-testid="proposal" className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  {p.is_money && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Money · Admin only</span>}
                  {p.auto_approved && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">Auto-approved · expected fee</span>}
                  {p.self_approved &&<span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800">Self-approved</span>}
                  <span className="text-xs text-slate-400">{p.action_type}</span>
                </div>
                <p className="font-semibold text-slate-900">{p.summary}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Proposed by {p.proposed_by_name || 'unknown'} ({p.proposed_role.replace(/_/g, ' ')}) via {p.source_channel} · {new Date(p.created_at).toLocaleString()}
                  {p.decided_by_name && p.status !== 'pending' && ` · decided by ${p.decided_by_name}`}
                </p>
                {p.error && <p className="text-xs text-red-600 mt-1">{p.error}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleTrail(p.id)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                  {openId === p.id ? 'Hide history' : 'History'}
                </button>
                {p.can_decide && (
                  <>
                    <button
                      disabled={busyId === p.id}
                      onClick={() => decide(p, 'reject')}
                      className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >Reject</button>
                    <button
                      disabled={busyId === p.id}
                      onClick={() => decide(p, 'approve')}
                      className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >Approve</button>
                  </>
                )}
              </div>
            </div>
            {openId === p.id && (
              <ol className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                {trail.map((a, i) => (
                  <li key={i}>
                    <span className="font-semibold">{a.action.replace('proposal.', '')}</span> · {a.actor_name || 'system'}
                    {a.actor_role ? ` (${a.actor_role.replace(/_/g, ' ')})` : ''} · {new Date(a.timestamp).toLocaleString()}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ApprovalsQueue;
