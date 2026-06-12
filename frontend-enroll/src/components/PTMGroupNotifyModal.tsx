import { useState } from 'react';
import { PTMAppointment } from '../types';

interface Props {
  sessionTitle: string;
  sessionDate: string;
  appointments: PTMAppointment[];
  onClose: () => void;
}

function buildMessage(title: string, date: string, appts: PTMAppointment[]): string {
  const dateStr = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const active = appts
    .filter(a => a.status !== 'cancelled' && a.status !== 'no_show')
    .sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
    });

  const lines = active.map(a => {
    const time = a.scheduled_time
      ? new Date(a.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : 'TBD';
    const instr = a.instrument_name ? ` (${a.instrument_name})` : '';
    return `• ${a.student_name} — ${time}${instr}`;
  }).join('\n');

  return `Dear Parents 🙏\n\n*${title}* is scheduled at Hyderabad School of Music on *${dateStr}*.\n\nPlease note your timings:\n${lines}\n\nKindly be present 5 minutes before your slot. Please confirm your attendance by replying here.\n\n— HSM Team`;
}

const WA_ICON = (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function PTMGroupNotifyModal({ sessionTitle, sessionDate, appointments, onClose }: Props) {
  const [msg, setMsg] = useState(() => buildMessage(sessionTitle, sessionDate, appointments));
  const [copied, setCopied] = useState(false);

  const active = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Group Announcement</h2>
            <p className="text-xs text-slate-500 mt-0.5">{active} students · WhatsApp opens for you to choose recipients</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <textarea
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none font-mono leading-relaxed"
            rows={14}
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 border rounded-lg py-2.5 text-sm font-semibold transition-colors ${copied ? 'border-green-400 text-green-700 bg-green-50' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            {copied ? '✓ Copied!' : 'Copy Text'}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
          >
            {WA_ICON}
            Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
