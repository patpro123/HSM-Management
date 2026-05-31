import React, { useState } from 'react';
import { apiPost } from '../../api';

interface AgeBucket {
  key: string;
  label: string;
  range: string;
  dot: string;
  color: string;
  maxDays: number;
}

interface Instrument {
  id: string | number;
  name: string;
}

interface ConvertDraft {
  id: string;
  name: string;
  instrument: string;
  notes: string;
}

interface IntentfulUserListProps {
  intentfulList: any[];
  displayedIntentful: any[];
  ageFilter: string | null;
  ageBuckets: AgeBucket[];
  getAgeDays: (createdAt: string) => number;
  getAgeBucket: (days: number) => AgeBucket;
  onAgeFilterChange: (key: string | null) => void;
  onConvertSuccess: (updated: any) => void;
  instruments: Instrument[];
}

const IntentfulUserList: React.FC<IntentfulUserListProps> = ({
  intentfulList,
  displayedIntentful,
  ageFilter,
  ageBuckets,
  getAgeDays,
  getAgeBucket,
  onAgeFilterChange,
  onConvertSuccess,
  instruments,
}) => {
  const [converting, setConverting] = useState(false);
  const [draft, setDraft] = useState<ConvertDraft | null>(null);

  const openModal = (u: any) => {
    setDraft({
      id: u.id,
      name: u.name,
      instrument: u.metadata?.interested_instrument || '',
      notes: u.metadata?.notes || '',
    });
  };

  const handleConfirm = async () => {
    if (!draft) return;
    setConverting(true);
    try {
      const res = await apiPost(`/api/prospects/intentful-users/${draft.id}/convert`, {
        instrument: draft.instrument || undefined,
        notes: draft.notes || undefined,
      });
      onConvertSuccess(res.prospect);
      setDraft(null);
    } catch {
      alert('Failed to convert. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <>
      {/* Ageing heatmap */}
      {intentfulList.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {ageBuckets.map(bucket => {
            const count = intentfulList.filter(u => getAgeBucket(getAgeDays(u.created_at)).key === bucket.key).length;
            const isActive = ageFilter === bucket.key;
            return (
              <button
                key={bucket.key}
                onClick={() => onAgeFilterChange(isActive ? null : bucket.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
                  isActive ? `${bucket.color} border-current shadow` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                <span>{bucket.dot}</span>
                <span>{bucket.label}</span>
                <span className="text-xs opacity-70">{bucket.range}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white bg-opacity-60' : 'bg-slate-100'}`}>{count}</span>
              </button>
            );
          })}
          {ageFilter && (
            <button onClick={() => onAgeFilterChange(null)} className="text-xs text-slate-500 hover:text-slate-700 underline self-center">Clear</button>
          )}
        </div>
      )}

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Intentful Users</strong> — visitors who downloaded the free guide via the exit intent modal. Call them to qualify interest, then convert to Prospect.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {intentfulList.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No intentful users yet. They appear when someone fills in the exit intent form on the landing page.
          </div>
        ) : displayedIntentful.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">No intentful users match the current filters.</div>
        ) : (
          displayedIntentful.map(u => {
            const initials = (u.name || 'I').split(' ').map((n: string) => n[0]).slice(0, 2).join('');
            const ageDays = getAgeDays(u.created_at);
            const age = getAgeBucket(ageDays);
            return (
              <div key={u.id} className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 text-white flex items-center justify-center font-bold text-base shadow">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{u.name}</h3>
                      <p className="text-xs text-slate-500">{u.phone || '—'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${age.color}`}>{age.dot} {ageDays}d</span>
                </div>

                <div className="text-xs text-slate-500 mb-1 space-y-0.5">
                  {u.metadata?.lead_source && (
                    <div>Source: <span className="text-slate-700">{u.metadata.lead_source}</span></div>
                  )}
                  {u.metadata?.notes && (
                    <div className="italic text-slate-400 truncate">{u.metadata.notes}</div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openModal(u)}
                    className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg text-xs font-semibold hover:from-purple-600 hover:to-violet-600 transition"
                  >
                    Convert to Prospect
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Convert modal */}
      {draft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Convert to Prospect</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Converting <strong>{draft.name}</strong> — fill in what you learned on the call.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Instrument of Interest
                </label>
                <select
                  value={draft.instrument}
                  onChange={e => setDraft(d => d ? { ...d, instrument: e.target.value } : d)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm"
                >
                  <option value="">— Not specified —</option>
                  {instruments.map(inst => (
                    <option key={inst.id} value={inst.name}>{inst.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notes from the call
                </label>
                <textarea
                  value={draft.notes}
                  onChange={e => setDraft(d => d ? { ...d, notes: e.target.value } : d)}
                  placeholder="e.g. Parent is keen, child is 8 years old, interested in weekend batches…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm resize-none"
                />
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button
                onClick={() => setDraft(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={converting}
                className="px-5 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg text-sm font-semibold hover:from-purple-600 hover:to-violet-600 transition disabled:opacity-60"
              >
                {converting ? 'Converting…' : 'Convert to Prospect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IntentfulUserList;
