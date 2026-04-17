import { useState } from 'react';
import { AttendancePickerStudent, AttendancePickerResult } from './chatTypes';

interface AttendancePickerProps {
  batchId: string;
  batchLabel: string;
  sessionDate: string;
  students: AttendancePickerStudent[];
  onSave: (result: AttendancePickerResult) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

type Status = 'present' | 'absent';

export function AttendancePicker({ batchId, batchLabel, sessionDate, students, onSave, onCancel, isSaving }: AttendancePickerProps) {
  const [statusMap, setStatusMap] = useState<Record<string, Status>>(() => {
    const map: Record<string, Status> = {};
    students.forEach(s => {
      if (s.current_status === 'present' || s.current_status === 'absent') {
        map[s.student_id] = s.current_status;
      } else {
        map[s.student_id] = 'present';
      }
    });
    return map;
  });

  const toggle = (id: string) => {
    setStatusMap(prev => ({ ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' }));
  };

  const handleSave = () => {
    onSave({
      batchId,
      sessionDate,
      attendance: Object.entries(statusMap).map(([student_id, status]) => ({ student_id, status })),
    });
  };

  const formattedDate = new Date(sessionDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border, #e5e0d5)', borderRadius: 12, padding: 12, width: '100%' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{batchLabel}</div>
      <div style={{ fontSize: 11, color: 'var(--muted, #8a7d65)', marginBottom: 10 }}>{formattedDate}</div>

      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {students.map(s => (
          <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border, #e5e0d5)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.student_name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #8a7d65)' }}>{s.classes_remaining} classes left</div>
            </div>
            <button
              onClick={() => toggle(s.student_id)}
              type="button"
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                border: 'none',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: statusMap[s.student_id] === 'present' ? '#d4edda' : '#f8d7da',
                color: statusMap[s.student_id] === 'present' ? '#155724' : '#721c24',
              }}
            >
              {statusMap[s.student_id] === 'present' ? '✓ Present' : '✗ Absent'}
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        type="button"
        style={{
          width: '100%',
          marginTop: 12,
          background: 'var(--accent-strong, #ff904e)',
          color: '#1b1307',
          border: 'none',
          borderRadius: 8,
          padding: '10px',
          fontWeight: 700,
          fontSize: 14,
          cursor: isSaving ? 'default' : 'pointer',
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? 'Saving…' : 'Save Attendance'}
      </button>
      <button
        onClick={onCancel}
        type="button"
        style={{ width: '100%', marginTop: 6, background: 'transparent', border: 'none', fontSize: 12, color: 'var(--muted, #8a7d65)', cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}
