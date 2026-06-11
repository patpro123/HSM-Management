import { useState, useEffect } from 'react';
import { PTMAppointment } from '../types';
import { apiGet } from '../api';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PTMHistoryTabProps {
  studentId: string;
}

export default function PTMHistoryTab({ studentId }: PTMHistoryTabProps) {
  const [history, setHistory] = useState<PTMAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet(`/api/ptm/students/${studentId}/history`)
      .then(res => setHistory(res.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <p className="text-slate-400 text-sm text-center py-8">Loading PTM history...</p>;

  if (!history.length) {
    return (
      <div className="text-center py-12 text-slate-400">
        <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="font-medium">No PTM history yet</p>
        <p className="text-sm mt-1">PTM meetings will appear here once scheduled.</p>
      </div>
    );
  }

  const mostRecent = history[0];
  const openCarryForwards = (mostRecent?.action_items || []).filter(ai => ai.status === 'open');

  return (
    <div className="space-y-4">
      {openCarryForwards.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Open actions from last PTM ({mostRecent.session_title})</p>
          <ul className="space-y-1.5">
            {openCarryForwards.map(ai => (
              <li key={ai.id} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="mt-1 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span>{ai.action_text}</span>
                <span className="text-xs text-amber-500 ml-auto">{ai.assigned_to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.map(appt => {
        const open = (appt.action_items || []).filter(ai => ai.status === 'open').length;
        const done = (appt.action_items || []).filter(ai => ai.status === 'done').length;

        return (
          <div key={appt.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{appt.session_title}</p>
                <p className="text-xs text-slate-500">{appt.scheduled_date ? formatDate(appt.scheduled_date) : '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{appt.teacher_name}</span>
                {appt.instrument_name && (
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{appt.instrument_name}</span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${appt.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {appt.status}
                </span>
              </div>
            </div>

            {appt.notes && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-3 whitespace-pre-line">{appt.notes}</p>
            )}

            {(appt.action_items || []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">
                  Action Items
                  {done > 0 && <span className="ml-1.5 text-green-600">{done} done</span>}
                  {open > 0 && <span className="ml-1.5 text-amber-600">{open} open</span>}
                </p>
                <ul className="space-y-1">
                  {(appt.action_items || []).map(ai => (
                    <li key={ai.id} className="flex items-start gap-2 text-sm">
                      <span className={`mt-1 w-3 h-3 rounded flex-shrink-0 flex items-center justify-center ${ai.status === 'done' ? 'bg-green-500' : 'border border-slate-300'}`}>
                        {ai.status === 'done' && (
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </span>
                      <span className={ai.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}>{ai.action_text}</span>
                      <span className="text-xs text-slate-400 ml-auto">{ai.assigned_to}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
