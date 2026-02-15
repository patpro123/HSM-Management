import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { Batch, AttendanceStatus } from '../types';

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
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Helper to get day from date string (YYYY-MM-DD)
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

  // Reset selected batch when date changes (as available batches might change)
  useEffect(() => {
    setSelectedBatch('');
    setBatchStudents([]);
  }, [attendanceDate]);

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
    } catch (error) {
      console.error('Error fetching batch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setBatchStudents(
      batchStudents.map(s => (s.student_id === studentId ? { ...s, status } : s))
    );
  };

  const handleMarkAllPresent = () => {
    setBatchStudents(batchStudents.map(s => ({ ...s, status: 'present' as AttendanceStatus })));
  };

  const handleMarkAllAbsent = () => {
    setBatchStudents(batchStudents.map(s => ({ ...s, status: 'absent' as AttendanceStatus })));
  };

  const handleMarkAllExcused = () => {
    setBatchStudents(batchStudents.map(s => ({ ...s, status: 'excused' as AttendanceStatus })));
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
      const attendanceRecords = batchStudents
        .filter(s => s.status)
        .map(s => ({
          batch_id: selectedBatch,
          student_id: s.student_id,
          date: attendanceDate,
          status: s.status
        }));

      await apiPost('/api/attendance', { records: attendanceRecords });
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
  const presentCount = batchStudents.filter(s => s.status === 'present').length;
  const absentCount = batchStudents.filter(s => s.status === 'absent').length;
  const excusedCount = batchStudents.filter(s => s.status === 'excused').length;

  return (
    <div className="space-y-6">
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
              <button
                onClick={handleMarkAllPresent}
                className="px-3 py-2 text-sm bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
              >
                ✓ All Present
              </button>
              <button
                onClick={handleMarkAllAbsent}
                className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition"
              >
                ✗ All Absent
              </button>
              <button
                onClick={handleMarkAllExcused}
                className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition"
              >
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
      ) : batchStudents.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-400">
            {selectedBatch ? 'No students enrolled in this batch' : 'Please select a batch to mark attendance'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">#</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Student Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Contact</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batchStudents.map((student, index) => (
                  <tr key={student.student_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-slate-600">{index + 1}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{student.student_name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {student.phone ? (
                        <a href={`tel:${student.phone}`} className="hover:text-indigo-600 hover:underline">{student.phone}</a>
                      ) : student.guardian_phone ? (
                        <a href={`tel:${student.guardian_phone}`} className="hover:text-indigo-600 hover:underline">{student.guardian_phone}</a>
                      ) : (student.guardian_contact || 'N/A')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleStatusChange(student.student_id, 'present')}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            student.status === 'present'
                              ? 'bg-emerald-500 text-white shadow-md'
                              : 'bg-slate-100 text-slate-600 hover:bg-emerald-100'
                          }`}
                        >
                          ✓ Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.student_id, 'absent')}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            student.status === 'absent'
                              ? 'bg-red-500 text-white shadow-md'
                              : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                          }`}
                        >
                          ✗ Absent
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.student_id, 'excused')}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            student.status === 'excused'
                              ? 'bg-amber-500 text-white shadow-md'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-100'
                          }`}
                        >
                          ~ Excused
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
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
    </div>
  );
};

export default AttendanceDashboard;
