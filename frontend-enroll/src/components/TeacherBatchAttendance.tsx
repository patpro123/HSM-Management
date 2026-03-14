import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

interface BatchStudent {
  student_id: string;
  student_name: string;
  classes_remaining: number | null;
  attendance_status: string | null;
}

interface TeacherBatchAttendanceProps {
  batchId: string;
  onClose: () => void;
}

type AttStatus = 'present' | 'absent' | 'excused';

const today = () => new Date().toISOString().slice(0, 10);

const TeacherBatchAttendance: React.FC<TeacherBatchAttendanceProps> = ({ batchId, onClose }) => {
  const [date, setDate] = useState(today());
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadStudents = async (d: string) => {
    setLoading(true);
    setSaveResult(null);
    try {
      const res = await apiGet(`/api/batches/${batchId}/students?date=${d}`);
      const students: BatchStudent[] = res.students || [];
      setBatchStudents(students);
      // Pre-fill statuses from existing attendance records
      const initial: Record<string, AttStatus> = {};
      students.forEach(s => {
        initial[s.student_id] = (s.attendance_status as AttStatus) || 'absent';
      });
      setStatuses(initial);
    } catch (err) {
      console.error('Failed to load batch students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents(date);
  }, [batchId]);

  const handleDateChange = (d: string) => {
    setDate(d);
    loadStudents(d);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const records = batchStudents.map(s => ({
        batch_id: batchId,
        student_id: s.student_id,
        date,
        status: statuses[s.student_id] || 'absent',
      }));
      await apiPost('/api/attendance', { records });
      setSaveResult({ ok: true, msg: 'Attendance saved successfully!' });
    } catch (err: any) {
      setSaveResult({ ok: false, msg: err.message || 'Failed to save attendance' });
    } finally {
      setSaving(false);
    }
  };

  const STATUS_OPTIONS: { value: AttStatus; label: string; color: string }[] = [
    { value: 'present',  label: 'Present',  color: 'bg-green-100 text-green-800 border-green-300' },
    { value: 'absent',   label: 'Absent',   color: 'bg-red-100 text-red-800 border-red-300' },
    { value: 'excused',  label: 'Excused',  color: 'bg-amber-100 text-amber-800 border-amber-300' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800">Mark Attendance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Date picker */}
        <div className="px-6 py-3 border-b flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Session Date</label>
          <input
            type="date"
            value={date}
            onChange={e => handleDateChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : batchStudents.length === 0 ? (
            <p className="text-center text-gray-400 italic text-sm py-8">No students in this batch.</p>
          ) : (
            <div className="space-y-3">
              {batchStudents.map(s => (
                <div key={s.student_id} className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.student_name}</div>
                    {s.classes_remaining !== null && (
                      <div className={`text-xs mt-0.5 ${s.classes_remaining <= 3 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {s.classes_remaining} classes left
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setStatuses(prev => ({ ...prev, [s.student_id]: opt.value }))}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                          statuses[s.student_id] === opt.value
                            ? opt.color + ' ring-2 ring-offset-1 ring-current'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-4 rounded-b-xl">
          {saveResult ? (
            <span className={`text-sm font-medium ${saveResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {saveResult.msg}
            </span>
          ) : (
            <span className="text-xs text-gray-400">{batchStudents.length} student{batchStudents.length !== 1 ? 's' : ''}</span>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving || batchStudents.length === 0}
              className="px-4 py-2 text-sm rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherBatchAttendance;
