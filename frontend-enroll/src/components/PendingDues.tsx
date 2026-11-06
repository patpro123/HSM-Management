import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';

interface DueInstrument {
  instrument: string;
  allowance: number;
  used: number;
  classes_remaining: number;
  overdue_classes: number;
  last_paid_on: string | null;
  pending_amount: number;
}

interface DueStudent {
  student_id: string;
  name: string;
  min_remaining: number;
  instruments: DueInstrument[];
  to: string | null;
  text: string;
  link: string;
}

const LIMITS = [0, 1, 2, 3, 4, 5];

// Students whose paid classes are nearly or fully used up, each with a one-tap WhatsApp reminder.
// The message is sent from the user's own WhatsApp; tapping the button also writes an audit row.
const PendingDues: React.FC = () => {
  const [maxRemaining, setMaxRemaining] = useState(5);
  const [students, setStudents] = useState<DueStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiGet(`/api/payments/dues?max_remaining=${maxRemaining}`)
      .then(d => { if (!cancelled) setStudents(d.students || []); })
      .catch(() => { if (!cancelled) setError('Could not load pending payments.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [maxRemaining]);

  const onSend = (s: DueStudent) => {
    setSent(prev => new Set(prev).add(s.student_id));
    apiPost('/api/whatsapp/initiated', {
      student_id: s.student_id, kind: 'payment_followup', text: s.text, phone: s.to,
    }).catch(() => { /* audit row is best effort; WhatsApp still opens */ });
  };

  const leftLabel = (i: DueInstrument) =>
    i.overdue_classes > 0 ? `${i.overdue_classes} over` : `${i.classes_remaining} left`;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Pending payments</p>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${students.length} student${students.length === 1 ? '' : 's'} with ${maxRemaining} or fewer classes left`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Classes left up to
          <select
            value={maxRemaining}
            onChange={e => setMaxRemaining(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
          >
            {LIMITS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Student</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Stream</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Classes</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Amount due</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Remind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {!loading && students.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">No students are running low on classes.</td></tr>
              ) : students.map(s => (
                <tr key={s.student_id} className="hover:bg-slate-50 transition align-top">
                  <td className="px-6 py-4 font-semibold text-slate-900">{s.name}</td>
                  <td className="px-6 py-4 space-y-0.5">
                    {s.instruments.map(i => <span key={i.instrument} className="block text-sm text-slate-800">{i.instrument}</span>)}
                  </td>
                  <td className="px-6 py-4 space-y-0.5">
                    {s.instruments.map(i => (
                      <span key={i.instrument} className={`block text-sm font-semibold ${i.classes_remaining === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {i.last_paid_on ? `${i.used}/${i.allowance} used · ${leftLabel(i)}` : `No payment on record · ${i.used} attended`}
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4 space-y-0.5">
                    {s.instruments.map(i => (
                      <span key={i.instrument} className="block text-sm text-slate-700">
                        {i.pending_amount ? `₹${i.pending_amount.toLocaleString('en-IN')}` : '-'}
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onSend(s)}
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-[#25D366] text-white text-sm font-bold hover:opacity-90 transition whitespace-nowrap"
                    >
                      {sent.has(s.student_id) ? 'Open again' : 'WhatsApp'}
                    </a>
                    <p className="text-xs text-slate-400 mt-1">{s.to ? `+${s.to}` : 'No number: pick contact'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PendingDues;
