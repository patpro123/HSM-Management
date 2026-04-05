import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../api';
import { Batch, AttendanceStatus, CreditReport } from '../types';
import MarkAttendanceTab from './AttendanceDashboard/MarkAttendanceTab';
import CreditReportTab from './AttendanceDashboard/CreditReportTab';

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

  const handleCrTeacherFilter = async (teacher: string) => {
    setCrTeacherFilter(teacher);
    setCrInstrumentFilter('');
    if (!teacher) return;
    const matchingBatches = batches.filter(b => b.teacher_name === teacher);
    await autoSelectFromBatches(matchingBatches);
  };

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
      setTimeout(() => {
        const phone = r.phone;
        if (!phone) return;
        const url = `https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(
          `Hi! Sharing a quick update on ${r.student_name}'s music classes at Hyderabad School of Music.\n\n- HSM Team`
        )}`;
        window.open(url, '_blank');
      }, i * 150);
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

      {activeTab === 'mark' && (
        <MarkAttendanceTab
          attendanceDate={attendanceDate}
          setAttendanceDate={setAttendanceDate}
          selectedBatch={selectedBatch}
          setSelectedBatch={setSelectedBatch}
          filteredBatches={filteredBatches}
          selectedBatchInfo={selectedBatchInfo}
          loading={loading}
          saving={saving}
          successMessage={successMessage}
          errorMessage={errorMessage}
          batchStudents={batchStudents}
          guestStudents={guestStudents}
          extraSessions={extraSessions}
          studentSearch={studentSearch}
          setStudentSearch={setStudentSearch}
          allStudents={allStudents}
          presentCount={presentCount}
          absentCount={absentCount}
          excusedCount={excusedCount}
          extraCount={extraCount}
          hasStudents={hasStudents}
          searchResults={searchResults}
          fetchAllStudents={fetchAllStudents}
          handleStatusChange={handleStatusChange}
          handleGuestStatusChange={handleGuestStatusChange}
          toggleExtraSession={toggleExtraSession}
          addGuestStudent={addGuestStudent}
          removeGuestStudent={removeGuestStudent}
          handleResetAll={handleResetAll}
          handleMarkAllPresent={handleMarkAllPresent}
          handleMarkAllAbsent={handleMarkAllAbsent}
          handleMarkAllExcused={handleMarkAllExcused}
          handleSubmitAttendance={handleSubmitAttendance}
        />
      )}

      {activeTab === 'credit-report' && (
        <CreditReportTab
          batches={batches}
          crAllStudents={crAllStudents}
          crSelectedIds={crSelectedIds}
          crNameFilter={crNameFilter}
          setCrNameFilter={setCrNameFilter}
          crTeacherFilter={crTeacherFilter}
          setCrTeacherFilter={setCrTeacherFilter}
          crInstrumentFilter={crInstrumentFilter}
          setCrInstrumentFilter={setCrInstrumentFilter}
          crTeachers={crTeachers}
          crInstruments={crInstruments}
          crFilteredStudents={crFilteredStudents}
          crReports={crReports}
          crLoading={crLoading}
          handleCrTeacherFilter={handleCrTeacherFilter}
          handleCrInstrumentFilter={handleCrInstrumentFilter}
          toggleCrStudent={toggleCrStudent}
          toggleSelectAll={toggleSelectAll}
          handleLoadReport={handleLoadReport}
          handleMessageAll={handleMessageAll}
        />
      )}
    </div>
  );
};

export default AttendanceDashboard;
