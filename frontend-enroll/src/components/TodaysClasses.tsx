import React, { useMemo, useState } from 'react';
import { Student, Batch } from '../types';
import PhoneLink from './PhoneLink';

interface TodaysClassesProps {
  students: Student[];
  batches: Batch[];
}

const formatTime = (t: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

const buildBatchMessage = (batch: Batch, studentNames: string[]): string => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });
  const instrument = batch.instrument_name || 'Music';
  const teacher = batch.teacher_name || 'Teacher';
  const timeStr = `${formatTime(batch.start_time)} – ${formatTime(batch.end_time)}`;

  const MAX_NAMES = 15;
  const displayNames = studentNames.slice(0, MAX_NAMES);
  const extra = studentNames.length - MAX_NAMES;
  const nameList = displayNames.map(n => `• ${n}`).join('\n');
  const overflow = extra > 0 ? `\n• ...and ${extra} more` : '';

  return (
    `🎵 *HSM Class Reminder*\n` +
    `${instrument} class today — ${dateStr}\n` +
    `Time: ${timeStr}\n` +
    `Teacher: ${teacher}\n\n` +
    `Students attending:\n${nameList}${overflow}\n\n` +
    `See you there! 🎶\n— HSM Team`
  );
};

interface NotifyModalProps {
  batch: Batch;
  students: Student[];
  onClose: () => void;
}

function NotifyModal({ batch, students, onClose }: NotifyModalProps) {
  const studentNames = students
    .map(s => s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim())
    .filter(Boolean);
  const [message, setMessage] = useState(() => buildBatchMessage(batch, studentNames));
  const [copied, setCopied] = useState(false);

  const groupLink = batch.whatsapp_group_link;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyAndOpen = async () => {
    await copyToClipboard();
    window.open(groupLink, '_blank');
  };

  const handleShareViaWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            Notify — {batch.instrument_name}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none font-bold"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Message Preview
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={12}
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none font-mono leading-relaxed"
          />
          <p className="text-xs text-slate-400 mt-1">
            Edit the message above if needed before sending.
          </p>
        </div>

        <div className="space-y-2">
          {groupLink ? (
            <button
              onClick={handleCopyAndOpen}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 active:bg-green-800 transition text-sm"
            >
              <span>{copied ? '✓' : '📋'}</span>
              {copied ? 'Copied! Opening group…' : 'Copy & Open Group'}
            </button>
          ) : (
            <>
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-800 transition text-sm"
              >
                <span>{copied ? '✓' : '📋'}</span>
                {copied ? 'Copied to clipboard!' : 'Copy Message'}
              </button>
              <button
                onClick={handleShareViaWhatsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition text-sm"
              >
                Open WhatsApp (pick group manually)
              </button>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No WhatsApp group link saved for this batch. Go to Batch Settings to add one and enable one-tap group open.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const TodaysClasses: React.FC<TodaysClassesProps> = ({ students, batches }) => {
  const today = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayOfWeek = days[today.getDay()];
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [notifyModal, setNotifyModal] = useState<{ batch: Batch; students: Student[] } | null>(null);

  const todaysBatches = useMemo(() => {
    return batches
      .filter(batch => batch.recurrence && batch.recurrence.toUpperCase().includes(dayOfWeek))
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [batches, dayOfWeek]);

  const getStudentsForBatch = (batchId: string) => {
    return students.filter(student =>
      (student as any).batches?.some((b: any) => String(b.batch_id) === String(batchId))
    );
  };

  const openNotifyModal = (batch: Batch) => {
    setNotifyModal({ batch, students: getStudentsForBatch(String(batch.id)) });
  };

  const buildStudentWhatsAppUrl = (student: Student, batch: Batch) => {
    const phone = (student.phone || student.guardian_contact || '').replace(/\D/g, '');
    if (!phone) return null;
    const timeStr = `${formatTime(batch.start_time)} – ${formatTime(batch.end_time)}`;
    const name = student.name || student.first_name || 'your child';
    const msg = `Hi! Reminder that ${name} has ${batch.instrument_name || 'Music'} class today at HSM from ${timeStr}. See you there! 🎵`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Classes for {dateStr}</h3>
          <p className="text-slate-500 text-sm">View students scheduled for today's batches</p>
        </div>
        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          {todaysBatches.length} Batches Scheduled
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {todaysBatches.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
            <p className="text-slate-500">No classes scheduled for today ({dayOfWeek}).</p>
          </div>
        ) : (
          todaysBatches.map(batch => {
            const batchStudents = getStudentsForBatch(String(batch.id));
            const hasGroupLink = !!batch.whatsapp_group_link;
            return (
              <div key={batch.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800">{batch.instrument_name || 'Instrument'}</h4>
                    <p className="text-sm text-slate-600">
                      {batch.recurrence} • {batch.start_time} - {batch.end_time} • {batch.teacher_name || 'No Teacher'}
                    </p>
                  </div>
                  <button
                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    onClick={() => openNotifyModal(batch)}
                  >
                    <span>📱</span>
                    {hasGroupLink ? 'Notify Group' : 'Notify Batch'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Guardian</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {batchStudents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-slate-400 text-sm">
                            No students enrolled in this batch.
                          </td>
                        </tr>
                      ) : (
                        batchStudents.map(student => {
                          const waUrl = buildStudentWhatsAppUrl(student, batch);
                          return (
                            <tr key={student.id} className="hover:bg-slate-50">
                              <td className="px-6 py-3 font-medium text-slate-800">{student.name}</td>
                              <td className="px-6 py-3 text-slate-600 text-sm">
                                <PhoneLink phone={student.phone} />
                              </td>
                              <td className="px-6 py-3 text-slate-600 text-sm">
                                <PhoneLink phone={student.guardian_contact} />
                              </td>
                              <td className="px-6 py-3 text-right">
                                {waUrl ? (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-800 text-xs font-bold uppercase"
                                  >
                                    WhatsApp
                                  </a>
                                ) : (
                                  <span className="text-slate-300 text-xs">No phone</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {notifyModal && (
        <NotifyModal
          batch={notifyModal.batch}
          students={notifyModal.students}
          onClose={() => setNotifyModal(null)}
        />
      )}
    </div>
  );
};

export default TodaysClasses;
