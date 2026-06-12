import { useState } from 'react';
import { PTMAppointment } from '../types';

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface PTMMOMModalProps {
  appointment: PTMAppointment;
  sessionTitle?: string;
  sessionDate?: string;
  onClose: () => void;
}

export default function PTMMOMModal({ appointment, sessionTitle, sessionDate, onClose }: PTMMOMModalProps) {
  const [copied, setCopied] = useState(false);

  const studentName = appointment.student_name || 'Student';
  const session = sessionTitle || appointment.session_title || '—';
  const date = sessionDate || appointment.scheduled_date || '';
  const time = appointment.scheduled_time ? formatTime(appointment.scheduled_time) : '';
  const actionItems = appointment.action_items || [];

  const guardianPhone = appointment.guardian_phone || appointment.guardian_contact || appointment.student_phone;
  const guardianEmail = appointment.guardian_email;

  const momLines = [
    `PTM Summary — ${studentName}`,
    '',
    `Session: ${session}`,
    date ? `Date: ${formatDate(date)}` : null,
    time ? `Time: ${time}` : null,
    `Teacher: ${appointment.teacher_name || '—'}`,
    `Instrument: ${appointment.instrument_name || '—'}`,
  ];

  if (appointment.notes) {
    momLines.push('', `Notes:`, appointment.notes);
  }

  if (actionItems.length > 0) {
    momLines.push('', 'Action Items:');
    actionItems.forEach((ai, i) => {
      momLines.push(`${i + 1}. [${ai.assigned_to}] ${ai.action_text}${ai.status === 'done' ? ' ✓' : ''}`);
    });
  }

  momLines.push('', '— HSM Team');

  const momText = momLines.filter(l => l !== null).join('\n').trim();

  const waPhone = guardianPhone ? toE164(guardianPhone) : '';
  const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(momText)}` : null;
  const emailLink = guardianEmail
    ? `mailto:${guardianEmail}?subject=${encodeURIComponent(`PTM Summary — ${studentName}`)}&body=${encodeURIComponent(momText)}`
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(momText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Share Meeting Summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Minutes of Meeting</label>
            <pre className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
              {momText}
            </pre>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => waLink && window.open(waLink, '_blank')}
              disabled={!waLink}
              className="w-full flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <div className="text-left flex-1">
                <div>Send on WhatsApp</div>
                <div className="text-xs font-normal opacity-80">
                  {guardianPhone || 'No phone number on record'}
                </div>
              </div>
            </button>

            <button
              onClick={() => emailLink && window.open(emailLink, '_blank')}
              disabled={!emailLink}
              className="w-full flex items-center gap-3 bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-left flex-1">
                <div>Send via Email</div>
                <div className="text-xs font-normal opacity-80">
                  {guardianEmail || 'No email on record'}
                </div>
              </div>
            </button>

            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 border border-slate-300 text-slate-700 px-4 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50"
            >
              <svg className="w-5 h-5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copied ? '✓ Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
