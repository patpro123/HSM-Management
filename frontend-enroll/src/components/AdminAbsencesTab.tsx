import { useEffect, useState } from 'react';
import { apiGet } from '../api';
import MakeupAssignPanel, { MakeupMaterialTarget } from './MakeupAssignPanel';
import ViewAssignedMaterialModal from './ViewAssignedMaterialModal';

interface AbsenceStudent {
  student_id: string;
  name: string;
  attendance_status: string;
  makeup_assignments: { id: string; title: string; created_at: string }[];
}

interface AbsenceBatch {
  batch_id: string;
  instrument_name: string;
  students: AbsenceStudent[];
}

interface AbsenceTeacher {
  teacher_id: string;
  teacher_name: string;
  batches: AbsenceBatch[];
}

const todayLocalDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function AdminAbsencesTab() {
  const [date, setDate] = useState(todayLocalDateStr());
  const [teachers, setTeachers] = useState<AbsenceTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewAssignmentIds, setViewAssignmentIds] = useState<string[] | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const fetchAbsences = () => {
    setLoading(true);
    setError(null);
    apiGet(`/api/attendance/absences?date=${date}`)
      .then((res: any) => setTeachers(res.teachers || []))
      .catch((err: any) => setError(err.message || 'Failed to fetch absences'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAbsences, [date]);

  const toggleSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalStudents = teachers.reduce(
    (sum, t) => sum + t.batches.reduce((s, b) => s + b.students.length, 0),
    0
  );

  const selectedTargets: MakeupMaterialTarget[] = [];
  for (const teacher of teachers) {
    for (const batch of teacher.batches) {
      for (const st of batch.students) {
        if (selectedKeys.has(`${st.student_id}::${batch.batch_id}`)) {
          selectedTargets.push({ student_id: st.student_id, name: st.name, batch_id: batch.batch_id, instrument_name: batch.instrument_name });
        }
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-800">Student Absences</h3>
          <p className="text-sm text-gray-500 mt-0.5">Absent or unmarked students across all teachers for the selected date.</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setSelectedKeys(new Set()); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 italic">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      ) : teachers.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No absences — either no batches are scheduled on this date, or all students are marked present.</p>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-gray-400">
            {totalStudents} student{totalStudents !== 1 ? 's' : ''} across {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}
          </p>
          {teachers.map(teacher => (
            <div key={teacher.teacher_id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <p className="font-semibold text-sm text-gray-800">{teacher.teacher_name}</p>
              </div>
              <div className="p-4 space-y-4">
                {teacher.batches.map(batch => (
                  <div key={batch.batch_id}>
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">{batch.instrument_name}</p>
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
                      {batch.students.map(st => {
                        const key = `${st.student_id}::${batch.batch_id}`;
                        return (
                        <div key={st.student_id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(key)}
                              onChange={() => toggleSelection(key)}
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 flex-shrink-0"
                            />
                            <span className="text-sm font-medium text-gray-800 truncate">{st.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              st.attendance_status === 'absent'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {st.attendance_status === 'not_marked' ? 'Not marked' : st.attendance_status}
                            </span>
                            {st.makeup_assignments.length > 0 && (
                              <button
                                onClick={() => setViewAssignmentIds(st.makeup_assignments.map(a => a.id))}
                                className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                              >
                                ✓ View Assigned{st.makeup_assignments.length > 1 ? ` (${st.makeup_assignments.length})` : ''}
                              </button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <MakeupAssignPanel
            targets={selectedTargets}
            sessionDate={date}
            onAssigned={() => { setSelectedKeys(new Set()); fetchAbsences(); }}
          />
        </div>
      )}

      {viewAssignmentIds && (
        <ViewAssignedMaterialModal
          assignmentIds={viewAssignmentIds}
          onClose={() => setViewAssignmentIds(null)}
        />
      )}
    </div>
  );
}
