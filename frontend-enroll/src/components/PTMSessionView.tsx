import { useState, useEffect } from 'react';
import { PTMSession, PTMAppointment } from '../types';
import { apiGet, apiPost, apiDelete, apiPut } from '../api';
import PTMAppointmentCard from './PTMAppointmentCard';
import PTMAddStudentsModal from './PTMAddStudentsModal';

const SESSION_STATUS_OPTIONS = ['draft', 'scheduled', 'completed'];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

interface PTMSessionViewProps {
  sessionId: string;
  onBack: () => void;
  onSessionUpdate: (session: PTMSession) => void;
}

export default function PTMSessionView({ sessionId, onBack, onSessionUpdate }: PTMSessionViewProps) {
  const [session, setSession] = useState<PTMSession | null>(null);
  const [appointments, setAppointments] = useState<PTMAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [notifyingAll, setNotifyingAll] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [applyingBulkTime, setApplyingBulkTime] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/ptm/sessions/${sessionId}`);
      setSession(res.session);
      setTitleDraft(res.session.title);
      setAppointments(res.appointments || []);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async (selections: { student_id: string; teacher_id: string }[]) => {
    await apiPost(`/api/ptm/sessions/${sessionId}/appointments/bulk`, { appointments: selections });
    await loadSession();
  };

  const handleBulkTime = async () => {
    if (!bulkTime || !visible.length) return;
    setApplyingBulkTime(true);
    try {
      await Promise.all(visible.map(a =>
        apiPut(`/api/ptm/appointments/${a.id}`, { scheduled_time: new Date(bulkTime).toISOString() })
      ));
      await loadSession();
      setBulkTime('');
    } finally {
      setApplyingBulkTime(false);
    }
  };

  const handleAppointmentChange = (updated: PTMAppointment) => {
    setAppointments(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
  };

  const handleAppointmentRemove = async (id: string) => {
    try {
      await apiDelete(`/api/ptm/appointments/${id}`);
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (status: string) => {
    if (!session) return;
    try {
      const res = await apiPut(`/api/ptm/sessions/${sessionId}`, { status });
      setSession(res.session);
      onSessionUpdate(res.session);
    } catch { /* ignore */ }
  };

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || !session) return;
    try {
      const res = await apiPut(`/api/ptm/sessions/${sessionId}`, { title: titleDraft.trim() });
      setSession(res.session);
      onSessionUpdate(res.session);
    } finally {
      setEditingTitle(false);
    }
  };

  const handleNotifyAll = async () => {
    if (!window.confirm('This will mark all scheduled appointments as "both notified". WhatsApp messages must still be sent individually per appointment. Continue?')) return;
    setNotifyingAll(true);
    try {
      await apiPost(`/api/ptm/sessions/${sessionId}/notify-all`, { recipients: 'both' });
      await loadSession();
    } finally {
      setNotifyingAll(false);
    }
  };

  const uniqueTeachers = [...new Map(appointments.map(a => [a.teacher_id, a.teacher_name])).entries()]
    .map(([id, name]) => ({ id, name }));

  const visible = appointments.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterTeacher && a.teacher_id !== filterTeacher) return false;
    return true;
  });

  const total = appointments.length;
  const completed = appointments.filter(a => a.status === 'completed').length;

  if (loading) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to sessions
        </button>
        <p className="text-slate-400 text-center py-16">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Back + Header */}
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        All PTM Sessions
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-400 flex-1"
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  autoFocus
                />
                <button onClick={handleSaveTitle} className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg">Save</button>
                <button onClick={() => setEditingTitle(false)} className="text-xs text-slate-500 px-2">Cancel</button>
              </div>
            ) : (
              <h1
                className="text-xl font-bold text-slate-800 cursor-pointer hover:text-orange-600 flex items-center gap-2"
                onClick={() => setEditingTitle(true)}
                title="Click to edit"
              >
                {session.title}
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </h1>
            )}
            <p className="text-slate-500 text-sm mt-0.5">{formatDate(session.scheduled_date)}</p>
            {session.description && <p className="text-slate-600 text-sm mt-1">{session.description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              value={session.status}
              onChange={e => handleStatusChange(e.target.value)}
            >
              {SESSION_STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{completed} of {total} appointments completed</span>
            <span>{total ? Math.round((completed / total) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: total ? `${(completed / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => setShowAddStudents(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Students
        </button>
        <button
          onClick={handleNotifyAll}
          disabled={notifyingAll || total === 0}
          className="border border-green-300 text-green-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 disabled:opacity-40 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Mark All Notified
        </button>

        {/* Filters */}
        <div className="ml-auto flex gap-2">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
          >
            <option value="">All Teachers</option>
            {uniqueTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Bulk time setter */}
      {appointments.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 mb-4">
          <span className="text-sm font-medium text-amber-800 whitespace-nowrap">Common slot:</span>
          <input
            type="datetime-local"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white flex-1 min-w-[180px]"
            value={bulkTime}
            onChange={e => setBulkTime(e.target.value)}
          />
          <button
            onClick={handleBulkTime}
            disabled={!bulkTime || !visible.length || applyingBulkTime}
            className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 whitespace-nowrap"
          >
            {applyingBulkTime ? 'Applying...' : `Apply to ${visible.length} student${visible.length !== 1 ? 's' : ''}`}
          </button>
          {bulkTime && (
            <button onClick={() => setBulkTime('')} className="text-slate-400 hover:text-slate-600 text-xs">clear</button>
          )}
        </div>
      )}

      {/* Appointments */}
      {visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500 font-medium">{total === 0 ? 'No students added yet' : 'No appointments match filter'}</p>
          {total === 0 && (
            <button onClick={() => setShowAddStudents(true)} className="mt-4 bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700">
              Add Students
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(appt => (
            <PTMAppointmentCard
              key={appt.id}
              appointment={appt}
              onChange={handleAppointmentChange}
              onRemove={handleAppointmentRemove}
            />
          ))}
        </div>
      )}

      {showAddStudents && (
        <PTMAddStudentsModal
          sessionId={sessionId}
          existingStudentIds={appointments.map(a => a.student_id)}
          onClose={() => setShowAddStudents(false)}
          onAdd={handleBulkAdd}
        />
      )}
    </div>
  );
}
