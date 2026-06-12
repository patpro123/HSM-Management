import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

interface StatStudent {
  id: string;
  name: string;
  teacher_id?: string;
  teacher_name?: string;
  instrument_name?: string;
  last_ptm_date?: string | null;
}

interface StatsData {
  this_month: { count: number; students: StatStudent[] };
  overdue: { count: number; students: StatStudent[] };
  total_students: number;
}

interface Session {
  id: string;
  title: string;
  scheduled_date: string;
  status: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PTMStatsProps {
  onNavigateToSession: (sessionId: string) => void;
  onBack: () => void;
}

export default function PTMStats({ onNavigateToSession, onBack }: PTMStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showThisMonth, setShowThisMonth] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Record<string, string>>({});
  const [scheduling, setScheduling] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiGet('/api/ptm/stats'), apiGet('/api/ptm/sessions')])
      .then(([statsRes, sessRes]) => {
        setStats(statsRes);
        setSessions((sessRes.sessions || []).filter((s: Session) => s.status !== 'completed'));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSchedule = async (studentId: string, teacherId: string | undefined) => {
    const sessionId = selectedSession[studentId];
    if (!sessionId || !teacherId) return;
    setScheduling(studentId);
    try {
      await apiPost(`/api/ptm/sessions/${sessionId}/appointments/bulk`, {
        appointments: [{ student_id: studentId, teacher_id: teacherId }],
      });
      onNavigateToSession(sessionId);
    } catch {
      setScheduling(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <p className="text-slate-400 text-center py-16">Loading stats...</p>
      </div>
    );
  }

  if (!stats) return null;

  const pct = stats.total_students > 0 ? Math.round((stats.this_month.count / stats.total_students) * 100) : 0;

  const uniqueTeachers = [...new Map(
    stats.overdue.students.filter(s => s.teacher_id).map(s => [s.teacher_id, s.teacher_name])
  ).entries()].map(([id, name]) => ({ id: id as string, name: name as string }));

  const overdueFiltered = filterTeacher
    ? stats.overdue.students.filter(s => s.teacher_id === filterTeacher)
    : stats.overdue.students;

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-3 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Sessions
      </button>

      <h2 className="text-xl font-bold text-slate-800 mb-4">PTM Statistics</h2>

      {/* This Month */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700">This Month</h3>
          <span className="text-2xl font-bold text-green-600">{stats.this_month.count}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{stats.this_month.count} of {stats.total_students} students</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        {stats.this_month.count > 0 && (
          <button
            onClick={() => setShowThisMonth(s => !s)}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            {showThisMonth ? 'Hide' : `Show ${stats.this_month.count} student${stats.this_month.count !== 1 ? 's' : ''}`}
          </button>
        )}
        {showThisMonth && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.this_month.students.map(s => (
              <span key={s.id} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Overdue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-700">No PTM in Last 2 Months</h3>
            <p className="text-xs text-slate-400 mt-0.5">Students needing a PTM soon</p>
          </div>
          <span className={`text-2xl font-bold ${stats.overdue.count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {stats.overdue.count}
          </span>
        </div>

        {uniqueTeachers.length > 1 && (
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none mb-3"
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
          >
            <option value="">All Teachers</option>
            {uniqueTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {overdueFiltered.length === 0 ? (
          <p className="text-center py-6 text-slate-400 text-sm">
            {stats.overdue.count === 0 ? 'All students have had a recent PTM!' : 'No students match the filter.'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {overdueFiltered.map(student => (
              <div key={student.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{student.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {student.teacher_name && <span className="text-xs text-slate-500">{student.teacher_name}</span>}
                      {student.instrument_name && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{student.instrument_name}</span>
                      )}
                    </div>
                    <div className="text-xs text-amber-600 mt-0.5">
                      {student.last_ptm_date ? `Last PTM: ${formatDate(student.last_ptm_date)}` : 'No PTM on record'}
                    </div>
                  </div>
                  <button
                    onClick={() => setSchedulingFor(schedulingFor === student.id ? null : student.id)}
                    className="text-xs bg-orange-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-orange-700 flex-shrink-0"
                  >
                    Schedule
                  </button>
                </div>

                {schedulingFor === student.id && (
                  <div className="mt-2.5 flex gap-2">
                    <select
                      className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                      value={selectedSession[student.id] || ''}
                      onChange={e => setSelectedSession(prev => ({ ...prev, [student.id]: e.target.value }))}
                    >
                      <option value="">Select session...</option>
                      {sessions.length === 0 && (
                        <option disabled>No open sessions — create one first</option>
                      )}
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.title} — {formatDate(s.scheduled_date)}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleSchedule(student.id, student.teacher_id)}
                      disabled={!selectedSession[student.id] || scheduling === student.id || !student.teacher_id}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-40 whitespace-nowrap"
                    >
                      {scheduling === student.id ? '...' : 'Add'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
