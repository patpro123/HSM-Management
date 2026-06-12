import { useState, useEffect } from 'react';
import { PTMAppointment, PTMActionItem } from '../types';
import { apiPut, apiPost, apiDelete, apiGet } from '../api';
import PTMNotifyModal from './PTMNotifyModal';
import PTMMOMModal from './PTMMOMModal';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-slate-100 text-slate-500' },
  { value: 'no_show', label: 'No Show', color: 'bg-red-100 text-red-600' },
];

const ASSIGNED_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'student', label: 'Student' },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color ?? 'bg-slate-100 text-slate-600';
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function localDatetimeValue(dt: string | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ActionItemRowProps {
  item: PTMActionItem;
  onToggle: (id: string, status: 'open' | 'done') => void;
  onDelete: (id: string) => void;
}

function ActionItemRow({ item, onToggle, onDelete }: ActionItemRowProps) {
  const isDone = item.status === 'done';
  return (
    <div className="flex items-start gap-2 group py-1">
      <button
        onClick={() => onToggle(item.id, isDone ? 'open' : 'done')}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isDone ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-400'}`}
      >
        {isDone && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.action_text}</span>
        <span className="ml-2 text-xs text-slate-400">{ASSIGNED_OPTIONS.find(o => o.value === item.assigned_to)?.label}</span>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface PTMAppointmentCardProps {
  appointment: PTMAppointment;
  onChange: (updated: PTMAppointment) => void;
  onRemove: (id: string) => void;
  sessionTitle?: string;
  sessionDate?: string;
}

export default function PTMAppointmentCard({ appointment: initial, onChange, onRemove, sessionTitle, sessionDate }: PTMAppointmentCardProps) {
  const [appt, setAppt] = useState<PTMAppointment>(initial);
  const [showNotify, setShowNotify] = useState(false);
  const [showMOM, setShowMOM] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(initial.notes || '');
  const [newAction, setNewAction] = useState('');
  const [newAssignee, setNewAssignee] = useState<'parent' | 'teacher' | 'admin' | 'student'>('parent');
  const [savingNotes, setSavingNotes] = useState(false);
  const [carryForwards, setCarryForwards] = useState<PTMAppointment[] | null>(null);
  const [carryForwardsLoaded, setCarryForwardsLoaded] = useState(false);

  useEffect(() => {
    if (expanded && !carryForwardsLoaded) {
      setCarryForwardsLoaded(true);
      apiGet(`/api/ptm/appointments/${initial.id}/carry-forwards`)
        .then(res => setCarryForwards(res.carry_forwards || []))
        .catch(() => setCarryForwards([]));
    }
  }, [expanded, carryForwardsLoaded, initial.id]);

  const update = (patch: Partial<PTMAppointment>) => {
    const updated = { ...appt, ...patch };
    setAppt(updated);
    onChange(updated);
  };

  const handleStatusChange = async (status: string) => {
    const completedAt = status === 'completed' ? new Date().toISOString() : undefined;
    try {
      const res = await apiPut(`/api/ptm/appointments/${appt.id}`, { status, completed_at: completedAt });
      update({ status: res.appointment.status, completed_at: res.appointment.completed_at });
    } catch { /* ignore */ }
  };

  const handleTimeChange = async (value: string) => {
    const scheduled_time = value ? new Date(value).toISOString() : null;
    try {
      const res = await apiPut(`/api/ptm/appointments/${appt.id}`, { scheduled_time });
      update({ scheduled_time: res.appointment.scheduled_time });
    } catch { /* ignore */ }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await apiPut(`/api/ptm/appointments/${appt.id}`, { notes });
      update({ notes: res.appointment.notes });
    } catch { /* ignore */ }
    finally { setSavingNotes(false); }
  };

  const handleAddAction = async () => {
    if (!newAction.trim()) return;
    try {
      const res = await apiPost(`/api/ptm/appointments/${appt.id}/actions`, {
        action_text: newAction.trim(),
        assigned_to: newAssignee,
      });
      update({ action_items: [...(appt.action_items || []), res.action_item] });
      setNewAction('');
    } catch { /* ignore */ }
  };

  const handleToggleAction = async (id: string, status: 'open' | 'done') => {
    try {
      const res = await apiPut(`/api/ptm/actions/${id}`, { status });
      update({ action_items: (appt.action_items || []).map(ai => ai.id === id ? res.action_item : ai) });
    } catch { /* ignore */ }
  };

  const handleDeleteAction = async (id: string) => {
    try {
      await apiDelete(`/api/ptm/actions/${id}`);
      update({ action_items: (appt.action_items || []).filter(ai => ai.id !== id) });
    } catch { /* ignore */ }
  };

  const openActions = (appt.action_items || []).filter(ai => ai.status === 'open').length;
  const doneActions = (appt.action_items || []).filter(ai => ai.status === 'done').length;

  return (
    <div className={`bg-white rounded-xl border ${appt.status === 'completed' ? 'border-green-200' : 'border-slate-200'} shadow-sm`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{appt.student_name || '—'}</span>
            {appt.instrument_name && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{appt.instrument_name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">{appt.teacher_name}</span>
            {appt.scheduled_time && (
              <span className="text-xs text-slate-400">{formatTime(appt.scheduled_time)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {openActions > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {openActions} open
            </span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(appt.status)}`}>
            {STATUS_OPTIONS.find(o => o.value === appt.status)?.label}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Carry-forwards from previous PTMs */}
          {carryForwards && carryForwards.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">From previous PTMs</p>
              <div className="space-y-3">
                {carryForwards.map(cf => (
                  <div key={cf.id} className="text-xs">
                    <div className="font-medium text-amber-700">
                      {cf.session_title}{cf.scheduled_date ? ` — ${formatDate(cf.scheduled_date)}` : ''}
                    </div>
                    {cf.notes && <p className="text-amber-700 mt-0.5 italic">{cf.notes}</p>}
                    {(cf.action_items || []).length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {(cf.action_items || []).map(ai => (
                          <li key={ai.id} className={`flex items-start gap-1 ${ai.status === 'done' ? 'text-slate-400 line-through' : 'text-amber-800'}`}>
                            <span className="mt-0.5 flex-shrink-0">•</span>
                            <span>[{ai.assigned_to}] {ai.action_text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-3">
            <div>
              <span className="text-slate-400 block">Parent/Guardian</span>
              <span className="font-medium">{appt.guardian_name || '—'}</span>
              {(appt.guardian_phone || appt.guardian_contact) && (
                <span className="block text-slate-500">{appt.guardian_phone || appt.guardian_contact}</span>
              )}
            </div>
            <div>
              <span className="text-slate-400 block">Teacher</span>
              <span className="font-medium">{appt.teacher_name || '—'}</span>
              {appt.teacher_phone && <span className="block text-slate-500">{appt.teacher_phone}</span>}
            </div>
          </div>

          {/* Time + Status row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Time Slot</label>
              <input
                type="datetime-local"
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                value={localDatetimeValue(appt.scheduled_time)}
                onChange={e => handleTimeChange(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                value={appt.status}
                onChange={e => handleStatusChange(e.target.value)}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* WhatsApp buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowNotify(true)}
              className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp Invite
            </button>
            <button
              onClick={() => setShowMOM(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Share MOM
            </button>
            {appt.parent_notified_at && (
              <span className="text-xs text-slate-400 self-center">Parent notified {new Date(appt.parent_notified_at).toLocaleDateString('en-IN')}</span>
            )}
            {appt.teacher_notified_at && (
              <span className="text-xs text-slate-400 self-center">Teacher notified {new Date(appt.teacher_notified_at).toLocaleDateString('en-IN')}</span>
            )}
            <button
              onClick={() => { if (window.confirm('Remove this appointment?')) onRemove(appt.id); }}
              className="ml-auto text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded border border-red-100 hover:border-red-300"
            >
              Remove
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Meeting Notes</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              rows={3}
              placeholder="Capture what was discussed..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
            />
            {savingNotes && <p className="text-xs text-slate-400 mt-0.5">Saving...</p>}
          </div>

          {/* Action items */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Action Items
              {doneActions > 0 && <span className="ml-2 text-slate-400">({doneActions} done)</span>}
            </label>
            <div className="space-y-0.5 mb-2">
              {(appt.action_items || []).map(ai => (
                <ActionItemRow
                  key={ai.id}
                  item={ai}
                  onToggle={handleToggleAction}
                  onDelete={handleDeleteAction}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Add action item..."
                value={newAction}
                onChange={e => setNewAction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddAction()}
              />
              <select
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value as any)}
              >
                {ASSIGNED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={handleAddAction}
                disabled={!newAction.trim()}
                className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotify && (
        <PTMNotifyModal
          appointment={appt}
          onClose={() => setShowNotify(false)}
          onNotified={updated => { update(updated); setShowNotify(false); }}
        />
      )}

      {showMOM && (
        <PTMMOMModal
          appointment={appt}
          sessionTitle={sessionTitle}
          sessionDate={sessionDate}
          onClose={() => setShowMOM(false)}
        />
      )}
    </div>
  );
}
