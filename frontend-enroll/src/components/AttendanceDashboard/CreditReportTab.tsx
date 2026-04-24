import React from 'react';
import { Batch, CreditReport } from '../../types';

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const calcTentativeDate = (credits: number): Date | null => {
  if (credits <= 0) return null;
  const daysLeft = Math.ceil(credits * 3.5); // 2 classes per week = 3.5 days per class
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  return d;
};

const buildWhatsAppMessage = (r: CreditReport): string => {
  const creditsLine =
    Object.keys(r.instrument_credits).length > 1
      ? Object.entries(r.instrument_credits)
        .map(([inst, n]) => `${inst} - ${n} class${n !== 1 ? 'es' : ''}`)
        .join(', ')
      : `${r.credits_remaining} class${r.credits_remaining !== 1 ? 'es' : ''}`;

  const tentativeDate = calcTentativeDate(r.credits_remaining);
  const nextPaymentLine = tentativeDate
    ? formatDate(tentativeDate.toISOString())
    : 'Due immediately (Credits exhausted)';

  return (
    `Hi! Sharing a quick update on ${r.student_name}'s music classes at Hyderabad School of Music.\n\n` +
    `Classes attended this cycle: ${r.classes_attended}\n` +
    `Classes missed: ${r.classes_missed}\n` +
    `Credits purchased: ${r.total_credits_bought} class${r.total_credits_bought !== 1 ? 'es' : ''}${r.last_credit_date ? ` (paid on ${formatDate(r.last_credit_date)})` : ''}\n` +
    `Credits remaining: ${creditsLine}\n` +
    `Tentative Next Payment Date: ${nextPaymentLine}\n\n` +
    `Feel free to reach out if you have any questions. Looking forward to seeing ${r.student_name} at class!\n\n` +
    `- HSM Team`
  );
};

const openWhatsApp = (r: CreditReport) => {
  const phone = r.phone;
  if (!phone) {
    alert(`No phone number on record for ${r.student_name}`);
    return;
  }
  const url = `https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(buildWhatsAppMessage(r))}`;
  window.open(url, '_blank');
};

interface CreditReportTabProps {
  batches: Batch[];
  crAllStudents: { student_id: string; student_name: string }[];
  crSelectedIds: Set<string>;
  crNameFilter: string;
  setCrNameFilter: (v: string) => void;
  crTeacherFilter: string;
  crInstrumentFilter: string;
  crTeachers: string[];
  crInstruments: string[];
  crFilteredStudents: { student_id: string; student_name: string }[];
  crReports: CreditReport[];
  crLoading: boolean;
  handleCrTeacherFilter: (teacher: string) => void;
  handleCrInstrumentFilter: (instrument: string) => void;
  toggleCrStudent: (id: string) => void;
  toggleSelectAll: () => void;
  handleLoadReport: () => void;
  handleMessageAll: () => void;
  setCrTeacherFilter: (v: string) => void;
  setCrInstrumentFilter: (v: string) => void;
}

const CreditReportTab: React.FC<CreditReportTabProps> = ({
  crAllStudents,
  crSelectedIds,
  crNameFilter,
  setCrNameFilter,
  crTeacherFilter,
  crInstrumentFilter,
  crTeachers,
  crInstruments,
  crFilteredStudents,
  crReports,
  crLoading,
  handleCrTeacherFilter,
  handleCrInstrumentFilter,
  toggleCrStudent,
  toggleSelectAll,
  handleLoadReport,
  handleMessageAll,
  setCrTeacherFilter,
  setCrInstrumentFilter,
}) => {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Find students</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Search by name</label>
            <input
              type="text"
              value={crNameFilter}
              onChange={(e) => { setCrNameFilter(e.target.value); setCrTeacherFilter(''); setCrInstrumentFilter(''); }}
              placeholder="Type a student name..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Filter by teacher</label>
            <select
              value={crTeacherFilter}
              onChange={(e) => handleCrTeacherFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
            >
              <option value="">-- All teachers --</option>
              {crTeachers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Filter by instrument</label>
            <select
              value={crInstrumentFilter}
              onChange={(e) => handleCrInstrumentFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
            >
              <option value="">-- All instruments --</option>
              {crInstruments.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student checkbox list */}
      {crAllStudents.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading students...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={crFilteredStudents.length > 0 && crFilteredStudents.every(s => crSelectedIds.has(s.student_id))}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <span className="text-sm font-semibold text-slate-700">
                {crSelectedIds.size > 0 ? `${crSelectedIds.size} selected` : 'Select all'}
              </span>
            </label>
            <button
              onClick={handleLoadReport}
              disabled={crSelectedIds.size === 0 || crLoading}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {crLoading ? 'Loading...' : `Load Report (${crSelectedIds.size})`}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {crFilteredStudents.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">No students match the filter</div>
            ) : (
              crFilteredStudents.map(s => (
                <label key={s.student_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crSelectedIds.has(s.student_id)}
                    onChange={() => toggleCrStudent(s.student_id)}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="text-sm text-slate-800">{s.student_name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Results table */}
      {crLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-slate-600 text-sm">Fetching credit data...</p>
        </div>
      )}

      {!crLoading && crReports.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{crReports.length} student{crReports.length !== 1 ? 's' : ''}</p>
            <button
              onClick={handleMessageAll}
              className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
            >
              Message All on WhatsApp
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap">Student</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Attended</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Missed</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Credits Bought</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Last Paid</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap">Credits Left</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Next Payment</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {crReports.map(r => {
                  const creditsCell =
                    Object.keys(r.instrument_credits).length > 1
                      ? Object.entries(r.instrument_credits)
                        .map(([inst, n]) => `${inst}: ${n}`)
                        .join(' / ')
                      : String(r.credits_remaining);

                  return (
                    <tr key={r.student_id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{r.student_name}</td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-medium">{r.classes_attended}</td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">{r.classes_missed}</td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {r.total_credits_bought > 0 ? r.total_credits_bought : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">
                        {formatDate(r.last_credit_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{creditsCell}</td>
                      <td className={`px-4 py-3 text-center font-medium whitespace-nowrap ${r.credits_remaining <= 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {calcTentativeDate(r.credits_remaining) ? formatDate(calcTentativeDate(r.credits_remaining)!.toISOString()) : 'Immediately'}
                        {r.credits_remaining <= 0 && <span className="ml-1 text-xs">(overdue)</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openWhatsApp(r)}
                          title={r.phone ? `Send WhatsApp to ${r.phone}` : 'No phone number on record'}
                          disabled={!r.phone}
                          className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          WhatsApp
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditReportTab;
