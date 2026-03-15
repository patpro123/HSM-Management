import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../api';
import { Batch, AttendanceStatus, CreditReport } from '../types';

interface AttendanceDashboardProps {
  batches: Batch[];
  onRefresh: () => void;
}

interface BatchStudent {
  student_id: string;
  student_name: string;
  status: AttendanceStatus | null;
  phone: string | null;
  guardian_phone: string | null;
  guardian_contact: string | null;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildWhatsAppMessage = (r: CreditReport): string => {
  const creditsLine =
    Object.keys(r.instrument_credits).length > 1
      ? Object.entries(r.instrument_credits)
          .map(([inst, n]) => `${inst} - ${n} class${n !== 1 ? 'es' : ''}`)
          .join(', ')
      : `${r.credits_remaining} class${r.credits_remaining !== 1 ? 'es' : ''}`;

  const nextPaymentLine = r.next_payment_date
    ? formatDate(r.next_payment_date) + (r.is_overdue ? ' (overdue)' : '')
    : 'Not available';

  return (
    `Hi! Sharing a quick update on ${r.student_name}'s music classes at Hyderabad School of Music.\n\n` +
    `Classes attended this cycle: ${r.classes_attended}\n` +
    `Classes missed: ${r.classes_missed}\n` +
    `Credits purchased: ${r.total_credits_bought} class${r.total_credits_bought !== 1 ? 'es' : ''}${r.last_credit_date ? ` (paid on ${formatDate(r.last_credit_date)})` : ''}\n` +
    `Credits remaining: ${creditsLine}\n` +
    `Next payment due: ${nextPaymentLine}\n\n` +
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

const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({ batches, onRefresh }) => {
  // ── Sub-tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'mark' | 'credit-report'>('mark');

  // ── Mark Attendance state ─────────────────────────────────────────────────
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [guestStudents, setGuestStudents] = useState<BatchStudent[]>([]);
  const [extraSessions, setExtraSessions] = useState<Set<string>>(new Set());
  const savedExtraIds = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Student search state (for out-of-turn)
  const [studentSearch, setStudentSearch] = useState('');
  const [allStudents, setAllStudents] = useState<{ student_id: string; student_name: string }[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Credit Report state ───────────────────────────────────────────────────
  const [crAllStudents, setCrAllStudents] = useState<{ student_id: string; student_name: string }[]>([]);
  const [crSelectedIds, setCrSelectedIds] = useState<Set<string>>(new Set());
  const [crNameFilter, setCrNameFilter] = useState('');
  const [crTeacherFilter, setCrTeacherFilter] = useState('');
  const [crInstrumentFilter, setCrInstrumentFilter] = useState('');
  const [crReports, setCrReports] = useState<CreditReport[]>([]);
  const [crLoading, setCrLoading] = useState(false);

  // Distinct teachers and instruments from the batches prop
  const crTeachers = [...new Set(batches.map(b => b.teacher_name).filter(Boolean))] as string[];
  const crInstruments = [...new Set(batches.map(b => b.instrument_name).filter(Boolean))] as string[];

  // Filtered student list for the credit report selector
  const crFilteredStudents = crAllStudents.filter(s =>
    s.student_name.toLowerCase().includes(crNameFilter.toLowerCase())
  );

  // ── Helpers: Mark Attendance ──────────────────────────────────────────────
  const getDayFromDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  };

  const dayOfWeek = getDayFromDate(attendanceDate);
  const filteredBatches = batches.filter(batch => {
    return !batch.recurrence || batch.recurrence.toUpperCase().includes(dayOfWeek);
  });

  useEffect(() => {
    if (selectedBatch && filteredBatches.some(b => String(b.id) === selectedBatch)) {
      fetchBatchStudents(selectedBatch, attendanceDate);
    } else {
      setBatchStudents([]);
    }
  }, [selectedBatch, attendanceDate]);

  useEffect(() => {
    setSelectedBatch('');
    setBatchStudents([]);
    setGuestStudents([]);
    setExtraSessions(new Set());
    savedExtraIds.current = new Set();
    setStudentSearch('');
  }, [attendanceDate]);

  useEffect(() => {
    setGuestStudents([]);
    setStudentSearch('');
  }, [selectedBatch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setStudentSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchBatchStudents = async (batchId: string, date: string) => {
    try {
      setLoading(true);
      const data = await apiGet(`/api/batches/${batchId}/students?date=${date}`);
      setBatchStudents(
        data.students.map((s: any) => ({
          student_id: s.student_id,
          student_name: s.student_name,
          status: (s.attendance_status as AttendanceStatus) || null,
          phone: s.phone || s.meta_phone,
          guardian_phone: s.guardian_phone,
          guardian_contact: s.guardian_contact
        }))
      );
      const savedExtras = new Set<string>(
        data.students.filter((s: any) => s.has_extra).map((s: any) => s.student_id)
      );
      savedExtraIds.current = savedExtras;
      setExtraSessions(new Set(savedExtras));
    } catch (error) {
      console.error('Error fetching batch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStudents = async () => {
    if (allStudents.length > 0) return;
    try {
      const data = await apiGet('/api/students');
      setAllStudents(data.students.map((s: any) => ({ student_id: String(s.id), student_name: s.name })));
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setBatchStudents(prev =>
      prev.map(s => s.student_id === studentId ? { ...s, status: s.status === status ? null : status } : s)
    );
  };

  const handleGuestStatusChange = (studentId: string, status: AttendanceStatus) => {
    setGuestStudents(prev =>
      prev.map(s => s.student_id === studentId ? { ...s, status: s.status === status ? null : status } : s)
    );
  };

  const toggleExtraSession = (studentId: string) => {
    setExtraSessions(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const addGuestStudent = (student: { student_id: string; student_name: string }) => {
    setGuestStudents(prev => [
      ...prev,
      { student_id: student.student_id, student_name: student.student_name, status: null, phone: null, guardian_phone: null, guardian_contact: null }
    ]);
    setStudentSearch('');
  };

  const removeGuestStudent = (studentId: string) => {
    setGuestStudents(prev => prev.filter(s => s.student_id !== studentId));
    setExtraSessions(prev => { const next = new Set(prev); next.delete(studentId); return next; });
  };

  const handleResetAll = () => {
    setBatchStudents(prev => prev.map(s => ({ ...s, status: null })));
    setGuestStudents([]);
    setExtraSessions(new Set());
    setStudentSearch('');
  };

  const handleMarkAllPresent = () => {
    setBatchStudents(prev => prev.map(s => ({ ...s, status: 'present' as AttendanceStatus })));
  };

  const handleMarkAllAbsent = () => {
    setBatchStudents(prev => prev.map(s => ({ ...s, status: 'absent' as AttendanceStatus })));
  };

  const handleMarkAllExcused = () => {
    setBatchStudents(prev => prev.map(s => ({ ...s, status: 'excused' as AttendanceStatus })));
  };

  const handleSubmitAttendance = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (!selectedBatch) {
      setErrorMessage('Please select a batch');
      return;
    }

    try {
      setSaving(true);

      const enrolledRecords = batchStudents
        .filter(s => s.status)
        .map(s => ({
          batch_id: selectedBatch,
          student_id: s.student_id,
          date: attendanceDate,
          status: s.status,
          is_extra: false,
          is_guest: false
        }));

      const guestRecords = guestStudents
        .filter(s => s.status)
        .map(s => ({
          batch_id: selectedBatch,
          student_id: s.student_id,
          date: attendanceDate,
          status: s.status,
          is_extra: false,
          is_guest: true
        }));

      const allCurrent = [...batchStudents, ...guestStudents];
      const extraRecords = [...extraSessions]
        .filter(id =>
          allCurrent.find(s => s.student_id === id && s.status === 'present') &&
          !savedExtraIds.current.has(id)
        )
        .map(student_id => ({
          batch_id: selectedBatch,
          student_id,
          date: attendanceDate,
          status: 'present' as AttendanceStatus,
          is_extra: true,
          is_guest: guestStudents.some(s => s.student_id === student_id)
        }));

      await apiPost('/api/attendance', { records: [...enrolledRecords, ...guestRecords, ...extraRecords] });
      extraRecords.forEach(r => savedExtraIds.current.add(r.student_id));
      setSuccessMessage('Attendance saved successfully!');
      onRefresh();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving attendance:', error);
      setErrorMessage('Error saving attendance');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const selectedBatchInfo = batches.find(b => String(b.id) === selectedBatch);
  const allStudentsInSession = [...batchStudents, ...guestStudents];
  const presentCount = allStudentsInSession.filter(s => s.status === 'present').length;
  const absentCount = allStudentsInSession.filter(s => s.status === 'absent').length;
  const excusedCount = allStudentsInSession.filter(s => s.status === 'excused').length;
  const extraCount = [...extraSessions].filter(id =>
    allStudentsInSession.find(s => s.student_id === id && s.status === 'present')
  ).length;

  const enrolledIds = new Set(batchStudents.map(s => s.student_id));
  const guestIds = new Set(guestStudents.map(s => s.student_id));
  const searchResults = studentSearch.length >= 1
    ? allStudents.filter(s =>
        s.student_name.toLowerCase().includes(studentSearch.toLowerCase()) &&
        !enrolledIds.has(s.student_id) &&
        !guestIds.has(s.student_id)
      ).slice(0, 8)
    : [];

  const hasStudents = batchStudents.length > 0 || guestStudents.length > 0;

  const renderStatusButtons = (student: BatchStudent, isGuest: boolean) => (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => isGuest ? handleGuestStatusChange(student.student_id, 'present') : handleStatusChange(student.student_id, 'present')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          student.status === 'present' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100'
        }`}
      >
        ✓ Present
      </button>
      <button
        onClick={() => isGuest ? handleGuestStatusChange(student.student_id, 'absent') : handleStatusChange(student.student_id, 'absent')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          student.status === 'absent' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-red-100'
        }`}
      >
        ✗ Absent
      </button>
      <button
        onClick={() => isGuest ? handleGuestStatusChange(student.student_id, 'excused') : handleStatusChange(student.student_id, 'excused')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          student.status === 'excused' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-amber-100'
        }`}
      >
        ~ Excused
      </button>
    </div>
  );

  // ── Helpers: Credit Report ────────────────────────────────────────────────
  const fetchCrStudents = async () => {
    if (crAllStudents.length > 0) return;
    try {
      const data = await apiGet('/api/students');
      setCrAllStudents(data.students.map((s: any) => ({ student_id: String(s.id), student_name: s.name })));
    } catch (error) {
      console.error('Error fetching students for credit report:', error);
    }
  };

  // When teacher filter changes, auto-select students in that teacher's batches
  const handleCrTeacherFilter = async (teacher: string) => {
    setCrTeacherFilter(teacher);
    setCrInstrumentFilter('');
    if (!teacher) return;
    const matchingBatches = batches.filter(b => b.teacher_name === teacher);
    await autoSelectFromBatches(matchingBatches);
  };

  // When instrument filter changes, auto-select students in that instrument's batches
  const handleCrInstrumentFilter = async (instrument: string) => {
    setCrInstrumentFilter(instrument);
    setCrTeacherFilter('');
    if (!instrument) return;
    const matchingBatches = batches.filter(b => b.instrument_name === instrument);
    await autoSelectFromBatches(matchingBatches);
  };

  const autoSelectFromBatches = async (matchingBatches: Batch[]) => {
    try {
      const results = await Promise.all(
        matchingBatches.map(b => apiGet(`/api/batches/${b.id}/students`))
      );
      const ids = new Set<string>();
      results.forEach(data => {
        data.students?.forEach((s: any) => ids.add(String(s.student_id)));
      });
      setCrSelectedIds(ids);
    } catch (error) {
      console.error('Error fetching batch students for filter:', error);
    }
  };

  const toggleCrStudent = (id: string) => {
    setCrSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (crFilteredStudents.every(s => crSelectedIds.has(s.student_id))) {
      setCrSelectedIds(new Set());
    } else {
      setCrSelectedIds(new Set(crFilteredStudents.map(s => s.student_id)));
    }
  };

  const handleLoadReport = async () => {
    if (crSelectedIds.size === 0) return;
    setCrLoading(true);
    setCrReports([]);
    try {
      const ids = [...crSelectedIds].join(',');
      const data = await apiGet(`/api/payments/credit-report?student_ids=${ids}`);
      setCrReports(data.reports || []);
    } catch (error) {
      console.error('Error loading credit report:', error);
    } finally {
      setCrLoading(false);
    }
  };

  const handleMessageAll = () => {
    const reportWithPhone = crReports.filter(r => r.phone);
    if (reportWithPhone.length === 0) {
      alert('None of the selected students have a phone number on record.');
      return;
    }
    reportWithPhone.forEach((r, i) => {
      setTimeout(() => openWhatsApp(r), i * 150);
    });
  };

  // Switch to credit report tab and pre-load student list
  const handleTabChange = (tab: 'mark' | 'credit-report') => {
    setActiveTab(tab);
    if (tab === 'credit-report') fetchCrStudents();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sub-tab toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => handleTabChange('mark')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'mark'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Mark Attendance
        </button>
        <button
          onClick={() => handleTabChange('credit-report')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'credit-report'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Credit Report
        </button>
      </div>

      {/* ── Mark Attendance ── */}
      {activeTab === 'mark' && (
        <>
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Attendance Date *</label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Batch *</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                disabled={filteredBatches.length === 0}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              >
                <option value="">-- Choose a batch --</option>
                {filteredBatches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {(batch as any).instrument_name || 'Batch'} ({batch.recurrence})
                  </option>
                ))}
              </select>
              {filteredBatches.length === 0 && (
                <p className="text-sm text-red-500 mt-2">No batches exist for this day.</p>
              )}
            </div>
          </div>

          {selectedBatchInfo && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{(selectedBatchInfo as any).instrument_name || 'Selected Batch'}</p>
                  <p className="text-sm text-slate-600">
                    {selectedBatchInfo.recurrence} • {selectedBatchInfo.start_time} - {selectedBatchInfo.end_time}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleMarkAllPresent} className="px-3 py-2 text-sm bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition">
                    ✓ All Present
                  </button>
                  <button onClick={handleMarkAllAbsent} className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition">
                    ✗ All Absent
                  </button>
                  <button onClick={handleMarkAllExcused} className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition">
                    ~ All Excused
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-slate-600">Loading students...</p>
            </div>
          ) : !selectedBatch ? (
            <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-400">Please select a batch to mark attendance</p>
            </div>
          ) : (
            <>
              {hasStudents && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-emerald-700">Present</p>
                    <p className="text-3xl font-bold text-emerald-900">{presentCount}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-red-700">Absent</p>
                    <p className="text-3xl font-bold text-red-900">{absentCount}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-amber-700">Excused</p>
                    <p className="text-3xl font-bold text-amber-900">{excusedCount}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-purple-700">Extra Sessions</p>
                    <p className="text-3xl font-bold text-purple-900">{extraCount}</p>
                  </div>
                </div>
              )}

              {hasStudents ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">#</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Student Name</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Contact</th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-slate-700">Status</th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-slate-700">Extra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {batchStudents.map((student, index) => (
                        <tr key={student.student_id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 text-slate-600">{index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{student.student_name}</p>
                              {extraSessions.has(student.student_id) && student.status === 'present' && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">+Extra</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {student.phone ? (
                              <a href={`tel:${student.phone}`} className="hover:text-indigo-600 hover:underline">{student.phone}</a>
                            ) : student.guardian_phone ? (
                              <a href={`tel:${student.guardian_phone}`} className="hover:text-indigo-600 hover:underline">{student.guardian_phone}</a>
                            ) : (student.guardian_contact || 'N/A')}
                          </td>
                          <td className="px-6 py-4">{renderStatusButtons(student, false)}</td>
                          <td className="px-6 py-4 text-center">
                            {student.status === 'present' ? (
                              <button
                                onClick={() => toggleExtraSession(student.student_id)}
                                title="Mark an extra/makeup session — deducts one additional class credit"
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                                  extraSessions.has(student.student_id)
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-purple-100'
                                }`}
                              >
                                + Extra
                              </button>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {guestStudents.length > 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-2 bg-orange-50 border-t-2 border-orange-200 text-xs font-bold text-orange-600 uppercase tracking-wide">
                            Out-of-Turn Students
                          </td>
                        </tr>
                      )}

                      {guestStudents.map((student, index) => (
                        <tr key={`guest-${student.student_id}`} className="hover:bg-orange-50 bg-orange-50/30 transition">
                          <td className="px-6 py-4 text-slate-600">{batchStudents.length + index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{student.student_name}</p>
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Out of Turn</span>
                              {extraSessions.has(student.student_id) && student.status === 'present' && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">+Extra</span>
                              )}
                              <button
                                onClick={() => removeGuestStudent(student.student_id)}
                                title="Remove from this session"
                                className="text-slate-300 hover:text-red-500 transition text-sm ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">—</td>
                          <td className="px-6 py-4">{renderStatusButtons(student, true)}</td>
                          <td className="px-6 py-4 text-center">
                            {student.status === 'present' ? (
                              <button
                                onClick={() => toggleExtraSession(student.student_id)}
                                title="Mark an extra/makeup session — deducts one additional class credit"
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                                  extraSessions.has(student.student_id)
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-purple-100'
                                }`}
                              >
                                + Extra
                              </button>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-400">No students enrolled in this batch. Use the search below to add out-of-turn students.</p>
                </div>
              )}

              {/* Out-of-turn student search */}
              <div className="relative" ref={searchRef}>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Add Out-of-Turn Student</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onFocus={fetchAllStudents}
                  placeholder="Search students to add out of turn..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {searchResults.map(student => (
                      <button
                        key={student.student_id}
                        onClick={() => addGuestStudent(student)}
                        className="w-full text-left px-4 py-3 hover:bg-orange-50 transition border-b border-slate-100 last:border-b-0"
                      >
                        <span className="font-medium text-slate-800">{student.student_name}</span>
                        <span className="ml-2 text-xs text-orange-600 font-medium">Out of Turn</span>
                      </button>
                    ))}
                  </div>
                )}
                {studentSearch.length >= 1 && searchResults.length === 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400">
                    No students found
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={handleResetAll}
                  className="px-5 py-3 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200 transition border border-slate-300"
                >
                  Reset All Selections
                </button>
                <button
                  onClick={handleSubmitAttendance}
                  disabled={saving}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : '💾 Save Attendance'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Credit Report ── */}
      {activeTab === 'credit-report' && (
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
                          <td className={`px-4 py-3 text-center font-medium whitespace-nowrap ${r.is_overdue ? 'text-red-600' : 'text-slate-700'}`}>
                            {r.next_payment_date ? formatDate(r.next_payment_date) : '—'}
                            {r.is_overdue && <span className="ml-1 text-xs">(overdue)</span>}
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
      )}
    </div>
  );
};

export default AttendanceDashboard;
