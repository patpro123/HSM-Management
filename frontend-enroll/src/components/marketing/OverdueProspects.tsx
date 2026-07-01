import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import type { OverdueProspect } from '../../types';

function HoursLabel({ hours }: { hours: number }) {
  if (hours < 24) return <span className="text-yellow-700 bg-yellow-100 text-xs px-2 py-0.5 rounded-full">{Math.round(hours)}h overdue</span>;
  const days = Math.floor(hours / 24);
  return <span className="text-red-700 bg-red-100 text-xs px-2 py-0.5 rounded-full">{days}d overdue</span>;
}

export default function OverdueProspects() {
  const [prospects, setProspects] = useState<OverdueProspect[]>([]);
  const [threshold, setThreshold] = useState(48);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (hours: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/marketing/overdue-prospects?hours=${hours}`);
      setProspects(data.overdue || []);
    } catch {
      setError('Failed to load overdue prospects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(threshold); }, [threshold]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Follow-up Overdue
          {!loading && (
            <span className="ml-2 text-red-600 bg-red-50 border border-red-100 text-xs px-2 py-0.5 rounded-full font-normal">
              {prospects.length} prospects
            </span>
          )}
        </h3>
        <select
          className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-600"
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
        >
          <option value={24}>24h threshold</option>
          <option value={48}>48h threshold</option>
          <option value={72}>72h threshold</option>
        </select>
      </div>

      {loading && <div className="text-gray-400 text-sm py-2">Loading...</div>}
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {!loading && prospects.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">
          All prospects contacted within {threshold}h.
        </div>
      )}

      {!loading && prospects.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {prospects.map(p => {
            const phone = p.phone;
            const instrument = (p.metadata as Record<string, string>)?.interested_instrument || '';
            const stageLabel = p.student_type === 'demo_day' ? 'Demo booked' : 'Prospect';
            return (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-white hover:bg-gray-50 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{stageLabel}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {phone}{instrument ? ` · ${instrument}` : ''}
                  </div>
                  {p.last_note_at ? (
                    <div className="text-xs text-gray-400">Last contact: {new Date(p.last_note_at).toLocaleDateString()}</div>
                  ) : (
                    <div className="text-xs text-gray-400">No contact recorded</div>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <HoursLabel hours={p.hours_since_contact} />
                  <a
                    href={`https://wa.me/91${phone?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
