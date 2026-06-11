import { useState } from 'react';
import { PTMAppointment } from '../types';
import { apiPost } from '../api';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildWaLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function parentMessage(appt: PTMAppointment): string {
  const guardianName = appt.guardian_name || 'Parent';
  const date = appt.scheduled_time
    ? new Date(appt.scheduled_time).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : (appt.scheduled_date ? new Date(appt.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD');
  const time = appt.scheduled_time
    ? new Date(appt.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  return `Hi ${guardianName}! 🙏

You are invited for a Parent-Teacher Meeting at Hyderabad School of Music.

📆 Date: ${date}
⏰ Time: ${time}
👩‍🏫 Teacher: ${appt.teacher_name || 'Your teacher'}
🎵 Instrument: ${appt.instrument_name || 'Music'}

Please confirm your availability. We look forward to discussing ${appt.student_name || 'your child'}'s progress with you.
— HSM Team`;
}

function teacherMessage(appt: PTMAppointment): string {
  const date = appt.scheduled_time
    ? new Date(appt.scheduled_time).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : (appt.scheduled_date ? new Date(appt.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD');
  const time = appt.scheduled_time
    ? new Date(appt.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  return `Hi ${appt.teacher_name || 'Teacher'}!

PTM scheduled with ${appt.student_name || 'a student'}'s parent.

📆 Date: ${date}
⏰ Time: ${time}
🎵 Instrument: ${appt.instrument_name || 'Music'}
👨‍👩‍👧 Student: ${appt.student_name || ''}

Please be available for this meeting.
— HSM Admin`;
}

type Recipient = 'parent' | 'teacher' | 'both';

interface PTMNotifyModalProps {
  appointment: PTMAppointment;
  onClose: () => void;
  onNotified: (updated: PTMAppointment) => void;
}

export default function PTMNotifyModal({ appointment, onClose, onNotified }: PTMNotifyModalProps) {
  const [recipient, setRecipient] = useState<Recipient>('both');
  const [parentMsg, setParentMsg] = useState(parentMessage(appointment));
  const [teacherMsg, setTeacherMsg] = useState(teacherMessage(appointment));
  const [sending, setSending] = useState(false);

  const parentPhone = appointment.guardian_phone || appointment.guardian_contact || appointment.student_phone || '';
  const teacherPhone = appointment.teacher_phone || '';

  const handleSend = async () => {
    setSending(true);
    try {
      if (recipient === 'parent' || recipient === 'both') {
        if (parentPhone) window.open(buildWaLink(parentPhone, parentMsg), '_blank');
      }
      if (recipient === 'teacher' || recipient === 'both') {
        if (teacherPhone) window.open(buildWaLink(teacherPhone, teacherMsg), '_blank');
      }
      const res = await apiPost(`/api/ptm/appointments/${appointment.id}/notify`, { recipients: recipient });
      onNotified(res.appointment);
      onClose();
    } finally {
      setSending(false);
    }
  };

  const recipientButtons: { key: Recipient; label: string }[] = [
    { key: 'parent', label: 'Parent only' },
    { key: 'teacher', label: 'Teacher only' },
    { key: 'both', label: 'Both' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Send WhatsApp Invite</h2>
            <p className="text-slate-500 text-sm">{appointment.student_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Send to</p>
            <div className="flex gap-2">
              {recipientButtons.map(b => (
                <button
                  key={b.key}
                  onClick={() => setRecipient(b.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${recipient === b.key ? 'bg-green-600 text-white border-green-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {(recipient === 'parent' || recipient === 'both') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-700">Message to Parent</p>
                {parentPhone
                  ? <span className="text-xs text-green-600 font-medium">{parentPhone}</span>
                  : <span className="text-xs text-red-500 font-medium">No phone on record</span>
                }
              </div>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={8}
                value={parentMsg}
                onChange={e => setParentMsg(e.target.value)}
              />
            </div>
          )}

          {(recipient === 'teacher' || recipient === 'both') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-700">Message to Teacher</p>
                {teacherPhone
                  ? <span className="text-xs text-green-600 font-medium">{teacherPhone}</span>
                  : <span className="text-xs text-red-500 font-medium">No phone on record</span>
                }
              </div>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={7}
                value={teacherMsg}
                onChange={e => setTeacherMsg(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {sending ? 'Opening...' : 'Open WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
