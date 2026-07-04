import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { AttendanceStatus } from '../types';

interface AttendanceBatch {
  id: string;
  instrument_name: string;
  recurrence: string;
}

interface BatchStudent {
  student_id: string;
  student_name: string;
  status: AttendanceStatus | null;
}

interface TeacherMarkAttendanceProps {
  batches: AttendanceBatch[];
  onMarked?: () => void;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-red-500 text-white border-red-500' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-amber-500 text-white border-amber-500' },
];

const TeacherMarkAttendance: React.FC<TeacherMarkAttendanceProps> = ({ batches, onMarked }) => {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!selectedBatchId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setSaveResult(null);
    apiGet(`/api/batches/${selectedBatchId}/students?date=${date}`)
      .then((res: any) => {
        setStudents(
          (res.students || []).map((s: any) => ({
            student_id: s.student_id,
            student_name: s.student_name,
            status: (s.attendance_status as AttendanceStatus) || null,
          }))
        );
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [selectedBatchId, date]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStudents(prev =>
      prev.map(s => (s.student_id === studentId ? { ...s, status: s.status === status ? null : status } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const records = students
        .filter(s => s.status)
        .map(s => ({
          batch_id: selectedBatchId,
          student_id: s.student_id,
          date,
          status: s.status,
        }));
      await apiPost('/api/attendance', { records });
      setSaveResult({ ok: true, msg: 'Attendance saved successfully!' });
      onMarked?.();
    } catch (err: any) {
      setSaveResult({ ok: false, msg: err.message || 'Failed to save attendance' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="font-semibold text-lg text-gray-800 mb-4">Mark Attendance</h3>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
          <select
            value={selectedBatchId}
            onChange={e => setSelectedBatchId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">-- Choose a batch --</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.instrument_name} ({b.recurrence})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedBatchId ? (
        <p className="text-sm text-gray-400 italic">Select a batch to mark attendance.</p>
      ) : loading ? (
        <p className="text-sm text-gray-400 italic">Loading students…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No students enrolled in this batch.</p>
      ) : (
        <div className="space-y-2">
          {students.map(s => (
            <div key={s.student_id} className="flex items-center justify-between gap-4 p-3 border border-gray-200 rounded-lg bg-white">
              <span className="text-sm font-medium text-gray-800">{s.student_name}</span>
              <div className="flex gap-1.5">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(s.student_id, opt.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      s.status === opt.value ? opt.activeClass : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            {saveResult && (
              <span className={`text-sm font-medium ${saveResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {saveResult.msg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto px-5 py-2 text-sm rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherMarkAttendance;
