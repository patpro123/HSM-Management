import { useState, useEffect } from 'react';
import { PTMAppointment } from '../types';
import { apiGet } from '../api';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface TeacherPTMTabProps {
  teacherId: string;
}

export default function TeacherPTMTab({ teacherId }: TeacherPTMTabProps) {
  const [appointments, setAppointments] = useState<PTMAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  useEffect(() => {
    apiGet(`/api/ptm/teachers/${teacherId}/appointments`)
      .then(res => setAppointments(res.appointments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teacherId]);

  const visible = appointments.filter(a => {
    if (filter === 'upcoming') return a.status === 'scheduled';
    if (filter === 'past') return a.status === 'completed' || a.status === 'no_show' || a.status === 'cancelled';
    return true;
  });

  if (loading) return <p className="text-slate-400 text-sm text-center py-8">Loading PTM schedule...</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['upcoming', 'past', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-orange-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="font-medium">No PTM appointments</p>
          <p className="text-sm mt-1">PTM meetings assigned to you will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(appt => (
            <div key={appt.id} className={`bg-white border rounded-xl p-4 ${appt.status === 'completed' ? 'border-green-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{appt.student_name}</span>
                    {appt.instrument_name && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{appt.instrument_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {appt.session_title}
                    {appt.scheduled_date && <span className="ml-2">{formatDate(appt.scheduled_date)}</span>}
                    {appt.scheduled_time && <span className="ml-2">at {formatTime(appt.scheduled_time)}</span>}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${appt.status === 'completed' ? 'bg-green-100 text-green-700' : appt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {appt.status}
                </span>
              </div>

              {appt.notes && (
                <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-line">{appt.notes}</p>
              )}

              {(appt.action_items || []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Action Items</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
